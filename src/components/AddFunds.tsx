/**
 * AddFunds.tsx  –  Fund Input Bar with Goal Selector
 * -----------------------------------------------------
 * Fixed to the bottom of the Main View. Contains a dropdown to select
 * a specific goal (or "Auto-fill" for linear distribution), a numeric
 * dollar input, and a submit button.
 *
 * Props:
 *  `onAdd` – callback receiving the dollar amount and allocation map.
 */

"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Check, ChevronDown } from "lucide-react";
import { useGoals } from "@/lib/store";
import { Goal, SideGoal } from "@/lib/types";

/* ── Types ──────────────────────────────────────────────────────── */

interface GoalOption {
  type: "auto" | "main" | "side";
  goalId: string;
  parentGoalId?: string;
  label: string;
  remaining: number;
}

interface AddFundsProps {
  onAdd?: (amount: number, allocation: Record<string, number>) => void;
}

/* ── Component ──────────────────────────────────────────────────── */

export default function AddFunds({ onAdd }: AddFundsProps) {
  const [value, setValue] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<GoalOption | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { goals, addFunds, addFundsToGoal, addFundsToSideGoal } = useGoals();

  /* Build the options list: Auto-fill + all unfilled goals + side goals */
  const options = useMemo(() => {
    const sorted = [...goals].sort((a, b) => a.orderIndex - b.orderIndex);
    const opts: GoalOption[] = [
      { type: "auto", goalId: "auto", label: "Auto-fill (next unfilled)", remaining: 0 },
    ];

    sorted.forEach((g) => {
      const remaining = g.targetAmount - g.currentAmount;
      if (remaining > 0) {
        opts.push({
          type: "main",
          goalId: g.id,
          label: g.title,
          remaining,
        });
      }
      (g.sideGoals || []).forEach((sg) => {
        const sgRemaining = sg.targetAmount - sg.currentAmount;
        if (sgRemaining > 0) {
          opts.push({
            type: "side",
            goalId: sg.id,
            parentGoalId: g.id,
            label: `${sg.title} (side of ${g.title})`,
            remaining: sgRemaining,
          });
        }
      });
    });

    return opts;
  }, [goals]);

  const activeOption = selectedOption || options[0];

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = useCallback(() => {
    const amount = parseFloat(value);
    if (!amount || amount <= 0) return;

    if (activeOption.type === "auto") {
      const allocation = addFunds(amount);
      onAdd?.(amount, allocation);
    } else if (activeOption.type === "main") {
      addFundsToGoal(activeOption.goalId, amount);
      onAdd?.(amount, { [activeOption.goalId]: amount });
    } else if (activeOption.type === "side" && activeOption.parentGoalId) {
      addFundsToSideGoal(activeOption.parentGoalId, activeOption.goalId, amount);
      onAdd?.(amount, { [activeOption.goalId]: amount });
    }

    setShowSuccess(true);
    setValue("");
    setTimeout(() => setShowSuccess(false), 1200);
  }, [value, activeOption, addFunds, addFundsToGoal, addFundsToSideGoal, onAdd]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
      className="fixed bottom-0 inset-x-0 z-30 px-4 pb-6 pt-4
                 bg-gradient-to-t from-background via-background/95 to-transparent"
    >
      <div className="max-w-md mx-auto space-y-2">
        {/* ── Goal selector dropdown ──────────────────────────── */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5
                       bg-surface/80 backdrop-blur-lg rounded-xl
                       border border-white/5 text-sm text-foreground
                       hover:border-accent/30 transition-colors"
          >
            <span className="truncate">
              {activeOption.type === "auto" ? (
                <span className="text-accent">Auto-fill</span>
              ) : activeOption.type === "side" ? (
                <span className="text-yellow-400">{activeOption.label}</span>
              ) : (
                <span>{activeOption.label}</span>
              )}
              {activeOption.remaining > 0 && (
                <span className="text-muted text-xs ml-2">
                  ${activeOption.remaining.toLocaleString()} left
                </span>
              )}
            </span>
            <ChevronDown className={`w-4 h-4 text-muted transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="absolute bottom-full left-0 right-0 mb-1 bg-surface rounded-xl border border-white/10
                           max-h-48 overflow-y-auto shadow-lg shadow-black/40 z-50"
              >
                {options.map((opt, i) => (
                  <button
                    key={`${opt.type}-${opt.goalId}`}
                    onClick={() => {
                      setSelectedOption(opt.type === "auto" ? null : opt);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5
                               ${i > 0 ? "border-t border-white/5" : ""}
                               ${activeOption.goalId === opt.goalId ? "bg-white/5" : ""}`}
                  >
                    {opt.type === "auto" ? (
                      <span className="text-accent">Auto-fill (next unfilled)</span>
                    ) : opt.type === "side" ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                        <span className="text-yellow-300 truncate">{opt.label}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                        <span className="truncate">{opt.label}</span>
                      </div>
                    )}
                    {opt.remaining > 0 && (
                      <span className="text-[10px] text-muted block mt-0.5">
                        ${opt.remaining.toLocaleString()} remaining
                      </span>
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Amount input + submit ───────────────────────────── */}
        <div
          className="flex items-center gap-3
                      bg-surface/80 backdrop-blur-lg rounded-2xl
                      border border-white/5 px-4 py-3"
        >
          <span className="text-accent font-semibold text-lg">$</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="Add funds…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-foreground text-lg
                       placeholder:text-muted outline-none
                       [appearance:textfield]
                       [&::-webkit-inner-spin-button]:appearance-none
                       [&::-webkit-outer-spin-button]:appearance-none"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSubmit}
            className={`flex items-center justify-center w-11 h-11 rounded-xl
                        transition-colors duration-300 ${
                          showSuccess
                            ? "bg-green-500/20 text-green-400"
                            : "bg-accent/20 text-accent hover:bg-accent/30"
                        }`}
            aria-label="Submit funds"
          >
            <AnimatePresence mode="wait">
              {showSuccess ? (
                <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Check className="w-5 h-5" />
                </motion.span>
              ) : (
                <motion.span key="arrow" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <ArrowUp className="w-5 h-5" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
