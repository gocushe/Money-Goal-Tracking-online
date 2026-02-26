/**
 * GoalNode.tsx  –  Circular Goal Visualisation
 * -----------------------------------------------
 * Renders a single goal as an SVG circle that "fills up" radially like
 * water in a round flask.  The fill percentage is derived from
 * `currentAmount / targetAmount`.
 *
 * The radial fill uses an SVG `<circle>` with `stroke-dasharray` &
 * `stroke-dashoffset` animated via Framer Motion, giving a smooth
 * clockwise fill effect starting from the bottom (6-o'clock position).
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

/* ── Geometry constants ────────────────────────────────────────── */

/**
 * SVG viewBox dimensions and circle metrics.
 * Radius = 52 yields a circumference of ~326.73, used to calculate
 * dash offsets for the fill animation.
 */
const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SVG_SIZE = 140;
const CENTER = SVG_SIZE / 2;
const STROKE_WIDTH = 5;

/* ── Component ─────────────────────────────────────────────────── */

interface GoalNodeProps {
  goal: Goal;
  /** Vertical position index (0 = bottom of chain). */
  index: number;
  /** Play a glow pulse on this node (true when funds just arrived). */
  highlight?: boolean;
}

export default function GoalNode({ goal, index, highlight }: GoalNodeProps) {
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

  /** Format a dollar amount as a compact string, e.g. "$10K", "$2.5K". */
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
      {/* ── SVG ring ────────────────────────────────────────────── */}
      <div
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
          <span className="text-base font-semibold text-foreground leading-tight">
            {formatAmount(goal.targetAmount)}
          </span>
          <span className="text-[10px] text-muted mt-0.5 max-w-[80px] truncate text-center">
            {goal.title}
          </span>
          {/* Show progress percentage beneath the title. */}
          <span
            className={`text-[10px] mt-0.5 font-mono ${
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
