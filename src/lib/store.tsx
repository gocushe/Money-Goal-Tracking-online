/**
 * store.tsx  –  Global State Provider (React Context + Redis Sync)
 * ------------------------------------------------------------------
 * Manages the goal list, fund allocation logic, and CRUD operations.
 *
 * Architecture notes:
 *  • On mount the provider tries to fetch goals from the `/api/goals`
 *    endpoint (backed by Redis).  If the API is unavailable (local dev
 *    without `REDIS_URL`, or network error) it falls back to
 *    localStorage so the app always works.
 *  • Every mutation (add / remove / reorder / addFunds) optimistically
 *    updates local state, persists to localStorage, **and** fires a
 *    background PUT to `/api/goals` to keep Redis in sync.
 *  • `addFunds()` distributes money bottom-up (lowest orderIndex first),
 *    spilling overflow into the next incomplete goal – exactly like water
 *    rising through a pipe.
 *
 * Usage:
 *   Wrap your app in `<GoalsProvider>` then call `useGoals()` in any child.
 */

"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import { Goal, GoalsContextValue } from "@/lib/types";

/* ── localStorage key ──────────────────────────────────────────── */
const STORAGE_KEY = "money-goals-data";

/* ── Seed data (shown on first visit when no data exists anywhere) ── */
const DEFAULT_GOALS: Goal[] = [
  {
    id: "seed-1",
    title: "Emergency Fund",
    targetAmount: 5000,
    currentAmount: 1200,
    orderIndex: 0,
  },
  {
    id: "seed-2",
    title: "Vacation",
    targetAmount: 3000,
    currentAmount: 0,
    orderIndex: 1,
  },
  {
    id: "seed-3",
    title: "New Laptop",
    targetAmount: 2000,
    currentAmount: 0,
    orderIndex: 2,
  },
];

/* ── Context (undefined until provider mounts) ─────────────────── */
const GoalsContext = createContext<GoalsContextValue | undefined>(undefined);

/* ── Helper: generate a simple UUID v4 ─────────────────────────── */
function uuid(): string {
  return crypto.randomUUID();
}

/* ───────────────────────────────────────────────────────────────
 *  Redis API helpers — thin wrappers around fetch() calls to
 *  the Next.js API route at /api/goals.
 * ─────────────────────────────────────────────────────────────── */

/**
 * Fetch goals from the Redis-backed API.
 * Returns `null` if the API is unreachable or Redis is not configured,
 * signalling the caller to fall back to localStorage.
 */
async function fetchGoalsFromAPI(): Promise<Goal[] | null> {
  try {
    const res = await fetch("/api/goals", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.goals ?? null;
  } catch {
    /* Network error or API not running — fall back silently. */
    return null;
  }
}

/**
 * Persist the full goals array to Redis via a PUT request.
 * Failures are logged but never block the UI.
 */
async function saveGoalsToAPI(goals: Goal[]): Promise<void> {
  try {
    await fetch("/api/goals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goals }),
    });
  } catch {
    /* Silently swallow — localStorage serves as the fallback. */
    console.warn("[store] Failed to sync goals to Redis API.");
  }
}

/* ── Provider component ────────────────────────────────────────── */
/**
 * `GoalsProvider` wraps the component tree and exposes goal state + actions
 * through React Context.
 *
 * Persistence strategy (ordered by priority):
 *  1. Redis (via `/api/goals`) — authoritative when available.
 *  2. localStorage — immediate fallback, always kept in sync.
 */
export function GoalsProvider({ children }: { children: React.ReactNode }) {
  /**
   * Initialise from localStorage synchronously so the first paint
   * is never empty.  The useEffect below will overwrite with Redis
   * data if available.
   */
  const [goals, setGoalsRaw] = useState<Goal[]>(() => {
    if (typeof window === "undefined") return DEFAULT_GOALS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as Goal[]) : DEFAULT_GOALS;
    } catch {
      return DEFAULT_GOALS;
    }
  });

  /** Track whether the initial Redis fetch has completed. */
  const initialFetchDone = useRef(false);

  /**
   * On mount, attempt to hydrate from Redis.
   * If Redis returns data, use it as the source of truth and also
   * update localStorage.  Otherwise keep whatever localStorage had.
   */
  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;

    (async () => {
      const remote = await fetchGoalsFromAPI();
      if (remote && remote.length > 0) {
        setGoalsRaw(remote);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
      } else if (remote && remote.length === 0) {
        /* Redis is connected but empty — seed it with defaults or
           whatever is currently in localStorage. */
        const current =
          goals.length > 0 ? goals : DEFAULT_GOALS;
        await saveGoalsToAPI(current);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Persist to both localStorage and Redis whenever goals change.
   * We skip the very first render (before Redis hydration) to avoid
   * overwriting remote data with stale localStorage data.
   */
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
    saveGoalsToAPI(goals);
  }, [goals]);

  /**
   * Replace the full goal array.
   * Used after drag-and-drop reorder or bulk operations.
   */
  const setGoals = useCallback((next: Goal[]) => {
    setGoalsRaw(next);
  }, []);

  /**
   * Append a new goal at the top of the visual chain.
   * Its `orderIndex` is one above the current maximum.
   */
  const addGoal = useCallback(
    (title: string, targetAmount: number) => {
      const maxOrder = goals.reduce(
        (max, g) => Math.max(max, g.orderIndex),
        -1
      );
      const newGoal: Goal = {
        id: uuid(),
        title,
        targetAmount,
        currentAmount: 0,
        orderIndex: maxOrder + 1,
      };
      setGoalsRaw((prev) => [...prev, newGoal]);
    },
    [goals]
  );

  /**
   * Remove a goal by id and re-index the remaining goals so
   * orderIndex values stay contiguous.
   */
  const removeGoal = useCallback((id: string) => {
    setGoalsRaw((prev) => {
      const filtered = prev.filter((g) => g.id !== id);
      /* Re-index so order stays 0…n-1 */
      return filtered
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((g, i) => ({ ...g, orderIndex: i }));
    });
  }, []);

  /**
   * Distribute `amount` across goals from lowest to highest orderIndex.
   * Each goal can only accept up to `targetAmount - currentAmount`.
   * Overflow spills into the next goal — the "water flow" mechanic.
   *
   * @returns An allocation map `{ [goalId]: dollarsAdded }` used by
   *          the animation layer to show money flowing upward.
   */
  const addFunds = useCallback(
    (amount: number): Record<string, number> => {
      const sorted = [...goals].sort((a, b) => a.orderIndex - b.orderIndex);
      let remaining = amount;
      const allocation: Record<string, number> = {};

      const updatedGoals = sorted.map((goal) => {
        if (remaining <= 0) return goal;
        const capacity = goal.targetAmount - goal.currentAmount;
        const deposit = Math.min(remaining, capacity);
        remaining -= deposit;
        if (deposit > 0) allocation[goal.id] = deposit;
        return { ...goal, currentAmount: goal.currentAmount + deposit };
      });

      setGoalsRaw(updatedGoals);
      return allocation;
    },
    [goals]
  );

  /** Compute aggregated total saved across all goals. */
  const totalSaved = useMemo(
    () => goals.reduce((sum, g) => sum + g.currentAmount, 0),
    [goals]
  );

  /* ── Memoised context value to avoid unnecessary re-renders ── */
  const value = useMemo<GoalsContextValue>(
    () => ({ goals, setGoals, addGoal, removeGoal, addFunds, totalSaved }),
    [goals, setGoals, addGoal, removeGoal, addFunds, totalSaved]
  );

  return (
    <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>
  );
}

/* ── Consumer hook ─────────────────────────────────────────────── */
/**
 * `useGoals()` provides typed access to the global goals context.
 * Must be called inside a `<GoalsProvider>`.
 *
 * @throws Error if used outside the provider tree.
 */
export function useGoals(): GoalsContextValue {
  const ctx = useContext(GoalsContext);
  if (!ctx) {
    throw new Error("useGoals() must be used within a <GoalsProvider>");
  }
  return ctx;
}
