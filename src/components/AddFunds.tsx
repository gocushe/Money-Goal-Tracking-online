/**
 * AddFunds.tsx  –  Sleek Fund Input Bar
 * ----------------------------------------
 * Fixed to the bottom of the Main View. Contains a numeric dollar input
 * and a submit button.  When submitted, calls `addFunds()` from the
 * global store which distributes money upward through the goal chain.
 *
 * After submission, the input resets and a brief "success" flash plays
 * on the button to provide satisfying feedback.
 *
 * Props:
 *  `onAdd` – callback receiving the dollar amount just submitted.
 *            The parent uses this to trigger water-flow animations.
 */

"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ArrowUp, Check } from "lucide-react";
import { useGoals } from "@/lib/store";

/* ── Component ─────────────────────────────────────────────────── */

interface AddFundsProps {
  /** Called after funds are successfully distributed. */
  onAdd?: (amount: number, allocation: Record<string, number>) => void;
}

export default function AddFunds({ onAdd }: AddFundsProps) {
  /** Raw text value of the input field. */
  const [value, setValue] = useState("");

  /** Brief success state shown after a valid submission. */
  const [showSuccess, setShowSuccess] = useState(false);

  const { addFunds } = useGoals();

  /**
   * Parse the input, distribute funds, trigger parent callback,
   * then flash the success indicator and reset.
   */
  const handleSubmit = useCallback(() => {
    const amount = parseFloat(value);
    if (!amount || amount <= 0) return;

    const allocation = addFunds(amount);
    onAdd?.(amount, allocation);

    /* Show success flash for 1.2 s */
    setShowSuccess(true);
    setValue("");
    setTimeout(() => setShowSuccess(false), 1200);
  }, [value, addFunds, onAdd]);

  /**
   * Allow submitting via the Enter / Return key.
   */
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
      <div
        className="flex items-center gap-3 max-w-md mx-auto
                    bg-surface/80 backdrop-blur-lg rounded-2xl
                    border border-white/5 px-4 py-3"
      >
        {/* ── Dollar sign prefix ──────────────────────────────── */}
        <span className="text-accent font-semibold text-lg">$</span>

        {/* ── Amount input ────────────────────────────────────── */}
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

        {/* ── Submit / success button ─────────────────────────── */}
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
              <motion.span
                key="check"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Check className="w-5 h-5" />
              </motion.span>
            ) : (
              <motion.span
                key="arrow"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <ArrowUp className="w-5 h-5" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.div>
  );
}
