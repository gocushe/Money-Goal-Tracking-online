/**
 * PinScreen.tsx  –  Authentication Gate
 * ----------------------------------------
 * Renders a sleek dark-mode PIN pad as the first screen the user sees.
 * The correct PIN is hard-coded to "1234" for this prototype.
 *
 * Features:
 *  • Numeric keypad with haptic-like press animation (Framer Motion).
 *  • Four dot indicators that fill as digits are entered.
 *  • Shake animation on incorrect PIN for clear tactile feedback.
 *  • Backspace button to correct mistakes.
 *
 * Props:
 *  `onSuccess` – callback fired when the correct PIN is entered.
 */

"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, Lock } from "lucide-react";

/* ── Configuration ─────────────────────────────────────────────── */

/** Hard-coded PIN for the prototype. */
const CORRECT_PIN = "5555";

/** Maximum digits the user can enter. */
const PIN_LENGTH = 4;

/* ── Component ─────────────────────────────────────────────────── */

interface PinScreenProps {
  /** Called once the user enters the correct PIN. */
  onSuccess: () => void;
}

export default function PinScreen({ onSuccess }: PinScreenProps) {
  /** Currently entered digits (string of 0-4 chars). */
  const [pin, setPin] = useState("");

  /** Whether a wrong-PIN shake animation should play. */
  const [shake, setShake] = useState(false);

  /** Whether the dots should show a success state. */
  const [success, setSuccess] = useState(false);

  /**
   * Handle a digit press.
   * When the 4th digit is entered, validate immediately.
   */
  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length >= PIN_LENGTH) return;

      const next = pin + digit;
      setPin(next);

      /* Wait until all 4 digits are entered, then validate. */
      if (next.length === PIN_LENGTH) {
        if (next === CORRECT_PIN) {
          /* Correct – play success then navigate. */
          setSuccess(true);
          setTimeout(onSuccess, 600);
        } else {
          /* Wrong – shake and reset. */
          setShake(true);
          setTimeout(() => {
            setShake(false);
            setPin("");
          }, 500);
        }
      }
    },
    [pin, onSuccess]
  );

  /** Remove the last entered digit. */
  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
  }, []);

  /* ── Keypad layout: 1-9, then a row with empty / 0 / backspace ── */
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
    >
      {/* ── Lock icon ──────────────────────────────────────────── */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <Lock className="w-10 h-10 text-accent" strokeWidth={1.5} />
      </motion.div>

      {/* ── Title ──────────────────────────────────────────────── */}
      <motion.p
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-sm tracking-widest uppercase text-muted mb-8"
      >
        Enter PIN
      </motion.p>

      {/* ── Dot indicators ─────────────────────────────────────── */}
      <motion.div
        animate={shake ? { x: [0, -12, 12, -8, 8, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex gap-4 mb-12"
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const filled = i < pin.length;
          return (
            <motion.div
              key={i}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-colors duration-200 ${
                success
                  ? "bg-accent border-accent"
                  : filled
                  ? "bg-accent-soft border-accent-soft"
                  : "border-muted bg-transparent"
              }`}
              animate={
                filled
                  ? { scale: [1, 1.3, 1] }
                  : {}
              }
              transition={{ duration: 0.2 }}
            />
          );
        })}
      </motion.div>

      {/* ── Numeric keypad ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 w-64">
        {keys.map((key, idx) => {
          /* Empty spacer cell */
          if (key === "") {
            return <div key={idx} />;
          }

          /* Backspace button */
          if (key === "back") {
            return (
              <motion.button
                key={idx}
                whileTap={{ scale: 0.85 }}
                onClick={handleBackspace}
                className="flex items-center justify-center h-16 rounded-2xl
                           text-muted active:text-foreground transition-colors"
                aria-label="Backspace"
              >
                <Delete className="w-6 h-6" />
              </motion.button>
            );
          }

          /* Digit button */
          return (
            <motion.button
              key={idx}
              whileTap={{ scale: 0.85 }}
              onClick={() => handleDigit(key)}
              className="flex items-center justify-center h-16 rounded-2xl
                         text-xl font-medium text-foreground
                         bg-surface/60 backdrop-blur
                         active:bg-accent/20 transition-colors"
            >
              {key}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
