/**
 * SettingsView.tsx  –  Goal Management + Fund Allocation + Admin Panel
 * -----------------------------------------------------
 * Slide-over panel with:
 *  1. Unallocated Funds allocation editor
 *  2. Add Goal form
 *  3. Reorder/delete goals (drag-and-drop)
 *  4. Admin section (only for admin accounts): manage all login routes
 *  5. Logout button
 */

"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { X, Plus, Trash2, GripVertical, LogOut, Shield, Key, Inbox, ArrowRight, Target, Receipt, CreditCard, DollarSign } from "lucide-react";
import { useGoals, useUnallocatedFunds, useSpending, useBills } from "@/lib/store";
import { loadRoutes, saveRoutes } from "@/lib/store";
import { Goal, AuthSession, LetterRoute } from "@/lib/types";

type AllocTarget = "goal" | "expense" | "bill";

interface SettingsViewProps {
  isOpen: boolean;
  onClose: () => void;
  session: AuthSession;
  onLogout: () => void;
}

export default function SettingsView({ isOpen, onClose, session, onLogout }: SettingsViewProps) {
  const { goals, setGoals, addGoal, removeGoal, addFunds, addFundsToGoal, addFundsToSideGoal } = useGoals();
  const { deposits, totalUnallocated, allocateDeposit, removeDeposit } = useUnallocatedFunds();
  const { addEntry } = useSpending();
  const { bills, togglePaid } = useBills();

  const [orderedGoals, setOrderedGoals] = useState<Goal[]>([]);
  useEffect(() => {
    setOrderedGoals([...goals].sort((a, b) => a.orderIndex - b.orderIndex));
  }, [goals, isOpen]);

  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");

  /* ── Allocation editor state ────────────────────────────────── */
  const [allocDepositId, setAllocDepositId] = useState<string>("");
  const [allocTarget, setAllocTarget] = useState<AllocTarget>("goal");
  const [allocAmount, setAllocAmount] = useState("");
  const [allocGoalId, setAllocGoalId] = useState("");
  const [allocExpenseTitle, setAllocExpenseTitle] = useState("");
  const [allocBillId, setAllocBillId] = useState("");
  const [allocSuccess, setAllocSuccess] = useState<string | null>(null);

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
          opts.push({ id: sg.id, label: `↳ ${sg.title}`, remaining: sgRem, parentId: g.id, isSide: true });
      });
    });
    return opts;
  }, [goals]);

  const unpaidBills = useMemo(() => bills.filter((b) => !b.isPaid), [bills]);

  const startAllocDeposit = useCallback((depId: string, amount: number) => {
    setAllocDepositId(depId);
    setAllocAmount(amount.toFixed(2));
    setAllocGoalId(goalOptions.length > 1 ? goalOptions[1].id : "auto");
    setAllocTarget("goal");
    setAllocExpenseTitle("");
    setAllocBillId("");
  }, [goalOptions]);

  const confirmAllocation = useCallback(() => {
    const amount = parseFloat(allocAmount);
    if (!amount || amount <= 0 || !allocDepositId) return;

    switch (allocTarget) {
      case "goal": {
        const opt = goalOptions.find((o) => o.id === allocGoalId);
        if (allocGoalId === "auto") {
          addFunds(amount);
        } else if (opt?.isSide && opt.parentId) {
          addFundsToSideGoal(opt.parentId, opt.id, amount);
        } else {
          addFundsToGoal(allocGoalId, amount);
        }
        break;
      }
      case "expense": {
        addEntry({
          title: allocExpenseTitle || "Trading Journal Payout",
          amount,
          date: new Date().toISOString(),
        });
        break;
      }
      case "bill": {
        if (allocBillId) togglePaid(allocBillId);
        break;
      }
    }

    allocateDeposit(allocDepositId, amount);
    setAllocSuccess(allocDepositId);
    setTimeout(() => setAllocSuccess(null), 1500);
    setAllocDepositId("");
    setAllocAmount("");
  }, [allocAmount, allocDepositId, allocTarget, allocGoalId, allocExpenseTitle, allocBillId, goalOptions, addFunds, addFundsToGoal, addFundsToSideGoal, addEntry, togglePaid, allocateDeposit]);

  /* ── Admin: routes management ───────────────────────────────── */
  const [routes, setRoutes] = useState<LetterRoute[]>([]);
  const [newRouteLetter, setNewRouteLetter] = useState("");
  const [newRouteCode, setNewRouteCode] = useState("");
  const [newRouteLabel, setNewRouteLabel] = useState("");

  useEffect(() => {
    if (isOpen && session.isAdmin) {
      setRoutes(loadRoutes());
    }
  }, [isOpen, session.isAdmin]);

  const handleAddGoal = useCallback(() => {
    const amount = parseFloat(newAmount);
    if (!newTitle.trim() || !amount || amount <= 0) return;
    addGoal(newTitle.trim(), amount);
    setNewTitle("");
    setNewAmount("");
  }, [newTitle, newAmount, addGoal]);

  const handleClose = useCallback(() => {
    const reindexed = orderedGoals.map((g, i) => ({ ...g, orderIndex: i }));
    setGoals(reindexed);
    onClose();
  }, [orderedGoals, setGoals, onClose]);

  const handleAddRoute = useCallback(() => {
    const letter = newRouteLetter.toUpperCase().trim();
    const code = newRouteCode.trim();
    const label = newRouteLabel.trim();
    if (!letter || letter.length !== 1 || !/[A-Z]/.test(letter)) return;
    if (!code || code.length !== 4 || !/^\d{4}$/.test(code)) return;
    if (!label) return;

    const updated = [...routes];
    const existing = updated.find((r) => r.letter === letter);
    if (existing) {
      if (existing.codes.find((c) => c.code === code)) return; // duplicate
      existing.codes.push({ code, label });
    } else {
      updated.push({ letter, codes: [{ code, label }] });
    }
    updated.sort((a, b) => a.letter.localeCompare(b.letter));
    setRoutes(updated);
    saveRoutes(updated);
    setNewRouteLetter("");
    setNewRouteCode("");
    setNewRouteLabel("");
  }, [newRouteLetter, newRouteCode, newRouteLabel, routes]);

  const handleRemoveRoute = useCallback(
    (letter: string, code: string) => {
      // Prevent removing the admin account
      if (letter === "A" && code === "1598") return;
      const updated = routes
        .map((r) => {
          if (r.letter !== letter) return r;
          return { ...r, codes: r.codes.filter((c) => c.code !== code) };
        })
        .filter((r) => r.codes.length > 0);
      setRoutes(updated);
      saveRoutes(updated);
    },
    [routes]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l border-white/5 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-6 pb-4">
              <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={handleClose}
                className="p-2 rounded-xl bg-surface/60 text-muted hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 pb-32">

              {/* ─── Unallocated Funds ─────────────────────────── */}
              {deposits.length > 0 && (
                <section className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <Inbox className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs uppercase tracking-widest text-amber-400">
                      Unallocated Funds
                    </h3>
                    <span className="ml-auto text-sm font-semibold text-amber-300">
                      ${totalUnallocated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {deposits.map((dep) => {
                      const isEditing = allocDepositId === dep.id;
                      const justDone = allocSuccess === dep.id;
                      return (
                        <div key={dep.id} className={`p-3 rounded-xl border transition-colors ${justDone ? "bg-green-500/10 border-green-500/30" : "bg-surface/40 border-white/5"}`}>
                          {/* deposit summary row */}
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                ${dep.amountCAD.toFixed(2)} CAD
                                {dep.amountUSD ? ` / $${dep.amountUSD.toFixed(2)} USD` : ""}
                              </p>
                              <p className="text-[10px] text-muted truncate">
                                {dep.note || "Deposit"} · {new Date(dep.pushedAt || dep.date).toLocaleDateString()}
                              </p>
                            </div>
                            {!isEditing && (
                              <motion.button whileTap={{ scale: 0.9 }} onClick={() => startAllocDeposit(dep.id, dep.amountCAD)}
                                className="shrink-0 ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/15 text-amber-300 text-xs font-medium hover:bg-amber-400/25 transition-colors">
                                <ArrowRight className="w-3 h-3" /> Allocate
                              </motion.button>
                            )}
                          </div>

                          {/* inline allocation editor */}
                          {isEditing && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-3 space-y-2 overflow-hidden">
                              {/* target type tabs */}
                              <div className="flex gap-1 p-1 rounded-lg bg-background/60">
                                {([
                                  { key: "goal" as AllocTarget, icon: Target, label: "Goal" },
                                  { key: "expense" as AllocTarget, icon: Receipt, label: "Expense" },
                                  { key: "bill" as AllocTarget, icon: CreditCard, label: "Bill" },
                                ]).map(({ key, icon: Icon, label }) => (
                                  <button key={key} onClick={() => setAllocTarget(key)}
                                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-medium transition-colors ${allocTarget === key ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"}`}>
                                    <Icon className="w-3 h-3" /> {label}
                                  </button>
                                ))}
                              </div>

                              {/* goal selector */}
                              {allocTarget === "goal" && (
                                <select value={allocGoalId} onChange={(e) => setAllocGoalId(e.target.value)}
                                  className="w-full bg-background/60 rounded-lg px-3 py-2 text-xs text-foreground outline-none border border-white/5 focus:border-accent/40 transition-colors">
                                  {goalOptions.map((o) => (
                                    <option key={o.id} value={o.id}>
                                      {o.label}{o.remaining > 0 ? ` ($${o.remaining.toLocaleString()} left)` : ""}
                                    </option>
                                  ))}
                                </select>
                              )}

                              {/* expense title */}
                              {allocTarget === "expense" && (
                                <input type="text" placeholder="Expense title" value={allocExpenseTitle} onChange={(e) => setAllocExpenseTitle(e.target.value)}
                                  className="w-full bg-background/60 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted outline-none border border-white/5 focus:border-accent/40 transition-colors" />
                              )}

                              {/* bill selector */}
                              {allocTarget === "bill" && (
                                <select value={allocBillId} onChange={(e) => setAllocBillId(e.target.value)}
                                  className="w-full bg-background/60 rounded-lg px-3 py-2 text-xs text-foreground outline-none border border-white/5 focus:border-accent/40 transition-colors">
                                  <option value="">Select a bill…</option>
                                  {unpaidBills.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name} — ${b.amount.toFixed(2)}</option>
                                  ))}
                                  {unpaidBills.length === 0 && <option disabled>No unpaid bills</option>}
                                </select>
                              )}

                              {/* amount + action */}
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" />
                                  <input type="number" inputMode="decimal" value={allocAmount} onChange={(e) => setAllocAmount(e.target.value)}
                                    className="w-full bg-background/60 rounded-lg pl-7 pr-3 py-2 text-xs text-foreground outline-none border border-white/5 focus:border-accent/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                                </div>
                                <motion.button whileTap={{ scale: 0.92 }} onClick={confirmAllocation}
                                  className="px-4 py-2 rounded-lg bg-accent/20 text-accent text-xs font-medium hover:bg-accent/30 transition-colors">
                                  Confirm
                                </motion.button>
                                <button onClick={() => setAllocDepositId("")}
                                  className="px-2 py-2 rounded-lg text-muted hover:text-foreground text-xs transition-colors">
                                  Cancel
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* leave unallocated note */}
                  <p className="text-[10px] text-muted mt-2 text-center opacity-60">
                    Unallocated funds stay in memory until you allocate them.
                  </p>
                </section>
              )}

              {/* ─── Add Goal Form ──────────────────────────────── */}
              <section className="mb-8">
                <h3 className="text-xs uppercase tracking-widest text-muted mb-3">Add Goal</h3>
                <div className="space-y-3">
                  <input type="text" placeholder="Goal name" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-surface/60 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none border border-white/5 focus:border-accent/40 transition-colors" />
                  <input type="number" inputMode="decimal" placeholder="Target amount ($)" value={newAmount} onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full bg-surface/60 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none border border-white/5 focus:border-accent/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                  <motion.button whileTap={{ scale: 0.95 }} onClick={handleAddGoal}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent/20 text-accent text-sm font-medium hover:bg-accent/30 transition-colors">
                    <Plus className="w-4 h-4" /> Add Goal
                  </motion.button>
                </div>
              </section>

              {/* ─── Reorder List ───────────────────────────────── */}
              <section className="mb-8">
                <h3 className="text-xs uppercase tracking-widest text-muted mb-3">
                  Reorder Goals <span className="ml-2 normal-case text-[10px] opacity-60">(bottom → top)</span>
                </h3>
                {orderedGoals.length === 0 && (
                  <p className="text-sm text-muted py-8 text-center">No goals yet. Add one above!</p>
                )}
                <Reorder.Group axis="y" values={orderedGoals} onReorder={setOrderedGoals} className="space-y-2">
                  {orderedGoals.map((goal) => (
                    <Reorder.Item key={goal.id} value={goal}
                      className="flex items-center gap-3 bg-surface/50 rounded-xl px-4 py-3 border border-white/5 cursor-grab active:cursor-grabbing"
                      whileDrag={{ scale: 1.03, boxShadow: "0 8px 30px rgba(168,85,247,0.25)" }}>
                      <GripVertical className="w-4 h-4 text-muted shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{goal.title}</p>
                        <p className="text-xs text-muted">${goal.currentAmount.toLocaleString()} / ${goal.targetAmount.toLocaleString()}</p>
                        {(goal.sideGoals || []).length > 0 && (
                          <p className="text-[10px] text-yellow-500 mt-0.5">{goal.sideGoals!.length} side goal(s)</p>
                        )}
                      </div>
                      <motion.button whileTap={{ scale: 0.8 }} onClick={() => removeGoal(goal.id)}
                        className="p-2 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </section>

              {/* ─── Admin: Login Routes ────────────────────────── */}
              {session.isAdmin && (
                <section className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-accent" />
                    <h3 className="text-xs uppercase tracking-widest text-accent">Admin – Login Routes</h3>
                  </div>

                  {/* Add new route */}
                  <div className="space-y-2 mb-4 p-3 rounded-xl bg-surface/40 border border-accent/10">
                    <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Add New Login</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Letter"
                        value={newRouteLetter}
                        onChange={(e) => setNewRouteLetter(e.target.value.toUpperCase().slice(0, 1))}
                        maxLength={1}
                        className="w-14 bg-background/60 rounded-lg px-3 py-2 text-sm text-foreground text-center placeholder:text-muted outline-none border border-white/5 focus:border-accent/40 transition-colors"
                      />
                      <input
                        type="text"
                        placeholder="Code"
                        value={newRouteCode}
                        onChange={(e) => setNewRouteCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        maxLength={4}
                        className="w-20 bg-background/60 rounded-lg px-3 py-2 text-sm text-foreground text-center placeholder:text-muted outline-none border border-white/5 focus:border-accent/40 transition-colors"
                      />
                      <input
                        type="text"
                        placeholder="Account label"
                        value={newRouteLabel}
                        onChange={(e) => setNewRouteLabel(e.target.value)}
                        className="flex-1 bg-background/60 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none border border-white/5 focus:border-accent/40 transition-colors"
                      />
                    </div>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={handleAddRoute}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent/20 text-accent text-xs font-medium hover:bg-accent/30 transition-colors">
                      <Plus className="w-3 h-3" /> Add Route
                    </motion.button>
                  </div>

                  {/* Existing routes list */}
                  <div className="space-y-3">
                    {routes.map((route) => (
                      <div key={route.letter} className="p-3 rounded-xl bg-surface/30 border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                            <span className="text-sm font-bold text-accent">{route.letter}</span>
                          </div>
                          <span className="text-xs text-muted">Letter {route.letter} — {route.codes.length} code(s)</span>
                        </div>
                        <div className="space-y-1 ml-10">
                          {route.codes.map((c) => (
                            <div key={c.code} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-background/40">
                              <div className="flex items-center gap-2">
                                <Key className="w-3 h-3 text-muted" />
                                <span className="text-xs font-mono text-foreground">{c.code}</span>
                                <span className="text-[10px] text-muted">{c.label}</span>
                                {route.letter === "A" && c.code === "1598" && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/20 text-accent">ADMIN</span>
                                )}
                              </div>
                              {!(route.letter === "A" && c.code === "1598") && (
                                <button
                                  onClick={() => handleRemoveRoute(route.letter, c.code)}
                                  className="p-1 rounded text-muted hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {routes.length === 0 && (
                      <p className="text-sm text-muted text-center py-4">No routes configured.</p>
                    )}
                  </div>
                </section>
              )}

              {/* ─── Logout ─────────────────────────────────────── */}
              <section>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={onLogout}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Log Out
                </motion.button>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
