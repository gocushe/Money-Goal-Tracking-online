/**
 * SettingsView.tsx  –  Goal Management Panel
 * ---------------------------------------------
 * A full-screen slide-over panel toggled from the hamburger menu.
 *
 * Features:
 *  1. **Add Goal** – simple form (name + target amount).
 *  2. **Reorder**  – drag-and-drop list using Framer Motion's `Reorder`
 *     component. Visual order maps to `orderIndex` (bottom → top).
 *  3. **Delete**   – swipe or tap the trash icon to remove a goal.
 *
 * When the panel closes the goals are re-indexed and the Main View
 * recalculates all fill levels / water flow positions.
 *
 * Props:
 *  `isOpen`  – whether the panel is visible.
 *  `onClose` – callback to close the panel.
 */

"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { X, Plus, Trash2, GripVertical } from "lucide-react";
import { useGoals } from "@/lib/store";
import { Goal } from "@/lib/types";

/* ── Component ─────────────────────────────────────────────────── */

interface SettingsViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsView({ isOpen, onClose }: SettingsViewProps) {
  const { goals, setGoals, addGoal, removeGoal } = useGoals();

  /* ── Local copy for drag reorder (committed on close) ───────── */

  /**
   * We keep a locally-sorted array so the Reorder component can
   * freely shuffle items.  On close we write the new order back.
   */
  const [orderedGoals, setOrderedGoals] = useState<Goal[]>([]);

  /** Sync local copy whenever the panel opens or goals change externally. */
  useEffect(() => {
    setOrderedGoals(
      [...goals].sort((a, b) => a.orderIndex - b.orderIndex)
    );
  }, [goals, isOpen]);

  /* ── Add-goal form state ────────────────────────────────────── */
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");

  /**
   * Validate + add a new goal, then reset the form fields.
   */
  const handleAddGoal = useCallback(() => {
    const amount = parseFloat(newAmount);
    if (!newTitle.trim() || !amount || amount <= 0) return;
    addGoal(newTitle.trim(), amount);
    setNewTitle("");
    setNewAmount("");
  }, [newTitle, newAmount, addGoal]);

  /**
   * Persist the visual order as `orderIndex` values and close.
   */
  const handleClose = useCallback(() => {
    /* Write contiguous orderIndex values based on current array order. */
    const reindexed = orderedGoals.map((g, i) => ({
      ...g,
      orderIndex: i,
    }));
    setGoals(reindexed);
    onClose();
  }, [orderedGoals, setGoals, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ──────────────────────────────────────── */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          {/* ── Panel ─────────────────────────────────────────── */}
          <motion.div
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md
                       bg-background border-l border-white/5
                       flex flex-col overflow-hidden"
          >
            {/* ── Header ────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 pt-6 pb-4">
              <h2 className="text-lg font-semibold tracking-tight">
                Settings
              </h2>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={handleClose}
                className="p-2 rounded-xl bg-surface/60 text-muted
                           hover:text-foreground transition-colors"
                aria-label="Close settings"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* ── Scrollable body ───────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 pb-32">
              {/* ─── Add Goal Form ─────────────────────────────── */}
              <section className="mb-8">
                <h3 className="text-xs uppercase tracking-widest text-muted mb-3">
                  Add Goal
                </h3>

                <div className="space-y-3">
                  {/* Goal name input */}
                  <input
                    type="text"
                    placeholder="Goal name"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-surface/60 rounded-xl px-4 py-3
                               text-sm text-foreground placeholder:text-muted
                               outline-none border border-white/5
                               focus:border-accent/40 transition-colors"
                  />

                  {/* Target amount input */}
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="Target amount ($)"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full bg-surface/60 rounded-xl px-4 py-3
                               text-sm text-foreground placeholder:text-muted
                               outline-none border border-white/5
                               focus:border-accent/40 transition-colors
                               [appearance:textfield]
                               [&::-webkit-inner-spin-button]:appearance-none
                               [&::-webkit-outer-spin-button]:appearance-none"
                  />

                  {/* Submit button */}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAddGoal}
                    className="w-full flex items-center justify-center gap-2
                               py-3 rounded-xl bg-accent/20 text-accent
                               text-sm font-medium hover:bg-accent/30
                               transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Goal
                  </motion.button>
                </div>
              </section>

              {/* ─── Reorder List ──────────────────────────────── */}
              <section>
                <h3 className="text-xs uppercase tracking-widest text-muted mb-3">
                  Reorder Goals
                  <span className="ml-2 normal-case text-[10px] opacity-60">
                    (bottom → top)
                  </span>
                </h3>

                {orderedGoals.length === 0 && (
                  <p className="text-sm text-muted py-8 text-center">
                    No goals yet. Add one above!
                  </p>
                )}

                {/**
                 * Framer Motion `Reorder.Group` enables drag-to-reorder.
                 * Each item is uniquely identified by its `id`.
                 */}
                <Reorder.Group
                  axis="y"
                  values={orderedGoals}
                  onReorder={setOrderedGoals}
                  className="space-y-2"
                >
                  {orderedGoals.map((goal) => (
                    <Reorder.Item
                      key={goal.id}
                      value={goal}
                      className="flex items-center gap-3 bg-surface/50
                                 rounded-xl px-4 py-3 border border-white/5
                                 cursor-grab active:cursor-grabbing"
                      whileDrag={{
                        scale: 1.03,
                        boxShadow: "0 8px 30px rgba(168,85,247,0.25)",
                      }}
                    >
                      {/* Drag handle */}
                      <GripVertical className="w-4 h-4 text-muted shrink-0" />

                      {/* Goal info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {goal.title}
                        </p>
                        <p className="text-xs text-muted">
                          ${goal.currentAmount.toLocaleString()} / $
                          {goal.targetAmount.toLocaleString()}
                        </p>
                      </div>

                      {/* Delete button */}
                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={() => removeGoal(goal.id)}
                        className="p-2 rounded-lg text-muted
                                   hover:text-red-400 hover:bg-red-400/10
                                   transition-colors"
                        aria-label={`Delete ${goal.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
