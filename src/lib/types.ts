/**
 * types.ts  –  Shared TypeScript Interfaces
 * -------------------------------------------
 * Central type definitions for the Money Goals app.
 * The `Goal` interface mirrors the JSON shape that will eventually be
 * stored in Redis, keeping the frontend & backend contract in sync.
 *
 * @example
 * const goal: Goal = {
 *   id: "abc-123",
 *   title: "Emergency Fund",
 *   targetAmount: 10000,
 *   currentAmount: 2500,
 *   orderIndex: 0,
 * };
 */

/* ── Core data model ─────────────────────────────────────────── */

/**
 * Represents a single financial savings goal.
 *
 * `orderIndex` determines the visual position in the vertical chain.
 * Lower indices render at the **bottom** of the screen (filled first),
 * while higher indices sit at the **top** (filled last).
 */
export interface Goal {
  /** Unique identifier – UUID v4 string. */
  id: string;
  /** Human-readable label, e.g. "Vacation Fund". */
  title: string;
  /** Dollar amount the user wants to reach. */
  targetAmount: number;
  /** Dollars saved so far. 0 ≤ currentAmount ≤ targetAmount. */
  currentAmount: number;
  /** Sort position in the vertical goal chain (0 = bottom). */
  orderIndex: number;
}

/* ── Application-level state ──────────────────────────────────── */

/**
 * Shape of the global React context value.
 * Every property exposed here is available to any descendant component
 * via `useGoals()`.
 */
export interface GoalsContextValue {
  /** The ordered list of goals. */
  goals: Goal[];
  /** Replace the entire goal array (used after reorder / bulk update). */
  setGoals: (goals: Goal[]) => void;
  /** Append a brand-new goal to the top of the chain. */
  addGoal: (title: string, targetAmount: number) => void;
  /** Remove a goal by its id. */
  removeGoal: (id: string) => void;
  /**
   * Distribute `amount` dollars across goals, starting from the
   * lowest-orderIndex goal that isn't fully funded.
   * Returns the animated allocation map: `{ [goalId]: amountAdded }`.
   */
  addFunds: (amount: number) => Record<string, number>;
  /** Sum of every goal's `currentAmount`. */
  totalSaved: number;
}
