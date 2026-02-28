/**
 * FundingInbox.tsx  –  Unallocated Funds Holding Area
 * ─────────────────────────────────────────────────────
 * Displays deposits pushed from the Trading Journal that haven't been
 * allocated yet. The user can allocate each deposit (or a portion) to
 * a specific goal, expense, or bill directly from this inbox.
 *
 * Shown as a collapsible banner at the top of the Goals page when
 * there are pending deposits.
 */

"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Inbox, ChevronDown, ChevronUp, ArrowRight, Target, Receipt, CreditCard, X } from "lucide-react";
import { useUnallocatedFunds, useGoals, useSpending, useBills } from "@/lib/store";

type AllocTarget = "goal" | "expense" | "bill";

interface AllocState {
  depositId: string;
  target: AllocTarget;
  amount: string;
  goalId: string;
  expenseTitle: string;
  billId: string;
}

const EMPTY_ALLOC: AllocState = {
  depositId: "",
  target: "goal",
  amount: "",
  goalId: "",
  expenseTitle: "",
  billId: "",
};

export default function FundingInbox() {
  const { deposits, totalUnallocated, allocateDeposit, removeDeposit } = useUnallocatedFunds();
  const { goals, addFunds, addFundsToGoal, addFundsToSideGoal } = useGoals();
  const { addEntry } = useSpending();
  const { bills, togglePaid } = useBills();

  const [expanded, setExpanded] = useState(true);
  const [alloc, setAlloc] = useState<AllocState>(EMPTY_ALLOC);
  const [successId, setSuccessId] = useState<string | null>(null);

  /* Build goal options for allocation dropdown */
  const goalOptions = useMemo(() => {
    const sorted = [...goals].sort((a, b) => a.orderIndex - b.orderIndex);
    const opts: { id: string; label: string; remaining: number; parentId?: string; isSide?: boolean }[] = [
      { id: "auto", label: "Auto-fill (chain)", remaining: 0 },
    ];
    sorted.forEach((g) => {
      const rem = g.targetAmount - g.currentAmount;
      if (rem > 0) opts.push({ id: g.id, label: g.title, remaining: rem });
      (g.sideGoals || []).forEach((sg) => {
        const sgRem = sg.targetAmount - sg.currentAmount;
        if (sgRem > 0)
          opts.push({
            id: sg.id,
            label: `↳ ${sg.title}`,
            remaining: sgRem,
            parentId: g.id,
            isSide: true,
          });
      });
    });
    return opts;
  }, [goals]);

  const unpaidBills = useMemo(() => bills.filter((b) => !b.isPaid), [bills]);

  /* Start allocating a specific deposit */
  const startAlloc = useCallback((depositId: string, depositAmount: number) => {
    setAlloc({
      ...EMPTY_ALLOC,
      depositId,
      amount: depositAmount.toFixed(2),
      goalId: goalOptions.length > 1 ? goalOptions[1].id : "auto",
    });
  }, [goalOptions]);

  /* Confirm the allocation */
  const confirmAlloc = useCallback(() => {
    const amount = parseFloat(alloc.amount);
    if (!amount || amount <= 0) return;

    switch (alloc.target) {
      case "goal": {
        const opt = goalOptions.find((o) => o.id === alloc.goalId);
        if (alloc.goalId === "auto") {
          addFunds(amount);
        } else if (opt?.isSide && opt.parentId) {
          addFundsToSideGoal(opt.parentId, opt.id, amount);
        } else {
          addFundsToGoal(alloc.goalId, amount);
        }
        break;
      }
      case "expense": {
        addEntry({
          title: alloc.expenseTitle || "Trading Journal Payout",
          amount,
          date: new Date().toISOString(),
        });
        break;
      }
      case "bill": {
        if (alloc.billId) {
          togglePaid(alloc.billId);
        }
        break;
      }
    }

    // Reduce or remove the deposit
    allocateDeposit(alloc.depositId, amount);

    // Show success flash
    setSuccessId(alloc.depositId);
    setTimeout(() => setSuccessId(null), 1200);

    // Reset allocation form
    setAlloc(EMPTY_ALLOC);
  }, [alloc, goalOptions, addFunds, addFundsToGoal, addFundsToSideGoal, addEntry, togglePaid, allocateDeposit]);

  if (deposits.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mb-4"
    >
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 rounded-2xl border border-amber-500/20 overflow-hidden">
        {/* ── Header ─────────────────────────────────────────────── */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Inbox className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-sm font-semibold text-amber-300">
                Unallocated Funds
              </span>
              <span className="text-xs text-amber-400/70 ml-2">
                {deposits.length} deposit{deposits.length !== 1 ? "s" : ""} &middot; CA$
                {totalUnallocated.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-amber-400/60" />
          ) : (
            <ChevronDown className="w-4 h-4 text-amber-400/60" />
          )}
        </button>

        {/* ── Deposit list ───────────────────────────────────────── */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-2">
                {deposits.map((dep) => (
                  <motion.div
                    key={dep.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className={`relative bg-surface/60 rounded-xl border transition-colors ${
                      successId === dep.id
                        ? "border-green-500/40 bg-green-500/10"
                        : "border-white/5"
                    }`}
                  >
                    {/* Deposit row */}
                    <div className="flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-base font-bold text-amber-300">
                            CA${dep.amountCAD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                          {dep.amountUSD > 0 && (
                            <span className="text-[10px] text-muted">
                              (US${dep.amountUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })})
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted truncate">
                          {dep.source} &middot; {dep.date}
                          {dep.note ? ` — ${dep.note}` : ""}
                        </div>
                      </div>

                      {/* Allocate button */}
                      {alloc.depositId !== dep.id && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => startAlloc(dep.id, dep.amountCAD)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 text-amber-300 text-xs font-medium rounded-lg hover:bg-amber-500/30 transition-colors"
                          >
                            <ArrowRight className="w-3 h-3" />
                            Allocate
                          </button>
                          <button
                            onClick={() => removeDeposit(dep.id)}
                            className="p-1.5 text-muted hover:text-red-400 transition-colors"
                            title="Dismiss deposit"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Allocation form (inline, shown when "Allocate" is clicked) */}
                    <AnimatePresence>
                      {alloc.depositId === dep.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 pt-1 space-y-2 border-t border-white/5">
                            {/* Target type selector */}
                            <div className="flex gap-1">
                              {([
                                { type: "goal" as AllocTarget, icon: Target, label: "Goal" },
                                { type: "expense" as AllocTarget, icon: Receipt, label: "Expense" },
                                { type: "bill" as AllocTarget, icon: CreditCard, label: "Bill" },
                              ]).map(({ type, icon: Icon, label }) => (
                                <button
                                  key={type}
                                  onClick={() => setAlloc((a) => ({ ...a, target: type }))}
                                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                                    alloc.target === type
                                      ? "bg-accent/20 text-accent border border-accent/30"
                                      : "bg-surface/40 text-muted hover:text-foreground/70 border border-transparent"
                                  }`}
                                >
                                  <Icon className="w-3 h-3" />
                                  {label}
                                </button>
                              ))}
                            </div>

                            {/* Target-specific selector */}
                            {alloc.target === "goal" && (
                              <select
                                value={alloc.goalId}
                                onChange={(e) => setAlloc((a) => ({ ...a, goalId: e.target.value }))}
                                className="w-full bg-surface/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-foreground"
                              >
                                {goalOptions.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.label}
                                    {o.remaining > 0 ? ` ($${o.remaining.toLocaleString()} left)` : ""}
                                  </option>
                                ))}
                              </select>
                            )}

                            {alloc.target === "expense" && (
                              <input
                                type="text"
                                value={alloc.expenseTitle}
                                onChange={(e) => setAlloc((a) => ({ ...a, expenseTitle: e.target.value }))}
                                placeholder="Expense label (e.g. Trading Software)"
                                className="w-full bg-surface/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted"
                              />
                            )}

                            {alloc.target === "bill" && (
                              <select
                                value={alloc.billId}
                                onChange={(e) => setAlloc((a) => ({ ...a, billId: e.target.value }))}
                                className="w-full bg-surface/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-foreground"
                              >
                                <option value="">Select bill…</option>
                                {unpaidBills.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.name} — ${b.amount.toFixed(2)}
                                  </option>
                                ))}
                              </select>
                            )}

                            {/* Amount + confirm/cancel */}
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 flex-1 bg-surface/80 border border-white/10 rounded-lg px-3 py-1.5">
                                <span className="text-xs text-muted">$</span>
                                <input
                                  type="number"
                                  value={alloc.amount}
                                  onChange={(e) => setAlloc((a) => ({ ...a, amount: e.target.value }))}
                                  className="flex-1 bg-transparent text-xs text-foreground outline-none
                                             [appearance:textfield]
                                             [&::-webkit-inner-spin-button]:appearance-none
                                             [&::-webkit-outer-spin-button]:appearance-none"
                                  step="0.01"
                                  min="0"
                                  max={dep.amountCAD}
                                />
                              </div>
                              <button
                                onClick={confirmAlloc}
                                disabled={
                                  !parseFloat(alloc.amount) ||
                                  (alloc.target === "bill" && !alloc.billId)
                                }
                                className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setAlloc(EMPTY_ALLOC)}
                                className="px-2 py-1.5 text-muted text-xs hover:text-foreground transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
