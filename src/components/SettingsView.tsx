/**
 * SettingsView.tsx  –  Goal Management + Admin Panel
 * -----------------------------------------------------
 * Slide-over panel with:
 *  1. Add Goal form
 *  2. Reorder/delete goals (drag-and-drop)
 *  3. Admin section (only for admin accounts): manage all login routes
 *  4. Logout button
 */

"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { X, Plus, Trash2, GripVertical, LogOut, Shield, Key } from "lucide-react";
import { useGoals } from "@/lib/store";
import { loadRoutes, saveRoutes } from "@/lib/store";
import { Goal, AuthSession, LetterRoute } from "@/lib/types";

interface SettingsViewProps {
  isOpen: boolean;
  onClose: () => void;
  session: AuthSession;
  onLogout: () => void;
}

export default function SettingsView({ isOpen, onClose, session, onLogout }: SettingsViewProps) {
  const { goals, setGoals, addGoal, removeGoal } = useGoals();

  const [orderedGoals, setOrderedGoals] = useState<Goal[]>([]);
  useEffect(() => {
    setOrderedGoals([...goals].sort((a, b) => a.orderIndex - b.orderIndex));
  }, [goals, isOpen]);

  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");

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
