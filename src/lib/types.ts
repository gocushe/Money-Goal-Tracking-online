/**
 * types.ts  –  Shared TypeScript Interfaces
 */

/* ── Account / Auth ──────────────────────────────────────────── */
export interface AccountCode { code: string; label: string; }
export interface LetterRoute { letter: string; codes: AccountCode[]; }
export interface AuthSession { letter: string; code: string; label: string; isAdmin: boolean; }

/* ── Goals ────────────────────────────────────────────────────── */
export interface SideGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  subGoals?: SideGoal[];
}

export interface Goal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  orderIndex: number;
  sideGoals?: SideGoal[];
}

/** Tracks each deposit event for pie-chart time filtering. */
export interface GoalDeposit {
  id: string;
  goalId: string;
  goalTitle: string;
  amount: number;
  date: string;
  isSideGoal: boolean;
}

/* ── Spending (Discretionary) ─────────────────────────────────── */
export interface SpendingEntry {
  id: string;
  title: string;
  amount: number;
  date: string;
}

/* ── Bills ────────────────────────────────────────────────────── */
export type BillFrequency = "weekly" | "biweekly" | "monthly" | "yearly" | "one-time";

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  frequency: BillFrequency;
  category: string;
  isPaid: boolean;
  lastPaidDate?: string;
}

export interface BillPayment {
  id: string;
  billName: string;
  amount: number;
  date: string;
}

/* ── Unallocated Deposits (from Trading Journal) ──────────────── */
export interface UnallocatedDeposit {
  id: string;
  amountCAD: number;
  amountUSD: number;
  note: string;
  date: string;           // payout date from journal
  source: string;         // e.g. "Trading Journal"
  pushedAt: string;       // ISO timestamp when it was pushed
}

export interface UnallocatedFundsContextValue {
  deposits: UnallocatedDeposit[];
  totalUnallocated: number;
  addDeposit: (deposit: Omit<UnallocatedDeposit, "id">) => void;
  removeDeposit: (id: string) => void;
  /** Allocate a specific deposit (or partial amount) to a goal/expense/bill */
  allocateDeposit: (depositId: string, amount: number) => void;
}

/* ── Context shapes ───────────────────────────────────────────── */
export interface GoalsContextValue {
  goals: Goal[];
  setGoals: (goals: Goal[]) => void;
  addGoal: (title: string, targetAmount: number) => void;
  removeGoal: (id: string) => void;
  addFunds: (amount: number) => Record<string, number>;
  addFundsToGoal: (goalId: string, amount: number) => void;
  addSideGoal: (parentGoalId: string, title: string, targetAmount: number) => void;
  addSubSideGoal: (parentGoalId: string, sideGoalId: string, title: string, targetAmount: number) => void;
  removeSideGoal: (parentGoalId: string, sideGoalId: string) => void;
  addFundsToSideGoal: (parentGoalId: string, sideGoalId: string, amount: number) => void;
  goalDeposits: GoalDeposit[];
  totalSaved: number;
}

export interface SpendingContextValue {
  entries: SpendingEntry[];
  addEntry: (entry: Omit<SpendingEntry, "id">) => void;
  removeEntry: (id: string) => void;
}

export interface BillsContextValue {
  bills: Bill[];
  billPayments: BillPayment[];
  addBill: (bill: Omit<Bill, "id">) => void;
  removeBill: (id: string) => void;
  togglePaid: (id: string) => void;
}
