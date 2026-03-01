/**
 * GoalNode.tsx  –  Circular Goal Visualisation (reduced 20% from 2× size)
 * --------------------------------------------------------
 * Renders a single goal as an SVG circle that "fills up" radially like
 * water in a round flask.  The fill percentage is derived from
 * `currentAmount / targetAmount`.
 *
 * The radial fill uses an SVG `<circle>` with `stroke-dasharray` &
 * `stroke-dashoffset` animated via Framer Motion, giving a smooth
 * clockwise fill effect starting from the bottom (6-o'clock position).
 *
 * Size notes (v2):
 *  • Circle diameter doubled from 140 → 280 px.
 *  • Goal title text doubled from text-[10px] → text-[20px].
 *  • Target dollar amount doubled from text-base → text-[2rem].
 *  • Percentage and current-amount labels scaled 1.3× from 10px → 13px.
 *
 * Props:
 *  • goal       – The `Goal` object to visualise.
 *  • index      – Vertical position index (0 = bottom).
 *  • highlight  – Whether this node should pulse (just received funds).
 */

"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Goal } from "@/lib/types";

/* ── Geometry constants (2× original, then reduced 20%) ───────── */

/**
 * SVG viewBox dimensions and circle metrics.
 * Original: RADIUS=52, SVG_SIZE=140, STROKE_WIDTH=5
 * Doubled:  RADIUS=104, SVG_SIZE=280, STROKE_WIDTH=8
 * Reduced 20%: RADIUS=83, SVG_SIZE=224, STROKE_WIDTH=6
 * Reduced another 20%: RADIUS=66, SVG_SIZE=180, STROKE_WIDTH=5
 */
const RADIUS = 66;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SVG_SIZE = 180;
const CENTER = SVG_SIZE / 2;
const STROKE_WIDTH = 5;

/* ── Component ─────────────────────────────────────────────────── */

interface GoalNodeProps {
  goal: Goal;
  /** Vertical position index (0 = bottom of chain). */
  index: number;
  /** Play a glow pulse on this node (true when funds just arrived). */
  highlight?: boolean;
  /** Tap-to-fund callback — triggered when user taps the circle. */
  onClick?: () => void;
}

export default function GoalNode({ goal, index, highlight, onClick }: GoalNodeProps) {
  /**
   * Calculate how much of the circle border to fill.
   * `dashOffset` decreases as the goal approaches 100 %.
   */
  const percentage = useMemo(
    () =>
      goal.targetAmount > 0
        ? Math.min(goal.currentAmount / goal.targetAmount, 1)
        : 0,
    [goal.currentAmount, goal.targetAmount]
  );

  const dashOffset = CIRCUMFERENCE * (1 - percentage);

  /** Is this goal fully funded? */
  const isComplete = percentage >= 1;

  /**
   * Format a dollar amount as a compact string, e.g. "$10K", "$2.5K".
   * Used for the large target-amount label inside the circle.
   */
  const formatAmount = (n: number): string => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
    return `$${n.toLocaleString()}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.12, type: "spring", stiffness: 160 }}
      className="flex flex-col items-center relative"
    >
      {/* ── SVG ring (224 × 224) ────────────────────────────────── */}
      <div
        onClick={onClick}
        style={{ cursor: onClick ? "pointer" : undefined }}
        className={`relative ${highlight ? "animate-neon-pulse" : ""} ${
          isComplete ? "glow-purple-strong" : ""
        }`}
      >
        <svg
          width={SVG_SIZE}
          height={SVG_SIZE}
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          className="transform -rotate-90"
        >
          {/* Background ring (hollow circle). */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="rgba(113,113,122,0.2)"
            strokeWidth={STROKE_WIDTH}
          />

          {/* Animated fill ring. Offset transitions from full → 0. */}
          <motion.circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="url(#purpleGradient)"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
          />

          {/* Gradient definition for the fill arc. */}
          <defs>
            <linearGradient
              id="purpleGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
        </svg>

        {/* ── Inner content (amount + title) rendered on top of SVG ── */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Target amount — reduced to 1.3rem */}
          <span className="text-[1.3rem] font-semibold text-foreground leading-tight">
            {formatAmount(goal.targetAmount)}
          </span>

          {/* Goal title — reduced to 13px */}
          <span className="text-[13px] text-muted mt-1 max-w-[115px] truncate text-center">
            {goal.title}
          </span>

          {/* Progress percentage — reduced to 9px */}
          <span
            className={`text-[9px] mt-1 font-mono ${
              isComplete ? "text-accent" : "text-accent-soft"
            }`}
          >
            {Math.round(percentage * 100)}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}
