/**
 * store.tsx  –  Multi-Account State Providers
 * ------------------------------------------------------------------
 * Provides React Context providers for Goals, Spending, and Bills.
 * Each account (letter + code) has isolated storage.
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
import {
  Goal,
  SideGoal,
  GoalDeposit,
  GoalsContextValue,
  SpendingEntry,
  SpendingContextValue,
  Bill,
  BillPayment,
  BillsContextValue,
  UnallocatedDeposit,
  UnallocatedFundsContextValue,
  LetterRoute,
  AuthSession,
  AccountSyncData,
  AccountSyncContextValue,
} from "@/lib/types";

/* ── Storage helpers ───────────────────────────────────────────── */

const ROUTES_KEY = "money-goals-routes";

/** Default routes: Admin under A-1598. */
const DEFAULT_ROUTES: LetterRoute[] = [
  { letter: "A", codes: [{ code: "1598", label: "Admin" }] },
];

export function loadRoutes(): LetterRoute[] {
  if (typeof window === "undefined") return DEFAULT_ROUTES;
  try {
    const raw = localStorage.getItem(ROUTES_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_ROUTES;
  } catch {
    return DEFAULT_ROUTES;
  }
}

export function saveRoutes(routes: LetterRoute[]) {
  localStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
}

/** Check if a letter+code combination is valid. */
export function validateLogin(letter: string, code: string): { valid: boolean; label: string } {
  const routes = loadRoutes();
  const route = routes.find((r) => r.letter === letter);
  if (!route) return { valid: false, label: "" };
  const match = route.codes.find((c) => c.code === code);
  if (!match) return { valid: false, label: "" };
  return { valid: true, label: match.label };
}

function storageKey(prefix: string, session: AuthSession) {
  return `${prefix}-${session.letter}-${session.code}`;
}

/* ── UUID helper ───────────────────────────────────────────────── */
function uuid(): string {
  return crypto.randomUUID();
}

/* ── Default goals seed (all zeroed out) ───────────────────────── */
const DEFAULT_GOALS: Goal[] = [
  { id: "seed-1", title: "Emergency Fund", targetAmount: 5000, currentAmount: 0, orderIndex: 0 },
  { id: "seed-2", title: "Vacation", targetAmount: 3000, currentAmount: 0, orderIndex: 1 },
  { id: "seed-3", title: "New Laptop", targetAmount: 2000, currentAmount: 0, orderIndex: 2 },
];

/* ═══════════════════════════════════════════════════════════════════
 *  GOALS PROVIDER
 * ═══════════════════════════════════════════════════════════════════ */

const GoalsContext = createContext<GoalsContextValue | undefined>(undefined);

export function GoalsProvider({
  session,
  children,
}: {
  session: AuthSession;
  children: React.ReactNode;
}) {
  const key = storageKey("money-goals-data", session);
  const depositsKey = storageKey("money-goals-deposits", session);

  const [goals, setGoalsRaw] = useState<Goal[]>(() => {
    if (typeof window === "undefined") return DEFAULT_GOALS;
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as Goal[]) : DEFAULT_GOALS;
    } catch {
      return DEFAULT_GOALS;
    }
  });

  const [goalDeposits, setGoalDeposits] = useState<GoalDeposit[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(depositsKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    localStorage.setItem(key, JSON.stringify(goals));
  }, [goals, key]);

  useEffect(() => {
    localStorage.setItem(depositsKey, JSON.stringify(goalDeposits));
  }, [goalDeposits, depositsKey]);

  const setGoals = useCallback((next: Goal[]) => setGoalsRaw(next), []);

  const addGoal = useCallback(
    (title: string, targetAmount: number) => {
      const maxOrder = goals.reduce((max, g) => Math.max(max, g.orderIndex), -1);
      const newGoal: Goal = {
        id: uuid(),
        title,
        targetAmount,
        currentAmount: 0,
        orderIndex: maxOrder + 1,
        sideGoals: [],
      };
      setGoalsRaw((prev) => [...prev, newGoal]);
    },
    [goals]
  );

  const removeGoal = useCallback((id: string) => {
    setGoalsRaw((prev) => {
      const filtered = prev.filter((g) => g.id !== id);
      return filtered
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((g, i) => ({ ...g, orderIndex: i }));
    });
  }, []);

  /** Distribute funds linearly through the goal chain (bottom-up). */
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

      // Record deposits for pie chart tracking
      const newDeposits: GoalDeposit[] = Object.entries(allocation).map(
        ([goalId, amt]) => {
          const g = sorted.find((x) => x.id === goalId);
          return {
            id: uuid(),
            goalId,
            goalTitle: g?.title || "Unknown",
            amount: amt,
            date: new Date().toISOString(),
            isSideGoal: false,
          };
        }
      );
      if (newDeposits.length > 0) {
        setGoalDeposits((prev) => [...prev, ...newDeposits]);
      }

      return allocation;
    },
    [goals]
  );

  /** Add funds to a specific goal directly (by goalId). */
  const addFundsToGoal = useCallback(
    (goalId: string, amount: number) => {
      setGoalsRaw((prev) =>
        prev.map((g) => {
          if (g.id !== goalId) return g;
          const deposit = Math.min(amount, g.targetAmount - g.currentAmount);
          return { ...g, currentAmount: g.currentAmount + deposit };
        })
      );
      const g = goals.find((x) => x.id === goalId);
      const actualDeposit = g ? Math.min(amount, g.targetAmount - g.currentAmount) : amount;
      if (actualDeposit > 0) {
        setGoalDeposits((prev) => [
          ...prev,
          {
            id: uuid(),
            goalId,
            goalTitle: g?.title || "Unknown",
            amount: actualDeposit,
            date: new Date().toISOString(),
            isSideGoal: false,
          },
        ]);
      }
    },
    [goals]
  );

  /* ── Side goal operations ───────────────────────────────────── */

  const addSideGoal = useCallback(
    (parentGoalId: string, title: string, targetAmount: number) => {
      setGoalsRaw((prev) =>
        prev.map((g) => {
          if (g.id !== parentGoalId) return g;
          const sg: SideGoal = { id: uuid(), title, targetAmount, currentAmount: 0, subGoals: [] };
          return { ...g, sideGoals: [...(g.sideGoals || []), sg] };
        })
      );
    },
    []
  );

  const addSubSideGoal = useCallback(
    (parentGoalId: string, sideGoalId: string, title: string, targetAmount: number) => {
      setGoalsRaw((prev) =>
        prev.map((g) => {
          if (g.id !== parentGoalId) return g;
          const sideGoals = (g.sideGoals || []).map((sg) => {
            if (sg.id !== sideGoalId) return sg;
            const sub: SideGoal = { id: uuid(), title, targetAmount, currentAmount: 0, subGoals: [] };
            return { ...sg, subGoals: [...(sg.subGoals || []), sub] };
          });
          return { ...g, sideGoals };
        })
      );
    },
    []
  );

  const removeSideGoal = useCallback(
    (parentGoalId: string, sideGoalId: string) => {
      setGoalsRaw((prev) =>
        prev.map((g) => {
          if (g.id !== parentGoalId) return g;
          return { ...g, sideGoals: (g.sideGoals || []).filter((sg) => sg.id !== sideGoalId) };
        })
      );
    },
    []
  );

  const addFundsToSideGoal = useCallback(
    (parentGoalId: string, sideGoalId: string, amount: number) => {
      let sideGoalTitle = "Side Goal";
      setGoalsRaw((prev) =>
        prev.map((g) => {
          if (g.id !== parentGoalId) return g;
          const sideGoals = (g.sideGoals || []).map((sg) => {
            if (sg.id !== sideGoalId) return sg;
            const deposit = Math.min(amount, sg.targetAmount - sg.currentAmount);
            sideGoalTitle = sg.title;
            return { ...sg, currentAmount: sg.currentAmount + deposit };
          });
          return { ...g, sideGoals };
        })
      );
      if (amount > 0) {
        setGoalDeposits((prev) => [
          ...prev,
          {
            id: uuid(),
            goalId: sideGoalId,
            goalTitle: sideGoalTitle,
            amount,
            date: new Date().toISOString(),
            isSideGoal: true,
          },
        ]);
      }
    },
    []
  );

  const totalSaved = useMemo(
    () => goals.reduce((sum, g) => sum + g.currentAmount, 0),
    [goals]
  );

  const value = useMemo<GoalsContextValue>(
    () => ({
      goals,
      setGoals,
      addGoal,
      removeGoal,
      addFunds,
      addFundsToGoal,
      addSideGoal,
      addSubSideGoal,
      removeSideGoal,
      addFundsToSideGoal,
      goalDeposits,
      totalSaved,
    }),
    [goals, setGoals, addGoal, removeGoal, addFunds, addFundsToGoal, addSideGoal, addSubSideGoal, removeSideGoal, addFundsToSideGoal, goalDeposits, totalSaved]
  );

  return <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>;
}

export function useGoals(): GoalsContextValue {
  const ctx = useContext(GoalsContext);
  if (!ctx) throw new Error("useGoals() must be used within a <GoalsProvider>");
  return ctx;
}

/* ═══════════════════════════════════════════════════════════════════
 *  SPENDING PROVIDER
 * ═══════════════════════════════════════════════════════════════════ */

const SpendingContext = createContext<SpendingContextValue | undefined>(undefined);

export function SpendingProvider({
  session,
  children,
}: {
  session: AuthSession;
  children: React.ReactNode;
}) {
  const key = storageKey("money-goals-spending", session);

  const [entries, setEntries] = useState<SpendingEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    localStorage.setItem(key, JSON.stringify(entries));
  }, [entries, key]);

  const addEntry = useCallback((entry: Omit<SpendingEntry, "id">) => {
    setEntries((prev) => [...prev, { ...entry, id: uuid() }]);
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const value = useMemo<SpendingContextValue>(
    () => ({ entries, addEntry, removeEntry, setEntries }),
    [entries, addEntry, removeEntry, setEntries]
  );

  return <SpendingContext.Provider value={value}>{children}</SpendingContext.Provider>;
}

export function useSpending(): SpendingContextValue {
  const ctx = useContext(SpendingContext);
  if (!ctx) throw new Error("useSpending() must be used within a <SpendingProvider>");
  return ctx;
}

/* ═══════════════════════════════════════════════════════════════════
 *  BILLS PROVIDER
 * ═══════════════════════════════════════════════════════════════════ */

const BillsContext = createContext<BillsContextValue | undefined>(undefined);

export function BillsProvider({
  session,
  children,
}: {
  session: AuthSession;
  children: React.ReactNode;
}) {
  const key = storageKey("money-goals-bills", session);
  const paymentsKey = storageKey("money-goals-bill-payments", session);

  const [bills, setBills] = useState<Bill[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [billPayments, setBillPayments] = useState<BillPayment[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(paymentsKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    localStorage.setItem(key, JSON.stringify(bills));
  }, [bills, key]);

  useEffect(() => {
    localStorage.setItem(paymentsKey, JSON.stringify(billPayments));
  }, [billPayments, paymentsKey]);

  const addBill = useCallback((bill: Omit<Bill, "id">) => {
    setBills((prev) => [...prev, { ...bill, id: uuid() }]);
  }, []);

  const removeBill = useCallback((id: string) => {
    setBills((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const togglePaid = useCallback((id: string) => {
    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const newPaid = !b.isPaid;
        if (newPaid) {
          // Record a payment when marking as paid
          setBillPayments((p) => [
            ...p,
            {
              id: uuid(),
              billName: b.name,
              amount: b.amount,
              date: new Date().toISOString(),
              chargeToAccountId: b.chargeToAccountId,
            },
          ]);
        }
        return {
          ...b,
          isPaid: newPaid,
          lastPaidDate: newPaid ? new Date().toISOString() : b.lastPaidDate,
        };
      })
    );
  }, []);

  const value = useMemo<BillsContextValue>(
    () => ({ bills, billPayments, addBill, removeBill, togglePaid, setBills, setBillPayments }),
    [bills, billPayments, addBill, removeBill, togglePaid, setBills, setBillPayments]
  );

  return <BillsContext.Provider value={value}>{children}</BillsContext.Provider>;
}

export function useBills(): BillsContextValue {
  const ctx = useContext(BillsContext);
  if (!ctx) throw new Error("useBills() must be used within a <BillsProvider>");
  return ctx;
}

/* ═══════════════════════════════════════════════════════════════════
 *  UNALLOCATED FUNDS PROVIDER  (Trading Journal → Holding Area)
 * ═══════════════════════════════════════════════════════════════════ */

const UnallocatedFundsContext = createContext<UnallocatedFundsContextValue | undefined>(undefined);

export function UnallocatedFundsProvider({
  session,
  children,
}: {
  session: AuthSession;
  children: React.ReactNode;
}) {
  const key = storageKey("money-goals-unallocated", session);

  const [deposits, setDeposits] = useState<UnallocatedDeposit[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    localStorage.setItem(key, JSON.stringify(deposits));
  }, [deposits, key]);

  const totalUnallocated = useMemo(
    () => deposits.reduce((sum, d) => sum + d.amountCAD, 0),
    [deposits]
  );

  const addDeposit = useCallback((deposit: Omit<UnallocatedDeposit, "id">) => {
    setDeposits((prev) => [...prev, { ...deposit, id: uuid() }]);
  }, []);

  const removeDeposit = useCallback((id: string) => {
    setDeposits((prev) => prev.filter((d) => d.id !== id));
  }, []);

  /** Reduce a deposit's amountCAD by the allocated amount. Removes if fully allocated. */
  const allocateDeposit = useCallback((depositId: string, amount: number) => {
    setDeposits((prev) =>
      prev
        .map((d) => {
          if (d.id !== depositId) return d;
          const remaining = d.amountCAD - amount;
          if (remaining <= 0.01) return null; // fully allocated → remove
          return { ...d, amountCAD: remaining };
        })
        .filter(Boolean) as UnallocatedDeposit[]
    );
  }, []);

  const value = useMemo<UnallocatedFundsContextValue>(
    () => ({ deposits, totalUnallocated, addDeposit, removeDeposit, allocateDeposit }),
    [deposits, totalUnallocated, addDeposit, removeDeposit, allocateDeposit]
  );

  return (
    <UnallocatedFundsContext.Provider value={value}>
      {children}
    </UnallocatedFundsContext.Provider>
  );
}

export function useUnallocatedFunds(): UnallocatedFundsContextValue {
  const ctx = useContext(UnallocatedFundsContext);
  if (!ctx) throw new Error("useUnallocatedFunds() must be used within an <UnallocatedFundsProvider>");
  return ctx;
}

/* ═══════════════════════════════════════════════════════════════════
 *  ACCOUNT SYNC PROVIDER  (Financial & Trading accounts from Journal)
 * ═══════════════════════════════════════════════════════════════════ */

const AccountSyncContext = createContext<AccountSyncContextValue | undefined>(undefined);

export function AccountSyncProvider({
  session,
  children,
}: {
  session: AuthSession;
  children: React.ReactNode;
}) {
  const key = storageKey("money-goals-account-sync", session);

  const [accountSync, setAccountSyncRaw] = useState<AccountSyncData | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    if (accountSync) {
      localStorage.setItem(key, JSON.stringify(accountSync));
    } else {
      localStorage.removeItem(key);
    }
  }, [accountSync, key]);

  const setAccountSync = useCallback((data: AccountSyncData | null) => {
    setAccountSyncRaw(data);
  }, []);

  const lastSyncedAt = accountSync?.syncedAt ?? null;

  const value = useMemo<AccountSyncContextValue>(
    () => ({ accountSync, setAccountSync, lastSyncedAt }),
    [accountSync, setAccountSync, lastSyncedAt]
  );

  return (
    <AccountSyncContext.Provider value={value}>
      {children}
    </AccountSyncContext.Provider>
  );
}

export function useAccountSync(): AccountSyncContextValue {
  const ctx = useContext(AccountSyncContext);
  if (!ctx) throw new Error("useAccountSync() must be used within an <AccountSyncProvider>");
  return ctx;
}

/* ═══════════════════════════════════════════════════════════════
 *  CATEGORIES CONTEXT (synced from Trading Journal)
 * ═══════════════════════════════════════════════════════════════ */

import type { SyncedCategory, CategoriesContextValue } from "@/lib/types";

const CategoriesContext = createContext<CategoriesContextValue | null>(null);

export function CategoriesProvider({ session, children }: { session: AuthSession; children: React.ReactNode }) {
  const key = `money-goals-categories-${session.letter}-${session.code}`;
  const [categories, setCategoriesRaw] = useState<SyncedCategory[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    localStorage.setItem(key, JSON.stringify(categories));
  }, [categories, key]);

  const setCategories = useCallback((cats: SyncedCategory[]) => {
    setCategoriesRaw(cats);
  }, []);

  const value = useMemo<CategoriesContextValue>(
    () => ({ categories, setCategories }),
    [categories, setCategories]
  );

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories(): CategoriesContextValue {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useCategories() must be used within a <CategoriesProvider>");
  return ctx;
}
