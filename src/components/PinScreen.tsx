/**
 * PinScreen.tsx  –  Letter + PIN Authentication Gate
 * ----------------------------------------------------
 * Two-step auth: 1) Choose a letter A-Z, 2) Enter a 4-digit code.
 * Each letter has its own set of valid codes stored in localStorage.
 * Each code opens a different expenses account.
 */

"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, Lock, ChevronLeft } from "lucide-react";
import { AuthSession } from "@/lib/types";
import { validateLogin } from "@/lib/store";

/* ── Configuration ─────────────────────────────────────────────── */
const PIN_LENGTH = 4;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/* ── Component ─────────────────────────────────────────────────── */

interface PinScreenProps {
  onSuccess: (session: AuthSession) => void;
}

export default function PinScreen({ onSuccess }: PinScreenProps) {
  const [step, setStep] = useState<"letter" | "pin">("letter");
  const [selectedLetter, setSelectedLetter] = useState("");
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleLetterSelect = useCallback((letter: string) => {
    setSelectedLetter(letter);
    setStep("pin");
    setPin("");
  }, []);

  const handleBack = useCallback(() => {
    setStep("letter");
    setSelectedLetter("");
    setPin("");
  }, []);

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length >= PIN_LENGTH) return;
      const next = pin + digit;
      setPin(next);

      if (next.length === PIN_LENGTH) {
        const result = validateLogin(selectedLetter, next);
        if (result.valid) {
          setSuccess(true);
          const isAdmin = selectedLetter === "A" && next === "1598";
          setTimeout(() => {
            onSuccess({
              letter: selectedLetter,
              code: next,
              label: result.label,
              isAdmin,
            });
          }, 600);
        } else {
          setShake(true);
          setTimeout(() => {
            setShake(false);
            setPin("");
          }, 500);
        }
      }
    },
    [pin, selectedLetter, onSuccess]
  );

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
    >
      <AnimatePresence mode="wait">
        {step === "letter" ? (
          /* ─── Letter Selection ─────────────────────────────── */
          <motion.div
            key="letter-select"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center"
          >
            <Lock className="w-10 h-10 text-accent mb-4" strokeWidth={1.5} />
            <p className="text-sm tracking-widest uppercase text-muted mb-6">
              Choose Your Letter
            </p>

            <div className="grid grid-cols-6 gap-2 w-80 max-h-[60vh] overflow-y-auto px-2">
              {LETTERS.map((letter) => (
                <motion.button
                  key={letter}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => handleLetterSelect(letter)}
                  className="flex items-center justify-center h-12 rounded-xl
                             text-lg font-semibold text-foreground
                             bg-surface/60 backdrop-blur border border-white/5
                             active:bg-accent/20 hover:bg-accent/10 transition-colors"
                >
                  {letter}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          /* ─── PIN Entry ───────────────────────────────────── */
          <motion.div
            key="pin-entry"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center"
          >
            {/* Back button */}
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={handleBack}
              className="absolute top-12 left-5 p-2 rounded-xl bg-surface/60
                         text-muted hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </motion.button>

            {/* Selected letter badge */}
            <div className="w-14 h-14 rounded-2xl bg-accent/20 flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-accent">{selectedLetter}</span>
            </div>

            <p className="text-sm tracking-widest uppercase text-muted mb-8">
              Enter PIN
            </p>

            {/* Dot indicators */}
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
                    animate={filled ? { scale: [1, 1.3, 1] } : {}}
                    transition={{ duration: 0.2 }}
                  />
                );
              })}
            </motion.div>

            {/* Numeric keypad */}
            <div className="grid grid-cols-3 gap-4 w-64">
              {keys.map((key, idx) => {
                if (key === "") return <div key={idx} />;
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
        )}
      </AnimatePresence>
    </motion.div>
  );
}
