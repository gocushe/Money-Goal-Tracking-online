/**
 * SideGoalNode.tsx  –  Yellow Side Goal Circle
 * -----------------------------------------------
 * Renders a smaller yellow-themed circular goal node
 * for side goals branching off the main purple chain.
 */

"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Trash2, Plus, DollarSign } from "lucide-react";
import { SideGoal } from "@/lib/types";

const RADIUS = 32;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SVG_SIZE = 80;
const CENTER = SVG_SIZE / 2;
const STROKE_WIDTH = 3;

const SMALL_RADIUS = 21;
const SMALL_CIRCUMFERENCE = 2 * Math.PI * SMALL_RADIUS;
const SMALL_SVG_SIZE = 52;
const SMALL_CENTER = SMALL_SVG_SIZE / 2;
const SMALL_STROKE_WIDTH = 2;

interface SideGoalNodeProps {
  sideGoal: SideGoal;
  onRemove?: () => void;
  onAddFunds?: () => void;
  onAddSubGoal?: () => void;
  small?: boolean;
}

export default function SideGoalNode({
  sideGoal,
  onRemove,
  onAddFunds,
  onAddSubGoal,
  small,
}: SideGoalNodeProps) {
  const percentage = useMemo(
    () =>
      sideGoal.targetAmount > 0
        ? Math.min(sideGoal.currentAmount / sideGoal.targetAmount, 1)
        : 0,
    [sideGoal.currentAmount, sideGoal.targetAmount]
  );

  const r = small ? SMALL_RADIUS : RADIUS;
  const c = small ? SMALL_CIRCUMFERENCE : CIRCUMFERENCE;
  const size = small ? SMALL_SVG_SIZE : SVG_SIZE;
  const center = small ? SMALL_CENTER : CENTER;
  const sw = small ? SMALL_STROKE_WIDTH : STROKE_WIDTH;
  const dashOffset = c * (1 - percentage);
  const isComplete = percentage >= 1;

  const formatAmount = (n: number): string => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
    return `$${n.toLocaleString()}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 160 }}
      className="flex flex-col items-center relative group"
    >
      <div className={`relative ${isComplete ? "glow-yellow-strong" : ""}`}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke="rgba(234,179,8,0.2)"
            strokeWidth={sw}
          />
          <motion.circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke="url(#yellowGradient)"
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
          />
          <defs>
            <linearGradient id="yellowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${small ? "text-[8px]" : "text-[11px]"} font-semibold text-yellow-300 leading-tight`}>
            {formatAmount(sideGoal.targetAmount)}
          </span>
          <span className={`${small ? "text-[6px]" : "text-[8px]"} text-yellow-500/70 max-w-[${small ? "40" : "56"}px] truncate text-center`}>
            {sideGoal.title}
          </span>
          <span className={`${small ? "text-[6px]" : "text-[7px]"} font-mono text-yellow-400/60`}>
            {Math.round(percentage * 100)}%
          </span>
        </div>
      </div>

      {/* Action buttons (visible on hover / focus) */}
      {!small && (
        <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onAddFunds && (
            <button
              onClick={onAddFunds}
              className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center hover:bg-yellow-500/30"
              title="Add funds"
            >
              <DollarSign className="w-3 h-3" />
            </button>
          )}
          {onAddSubGoal && (
            <button
              onClick={onAddSubGoal}
              className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center hover:bg-yellow-500/30"
              title="Add sub-goal"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30"
              title="Remove"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
