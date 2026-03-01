/**
 * ExpensesView.tsx  –  Combined Discretionary + Bills View
 * -----------------------------------------------------------
 * Unified expenses tab with:
 *  - Toggle between Discretionary (light blue) and Bills (green) sections
 *  - Pie chart breakdown (goals / discretionary / bills) by time period
 *  - Auto-suggest titles from past entries
 *  - Time period filtering (week / month / year / all)
 */

"use client";

import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  X,
  Filter,
  Check,
  Circle,
  CalendarDays,
  RefreshCw,
  TrendingDown,
  Receipt,
  CreditCard,
  Wallet,
  Building2,
  ArrowRightLeft,
  Clock,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useSpending, useBills, useGoals, useAccountSync, useCategories } from "@/lib/store";
import { BillFrequency, Bill, SyncedFinancialAccount, SyncedCategory } from "@/lib/types";

/* ── Constants ─────────────────────────────────────────────────── */

const FREQUENCY_LABELS: Record<BillFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  "one-time": "One-time",
};

const BILL_CATEGORIES = [
  "Housing",
  "Utilities",
  "Insurance",
  "Subscriptions",
  "Phone",
  "Internet",
  "Car",
  "Other",
];

type TimePeriod = "week" | "month" | "year" | "all";
type Section = "discretionary" | "bills" | "accounts";

const PIE_COLORS = {
  Goals: "#a855f7",
  Discretionary: "#38bdf8",
  Bills: "#22c55e",
};

/* ── Component ─────────────────────────────────────────────────── */

export default function ExpensesView() {
  const { entries, addEntry, removeEntry } = useSpending();
  const { bills, billPayments, addBill, removeBill, togglePaid } = useBills();
  const { goalDeposits } = useGoals();
  const { accountSync, lastSyncedAt } = useAccountSync();
  const { categories: syncedCategories } = useCategories();

  /** Find emoji & color for a category name from synced categories */
  const getCategoryInfo = useCallback((catName: string): { emoji: string; color: string } => {
    if (!catName) return { emoji: "", color: "" };
    const found = syncedCategories.find((c) => c.name === catName);
    return found ? { emoji: found.emoji, color: found.color } : { emoji: "", color: "" };
  }, [syncedCategories]);

  const [section, setSection] = useState<Section>("discretionary");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("month");

  /* ── Discretionary form state ────────────────────────────────── */
  const [showSpendForm, setShowSpendForm] = useState(false);
  const [spendTitle, setSpendTitle] = useState("");
  const [spendAmount, setSpendAmount] = useState("");
  const [spendCategory, setSpendCategory] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  /* ── Bills form state ────────────────────────────────────────── */
  const [showBillForm, setShowBillForm] = useState(false);
  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDueDay, setBillDueDay] = useState("");
  const [billFrequency, setBillFrequency] = useState<BillFrequency>("monthly");
  const [billCategory, setBillCategory] = useState("Utilities");
  const [billChargeToAccountId, setBillChargeToAccountId] = useState("");

  /* ── Credit card accounts for bill charge dropdown ──────────── */
  const creditAccounts = useMemo(() => {
    if (!accountSync) return [];
    return accountSync.financialAccounts.filter(
      (a) => a.type.toLowerCase() === "credit" || a.type.toLowerCase() === "credit card"
    );
  }, [accountSync]);

  /* ── Auto-suggest from past titles ──────────────────────────── */
  const pastTitles = useMemo(() => {
    const titles = Array.from(new Set(entries.map((e) => e.title)));
    return titles.sort();
  }, [entries]);

  const filteredSuggestions = useMemo(() => {
    if (!spendTitle.trim()) return [];
    return pastTitles.filter((t) =>
      t.toLowerCase().includes(spendTitle.toLowerCase())
    );
  }, [spendTitle, pastTitles]);

  /* ── Filter by time period helper ───────────────────────────── */
  const isInPeriod = useCallback(
    (dateStr: string) => {
      if (timePeriod === "all") return true;
      const now = new Date();
      const d = new Date(dateStr);
      if (timePeriod === "week") {
        return d >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
      if (timePeriod === "month") {
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      }
      if (timePeriod === "year") {
        return d.getFullYear() === now.getFullYear();
      }
      return true;
    },
    [timePeriod]
  );

  /* ── Filtered data ──────────────────────────────────────────── */
  const filteredSpending = useMemo(
    () => entries.filter((e) => isInPeriod(e.date)),
    [entries, isInPeriod]
  );

  const filteredBillPayments = useMemo(
    () => billPayments.filter((p) => isInPeriod(p.date)),
    [billPayments, isInPeriod]
  );

  const filteredGoalDeposits = useMemo(
    () => goalDeposits.filter((d) => isInPeriod(d.date)),
    [goalDeposits, isInPeriod]
  );

  /* ── Totals ─────────────────────────────────────────────────── */
  const totalDiscretionary = useMemo(
    () => filteredSpending.reduce((sum, e) => sum + e.amount, 0),
    [filteredSpending]
  );

  const totalBillPayments = useMemo(
    () => filteredBillPayments.reduce((sum, p) => sum + p.amount, 0),
    [filteredBillPayments]
  );

  const totalGoalDeposits = useMemo(
    () => filteredGoalDeposits.reduce((sum, d) => sum + d.amount, 0),
    [filteredGoalDeposits]
  );

  /* ── Pie chart data (goals vs discretionary vs bills) ───────── */
  const pieData = useMemo(() => {
    const data = [];
    if (totalGoalDeposits > 0)
      data.push({ name: "Goals", value: Math.round(totalGoalDeposits * 100) / 100 });
    if (totalDiscretionary > 0)
      data.push({ name: "Discretionary", value: Math.round(totalDiscretionary * 100) / 100 });
    if (totalBillPayments > 0)
      data.push({ name: "Bills", value: Math.round(totalBillPayments * 100) / 100 });
    return data;
  }, [totalGoalDeposits, totalDiscretionary, totalBillPayments]);

  const grandTotal = totalGoalDeposits + totalDiscretionary + totalBillPayments;

  /* ── Sorted bills: unpaid first, then by due day ────────────── */
  const sortedBills = useMemo(
    () =>
      [...bills].sort((a, b) => {
        if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
        return a.dueDay - b.dueDay;
      }),
    [bills]
  );

  const totalMonthlyBills = useMemo(
    () =>
      bills.reduce((sum, b) => {
        if (b.frequency === "weekly") return sum + b.amount * 4.33;
        if (b.frequency === "biweekly") return sum + b.amount * 2.17;
        if (b.frequency === "monthly") return sum + b.amount;
        if (b.frequency === "yearly") return sum + b.amount / 12;
        return sum;
      }, 0),
    [bills]
  );

  const unpaidCount = useMemo(() => bills.filter((b) => !b.isPaid).length, [bills]);

  /* ── Handlers ───────────────────────────────────────────────── */
  const handleAddSpending = useCallback(() => {
    const amt = parseFloat(spendAmount);
    if (!spendTitle.trim() || !amt || amt <= 0) return;
    addEntry({
      title: spendTitle.trim(),
      amount: amt,
      date: new Date().toISOString(),
      category: spendCategory || undefined,
    });
    setSpendTitle("");
    setSpendAmount("");
    setSpendCategory("");
    setShowSpendForm(false);
  }, [spendTitle, spendAmount, spendCategory, addEntry]);

  const handleAddBill = useCallback(() => {
    const amt = parseFloat(billAmount);
    const day = parseInt(billDueDay);
    if (!billName.trim() || !amt || amt <= 0 || !day || day < 1 || day > 31) return;
    addBill({
      name: billName.trim(),
      amount: amt,
      dueDay: day,
      frequency: billFrequency,
      category: billCategory,
      isPaid: false,
      chargeToAccountId: billChargeToAccountId || undefined,
    });
    setBillName("");
    setBillAmount("");
    setBillDueDay("");
    setBillChargeToAccountId("");
    setShowBillForm(false);
  }, [billName, billAmount, billDueDay, billFrequency, billCategory, billChargeToAccountId, addBill]);

  return (
    <div className="px-4 pb-28">
      {/* ── Time period filter ──────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-3.5 h-3.5 text-muted" />
        {(["week", "month", "year", "all"] as TimePeriod[]).map((period) => (
          <button
            key={period}
            onClick={() => setTimePeriod(period)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              timePeriod === period
                ? "bg-accent/20 text-accent border border-accent/30"
                : "bg-surface/40 text-muted hover:text-foreground border border-transparent"
            }`}
          >
            {period === "all" ? "All Time" : period.charAt(0).toUpperCase() + period.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Pie Chart: Money Allocation ─────────────────────── */}
      {pieData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface/60 rounded-2xl p-4 border border-white/5 mb-4"
        >
          <p className="text-xs text-muted uppercase tracking-wider mb-1">Money Allocation</p>
          <p className="text-2xl font-bold text-foreground font-mono mb-3">
            ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {pieData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS] || "#71717a"}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#0f0f14",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  fontSize: "12px",
                  color: "#e4e4e7",
                }}
                formatter={(value) => [`$${Number(value).toFixed(2)}`, ""]}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span style={{ color: "#a1a1aa", fontSize: "11px" }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Breakdown bars */}
          <div className="space-y-2 mt-2">
            {pieData.map((item) => {
              const pct = grandTotal > 0 ? (item.value / grandTotal) * 100 : 0;
              return (
                <div key={item.name} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: PIE_COLORS[item.name as keyof typeof PIE_COLORS] }}
                  />
                  <span className="text-sm flex-1">{item.name}</span>
                  <span className="text-sm font-mono text-accent-soft">${item.value.toFixed(2)}</span>
                  <span className="text-xs text-muted w-12 text-right">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Section toggle: Discretionary / Bills / Accounts ── */}
      <div className="flex items-center bg-surface/60 rounded-xl p-1 mb-4 max-w-md mx-auto relative">
        {(
          [
            { id: "discretionary" as Section, label: "Discretionary", icon: TrendingDown, color: "#38bdf8" },
            { id: "bills" as Section, label: "Bills", icon: Receipt, color: "#22c55e" },
            { id: "accounts" as Section, label: "Accounts", icon: CreditCard, color: "#f59e0b" },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = section === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSection(tab.id)}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-colors z-10 ${
                isActive ? "text-foreground" : "text-muted hover:text-foreground/70"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="expense-tab-indicator"
                  className="absolute inset-0 rounded-lg border"
                  style={{
                    backgroundColor: `${tab.color}20`,
                    borderColor: `${tab.color}40`,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════
       *  DISCRETIONARY SECTION
       * ═══════════════════════════════════════════════════════ */}
      {section === "discretionary" && (
        <motion.div
          key="disc"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
        >
          {/* Summary */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface/60 rounded-2xl p-5 border border-white/5 mb-4"
          >
            <p className="text-xs text-muted uppercase tracking-wider mb-1">Total Discretionary</p>
            <p className="text-3xl font-bold font-mono" style={{ color: "#38bdf8" }}>
              ${totalDiscretionary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted mt-1">{filteredSpending.length} transaction(s)</p>
          </motion.div>

          {/* Transaction list */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-widest text-muted">Recent Spending</h3>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowSpendForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ backgroundColor: "rgba(56,189,248,0.2)", color: "#38bdf8" }}
            >
              <Plus className="w-3 h-3" /> Add
            </motion.button>
          </div>

          {filteredSpending.length === 0 && (
            <p className="text-sm text-muted py-8 text-center">No spending recorded yet.</p>
          )}

          <div className="space-y-1.5">
            {[...filteredSpending]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 50)
              .map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 bg-surface/30 rounded-xl px-4 py-2.5 border border-white/5"
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: "#38bdf8" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{entry.title}</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] text-muted">
                        {new Date(entry.date).toLocaleDateString()}
                      </p>
                      {entry.category && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: getCategoryInfo(entry.category).color
                              ? getCategoryInfo(entry.category).color + "20"
                              : "rgba(255,255,255,0.05)",
                            color: getCategoryInfo(entry.category).color || "var(--text-muted)",
                          }}
                        >
                          {getCategoryInfo(entry.category).emoji} {entry.category}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-mono" style={{ color: "#38bdf8" }}>
                    -${entry.amount.toFixed(2)}
                  </span>
                  <button
                    onClick={() => removeEntry(entry.id)}
                    className="p-1 text-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════
       *  BILLS SECTION
       * ═══════════════════════════════════════════════════════ */}
      {section === "bills" && (
        <motion.div
          key="bills"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface/60 rounded-2xl p-4 border border-white/5"
            >
              <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Monthly Bills</p>
              <p className="text-2xl font-bold font-mono" style={{ color: "#22c55e" }}>
                ${totalMonthlyBills.toFixed(0)}
              </p>
              <p className="text-[10px] text-muted mt-0.5">{bills.length} bill(s)</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-surface/60 rounded-2xl p-4 border border-white/5"
            >
              <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Status</p>
              <p className="text-2xl font-bold text-foreground font-mono">{unpaidCount}</p>
              <p className="text-[10px] text-muted mt-0.5">unpaid</p>
            </motion.div>
          </div>

          {/* Bills list */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-widest text-muted">Your Bills</h3>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowBillForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ backgroundColor: "rgba(34,197,94,0.2)", color: "#22c55e" }}
            >
              <Plus className="w-3 h-3" /> Add
            </motion.button>
          </div>

          {sortedBills.length === 0 && (
            <p className="text-sm text-muted py-12 text-center">No bills yet. Add your first bill!</p>
          )}

          <div className="space-y-2">
            {sortedBills.map((bill) => (
              <motion.div
                key={bill.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors ${
                  bill.isPaid
                    ? "bg-surface/20 border-white/3 opacity-60"
                    : "bg-surface/50 border-white/5"
                }`}
              >
                <motion.button
                  whileTap={{ scale: 0.8 }}
                  onClick={() => togglePaid(bill.id)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    bill.isPaid
                      ? "bg-green-500/20 text-green-400 border border-green-500/40"
                      : "bg-surface/60 text-muted border border-white/10 hover:border-green-500/40"
                  }`}
                >
                  {bill.isPaid ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                </motion.button>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${bill.isPaid ? "line-through text-muted" : ""}`}>
                    {bill.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted flex items-center gap-0.5">
                      <CalendarDays className="w-2.5 h-2.5" /> Due: {bill.dueDay}
                      {getOrdinal(bill.dueDay)}
                    </span>
                    <span className="text-[10px] text-muted flex items-center gap-0.5">
                      <RefreshCw className="w-2.5 h-2.5" /> {FREQUENCY_LABELS[bill.frequency]}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface/60 text-muted">
                      {bill.category}
                    </span>
                    {bill.chargeToAccountId && (() => {
                      const acc = creditAccounts.find((a) => a.id === bill.chargeToAccountId);
                      return acc ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
                          💳 {acc.name}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>

                <span className={`text-sm font-mono shrink-0 ${bill.isPaid ? "text-muted" : ""}`} style={{ color: bill.isPaid ? undefined : "#22c55e" }}>
                  ${bill.amount.toFixed(2)}
                </span>

                <button
                  onClick={() => removeBill(bill.id)}
                  className="p-1 text-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════
       *  ACCOUNTS / CREDIT SECTION (synced from Trading Journal)
       * ═══════════════════════════════════════════════════════ */}
      {section === "accounts" && (
        <motion.div
          key="accounts"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          {/* Sync status banner */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface/60 rounded-2xl p-4 border border-amber-500/10 mb-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(245,158,11,0.15)" }}
              >
                <ArrowRightLeft className="w-4 h-4" style={{ color: "#f59e0b" }} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">Synced from Trading Journal</p>
                {lastSyncedAt ? (
                  <p className="text-[10px] text-muted flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    Last sync: {new Date(lastSyncedAt).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-[10px] text-muted">Not yet synced — open the Trading Journal app</p>
                )}
              </div>
            </div>
          </motion.div>

          {!accountSync || accountSync.financialAccounts.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-10 h-10 text-muted mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted">No accounts synced yet.</p>
              <p className="text-xs text-muted/60 mt-1">
                Open the Trading Journal desktop app to sync your financial accounts.
              </p>
            </div>
          ) : (
            <>
              {/* Net Worth Summary */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface/60 rounded-2xl p-5 border border-white/5 mb-4"
              >
                <p className="text-xs text-muted uppercase tracking-wider mb-1">Total Balance</p>
                <p className="text-3xl font-bold font-mono" style={{ color: "#f59e0b" }}>
                  ${accountSync.financialAccounts
                    .reduce((sum, a) => sum + a.balance, 0)
                    .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted mt-1">
                  {accountSync.financialAccounts.length} account(s)
                </p>
              </motion.div>

              {/* Financial accounts list */}
              <h3 className="text-xs uppercase tracking-widest text-muted mb-3">Financial Accounts</h3>
              <div className="space-y-2 mb-6">
                {accountSync.financialAccounts.map((acct) => (
                  <AccountCard key={acct.id} account={acct} />
                ))}
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════
       *  ADD SPENDING MODAL
       * ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showSpendForm && (
          <>
            <motion.div
              key="spend-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowSpendForm(false); setShowSuggestions(false); }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              key="spend-modal"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed inset-x-4 bottom-8 z-50 max-w-sm mx-auto bg-surface rounded-2xl p-5 border border-white/5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: "#38bdf8" }}>Add Expense</h3>
                <button onClick={() => setShowSpendForm(false)} className="text-muted hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Title with auto-suggest */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="What did you spend on?"
                    value={spendTitle}
                    onChange={(e) => {
                      setSpendTitle(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    className="w-full bg-background/60 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none border border-white/5 focus:border-sky-400/40 transition-colors"
                  />
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-surface rounded-xl border border-white/10 overflow-hidden z-10 max-h-32 overflow-y-auto">
                      {filteredSuggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => {
                            setSpendTitle(s);
                            setShowSuggestions(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-white/5 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Amount ($)"
                  value={spendAmount}
                  onChange={(e) => setSpendAmount(e.target.value)}
                  className="w-full bg-background/60 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none border border-white/5 focus:border-sky-400/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />

                {/* Category selector (from synced categories) */}
                {syncedCategories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSpendCategory("")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                        !spendCategory
                          ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                          : "bg-surface/60 text-muted hover:text-foreground border border-transparent"
                      }`}
                    >
                      None
                    </button>
                    {syncedCategories.map((cat) => (
                      <button
                        key={cat.name}
                        onClick={() => setSpendCategory(cat.name)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                          spendCategory === cat.name
                            ? "border"
                            : "bg-surface/60 text-muted hover:text-foreground border border-transparent"
                        }`}
                        style={
                          spendCategory === cat.name
                            ? { backgroundColor: cat.color + "20", color: cat.color, borderColor: cat.color + "50" }
                            : undefined
                        }
                      >
                        {cat.emoji} {cat.name}
                      </button>
                    ))}
                  </div>
                )}

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAddSpending}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors"
                  style={{ backgroundColor: "rgba(56,189,248,0.2)", color: "#38bdf8" }}
                >
                  <Plus className="w-4 h-4" /> Add Expense
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
       *  ADD BILL MODAL
       * ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showBillForm && (
          <>
            <motion.div
              key="bill-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBillForm(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              key="bill-modal"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed inset-x-4 bottom-8 z-50 max-w-sm mx-auto bg-surface rounded-2xl p-5 border border-white/5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: "#22c55e" }}>Add Bill</h3>
                <button onClick={() => setShowBillForm(false)} className="text-muted hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Bill name"
                  value={billName}
                  onChange={(e) => setBillName(e.target.value)}
                  className="w-full bg-background/60 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none border border-white/5 focus:border-green-400/40 transition-colors"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="Amount ($)"
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    className="flex-1 bg-background/60 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none border border-white/5 focus:border-green-400/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Due day"
                    value={billDueDay}
                    onChange={(e) => setBillDueDay(e.target.value)}
                    min={1}
                    max={31}
                    className="w-24 bg-background/60 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none border border-white/5 focus:border-green-400/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>

                {/* Frequency */}
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(FREQUENCY_LABELS) as BillFrequency[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setBillFrequency(f)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                        billFrequency === f
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : "bg-surface/60 text-muted hover:text-foreground border border-transparent"
                      }`}
                    >
                      {FREQUENCY_LABELS[f]}
                    </button>
                  ))}
                </div>

                {/* Category */}
                <div className="flex flex-wrap gap-1.5">
                  {BILL_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setBillCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                        billCategory === cat
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : "bg-surface/60 text-muted hover:text-foreground border border-transparent"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Charge to credit card */}
                {creditAccounts.length > 0 && (
                  <div>
                    <p className="text-[11px] text-muted mb-1.5">Charge to credit card</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setBillChargeToAccountId("")}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                          !billChargeToAccountId
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "bg-surface/60 text-muted hover:text-foreground border border-transparent"
                        }`}
                      >
                        None
                      </button>
                      {creditAccounts.map((acc) => (
                        <button
                          key={acc.id}
                          onClick={() => setBillChargeToAccountId(acc.id)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                            billChargeToAccountId === acc.id
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : "bg-surface/60 text-muted hover:text-foreground border border-transparent"
                          }`}
                        >
                          💳 {acc.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAddBill}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors"
                  style={{ backgroundColor: "rgba(34,197,94,0.2)", color: "#22c55e" }}
                >
                  <Plus className="w-4 h-4" /> Add Bill
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Helper ────────────────────────────────────────────────────── */
function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/* ── AccountCard sub-component ─────────────────────────────────── */
const ACCOUNT_TYPE_ICON: Record<string, { icon: typeof Wallet; bg: string; fg: string }> = {
  credit: { icon: CreditCard, bg: "rgba(239,68,68,0.15)", fg: "#ef4444" },
  "credit card": { icon: CreditCard, bg: "rgba(239,68,68,0.15)", fg: "#ef4444" },
  savings: { icon: Wallet, bg: "rgba(34,197,94,0.15)", fg: "#22c55e" },
  chequing: { icon: Building2, bg: "rgba(56,189,248,0.15)", fg: "#38bdf8" },
  checking: { icon: Building2, bg: "rgba(56,189,248,0.15)", fg: "#38bdf8" },
};

function AccountCard({ account }: { account: SyncedFinancialAccount }) {
  const typeLower = account.type.toLowerCase();
  const meta = ACCOUNT_TYPE_ICON[typeLower] || { icon: Wallet, bg: "rgba(245,158,11,0.15)", fg: "#f59e0b" };
  const Icon = meta.icon;
  const isCredit = typeLower.includes("credit");
  const displayBalance = isCredit ? -account.balance : account.balance;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 bg-surface/30 rounded-xl px-4 py-3 border border-white/5"
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: meta.bg }}
      >
        <Icon className="w-4 h-4" style={{ color: meta.fg }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{account.name}</p>
        <p className="text-[10px] text-muted capitalize">{account.type}</p>
      </div>
      <span
        className="text-sm font-mono shrink-0"
        style={{ color: displayBalance < 0 ? "#ef4444" : meta.fg }}
      >
        {displayBalance < 0 ? "-" : ""}${Math.abs(displayBalance).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </span>
    </motion.div>
  );
}
