/**
 * MainView.tsx  –  Primary Visual Experience (v2)
 * --------------------------------------------------
 * Renders the vertical goal-chain visualization with animated
 * "water flow" connections between nodes.
 *
 * Layout (bottom → top):
 *   ┌───────────┐
 *   │  Goal N   │  ← highest orderIndex, top of screen
 *   │     │     │
 *   │   pipe    │  ← SVG path with neon glow
 *   │     │     │
 *   │  Goal 1   │
 *   │     │     │
 *   │  Goal 0   │  ← lowest orderIndex, bottom of screen
 *   └───────────┘
 *
 * Sequential flow animation (v2):
 *   When funds are added, the animation only plays on pipe segments
 *   between the goals that actually received money.  If goals 0, 1, and 2
 *   all receive funds, pipe 0→1 animates first, then 1→2 — sequentially
 *   with staggered delays.  Pipes outside that range stay static.
 *
 * Key architectural decisions:
 *  • Goals are sorted by `orderIndex` ascending (0 = bottom).
 *  • The scroll container is reversed so the bottom-most goal appears
 *    at the visual bottom even without JS scroll magic.
 *  • `highlightedGoals` tracks which nodes should pulse after an
 *    `addFunds` event, cleared after a short delay.
 *  • `flowRange` stores the min/max indices of goals that received
 *    funds so only those pipe segments animate.
 */

"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, Wallet } from "lucide-react";
import { useGoals } from "@/lib/store";
import GoalNode from "@/components/GoalNode";
import AddFunds from "@/components/AddFunds";
import SettingsView from "@/components/SettingsView";

/* ── Constants ─────────────────────────────────────────────────── */

/** Vertical gap between each goal node (px). */
const NODE_GAP = 28;

/** Duration (ms) to keep a node highlighted after receiving funds. */
const HIGHLIGHT_DURATION = 3000;

/** Duration (ms) for one pipe segment's flow animation. */
const SEGMENT_ANIM_DURATION = 0.65;

/** Stagger delay (s) between consecutive pipe segment animations. */
const SEGMENT_STAGGER = 0.45;

/* ── Component ─────────────────────────────────────────────────── */

export default function MainView() {
  const { goals, totalSaved } = useGoals();

  /** Set of goal IDs currently glowing after a fund event. */
  const [highlightedGoals, setHighlightedGoals] = useState<Set<string>>(
    new Set()
  );

  /** Whether the settings panel is open. */
  const [settingsOpen, setSettingsOpen] = useState(false);

  /**
   * `flowRange` defines which pipe segments should animate.
   * `null` means no animation is in progress.
   * `{ minIdx, maxIdx }` means pipes connecting goals at
   * positions minIdx..maxIdx should animate sequentially.
   */
  const [flowRange, setFlowRange] = useState<{
    minIdx: number;
    maxIdx: number;
  } | null>(null);

  /** Ref to the scroll container so we can auto-scroll to bottom. */
  const scrollRef = useRef<HTMLDivElement>(null);

  /** Goals sorted bottom (index 0) → top. */
  const sortedGoals = useMemo(
    () => [...goals].sort((a, b) => a.orderIndex - b.orderIndex),
    [goals]
  );

  /**
   * Called when the AddFunds component distributes money.
   * Determines *which* goals received funds and only animates the
   * pipe segments between them — not every pipe in the chain.
   */
  const handleFundsAdded = useCallback(
    (_amount: number, allocation: Record<string, number>) => {
      const fundedIds = new Set(Object.keys(allocation));
      setHighlightedGoals(fundedIds);

      /*
       * Find the contiguous index range of goals that received funds.
       * We scan the sorted array and record the first and last index
       * that appears in the allocation map.
       */
      let minIdx = Infinity;
      let maxIdx = -Infinity;
      const sorted = [...goals].sort((a, b) => a.orderIndex - b.orderIndex);
      sorted.forEach((g, i) => {
        if (fundedIds.has(g.id)) {
          if (i < minIdx) minIdx = i;
          if (i > maxIdx) maxIdx = i;
        }
      });

      if (minIdx <= maxIdx) {
        setFlowRange({ minIdx, maxIdx });
      }

      /* Calculate total animation time based on number of segments. */
      const segmentCount = maxIdx - minIdx;
      const totalAnimTime =
        (segmentCount * SEGMENT_STAGGER + SEGMENT_ANIM_DURATION) * 1000 + 600;

      /* Clear highlights after the full sequential animation plays out. */
      setTimeout(() => {
        setHighlightedGoals(new Set());
        setFlowRange(null);
      }, Math.max(HIGHLIGHT_DURATION, totalAnimTime));
    },
    [goals]
  );

  /** Auto-scroll to the bottom (lowest goal) on mount. */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sortedGoals.length]);

  /**
   * Compute total target across all goals (used in the header summary).
   */
  const totalTarget = useMemo(
    () => goals.reduce((sum, g) => sum + g.targetAmount, 0),
    [goals]
  );

  return (
    <>
      {/* ── Top bar: hamburger menu + summary ─────────────────── */}
      <header className="fixed top-0 inset-x-0 z-30 flex items-center justify-between px-5 pt-5 pb-3 bg-gradient-to-b from-background via-background/90 to-transparent">
        {/* Hamburger menu button */}
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={() => setSettingsOpen(true)}
          className="p-2.5 rounded-xl bg-surface/60 backdrop-blur
                     border border-white/5 text-muted
                     hover:text-foreground transition-colors"
          aria-label="Open settings"
        >
          <Menu className="w-5 h-5" />
        </motion.button>

        {/* Wallet summary badge — $ amount at 1.3× (was text-sm, now ~18.2px) */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl
                     bg-surface/60 backdrop-blur border border-white/5"
        >
          <Wallet className="w-4 h-4 text-accent" />
          <span className="text-[18px] font-mono text-accent-soft">
            ${totalSaved.toLocaleString()}
          </span>
          <span className="text-[13px] text-muted">
            / ${totalTarget.toLocaleString()}
          </span>
        </motion.div>
      </header>

      {/* ── Scrollable goal visualization ─────────────────────── */}
      <div
        ref={scrollRef}
        className="fixed inset-0 pt-20 pb-28 overflow-y-auto"
      >
        {/**
         * The chain is rendered bottom-to-top using flex-col-reverse
         * so the lowest-order goal naturally sits at the visual bottom.
         */}
        <div className="min-h-full flex flex-col-reverse items-center justify-start px-4 py-8 gap-0">
          {sortedGoals.map((goal, index) => {
            /**
             * Determine if this pipe segment (between goal[index] and
             * goal[index+1]) should animate.  A pipe only animates if
             * both its lower and upper goal are within the flowRange.
             */
            const pipeActive =
              flowRange !== null &&
              index >= flowRange.minIdx &&
              index < flowRange.maxIdx;

            /**
             * Sequential stagger: the pipe at the bottom of the funded
             * range animates first, then each subsequent pipe after a delay.
             */
            const pipeStaggerIndex =
              flowRange !== null ? index - flowRange.minIdx : 0;

            return (
              <div key={goal.id} className="flex flex-col items-center">
                {/* ── Pipe connector to the next node above ──────── */}
                {index < sortedGoals.length - 1 && (
                  <PipeSegment
                    active={pipeActive}
                    filled={goal.currentAmount >= goal.targetAmount}
                    sequenceIndex={pipeStaggerIndex}
                  />
                )}

                {/* ── Goal circle node ──────────────────────────── */}
                <GoalNode
                  goal={goal}
                  index={index}
                  highlight={highlightedGoals.has(goal.id)}
                />
              </div>
            );
          })}

          {/* ── Empty state ────────────────────────────────────── */}
          {sortedGoals.length === 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-muted text-sm text-center mt-40"
            >
              No goals yet.
              <br />
              Tap the menu to add your first goal!
            </motion.p>
          )}
        </div>
      </div>

      {/* ── Add Funds bar (fixed bottom) ──────────────────────── */}
      <AddFunds onAdd={handleFundsAdded} />

      {/* ── Settings panel ────────────────────────────────────── */}
      <SettingsView
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  PipeSegment  –  Glowing SVG connector between two GoalNodes
 * ═══════════════════════════════════════════════════════════════════
 *
 * Renders a short vertical SVG "pipe" with:
 *  • A dim base line (always visible).
 *  • A bright neon overlay that animates upward when `active` is true.
 *  • A large energy orb that travels the path during flow.
 *  • When the goal below is COMPLETE, the pipe becomes a thicker,
 *    permanently-lit purple line to show the "filled" state.
 *
 * Sequential animation (v2):
 *  `active` is now per-segment — only pipes within the funded range
 *  receive `active=true`.  `sequenceIndex` determines the stagger
 *  delay (0 = first pipe to animate, 1 = next, etc.) so the flow
 *  travels upward one segment at a time.
 *
 * Props:
 *  `active`        – whether THIS pipe should run the flow animation.
 *  `filled`        – whether the goal beneath is fully funded.
 *  `sequenceIndex` – position in the sequential animation chain (0-based).
 */

interface PipeSegmentProps {
  active: boolean;
  filled: boolean;
  sequenceIndex: number;
}

function PipeSegment({ active, filled, sequenceIndex }: PipeSegmentProps) {
  /** Height of the pipe in pixels (slightly taller for bigger nodes). */
  const PIPE_HEIGHT = 70 + NODE_GAP;

  /**
   * Line thickness changes depending on state:
   *  - Default dim pipe:       2 px
   *  - Active (animating):     3 px
   *  - Filled (goal complete): 5 px  ← noticeably thicker
   */
  const baseStroke = 2;
  const litStroke = filled ? 5 : 3;

  /** The travelling energy orb dimensions (large capsule). */
  const ORB_RX = 9;
  const ORB_RY = 14;

  /** Stagger delay for this specific segment in the sequence. */
  const delay = sequenceIndex * SEGMENT_STAGGER;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ height: PIPE_HEIGHT }}
    >
      <svg
        width="32"
        height={PIPE_HEIGHT}
        viewBox={`0 0 32 ${PIPE_HEIGHT}`}
        className="overflow-visible"
      >
        {/* ── Base pipe (always visible, dim) ────────────────── */}
        <line
          x1="16"
          y1="0"
          x2="16"
          y2={PIPE_HEIGHT}
          stroke="rgba(113,113,122,0.15)"
          strokeWidth={baseStroke}
          strokeLinecap="round"
        />

        {/* ── Lit pipe — becomes thicker + glows when filled ── */}
        <motion.line
          x1="16"
          y1={PIPE_HEIGHT}
          x2="16"
          y2="0"
          stroke={filled ? "url(#pipeGlowFilled)" : "url(#pipeGlow)"}
          strokeWidth={litStroke}
          strokeLinecap="round"
          initial={{ pathLength: filled ? 1 : 0 }}
          animate={{
            pathLength: filled || active ? 1 : 0,
            opacity: filled || active ? 1 : 0,
          }}
          transition={{
            duration: SEGMENT_ANIM_DURATION,
            delay: active ? delay : 0,
            ease: "easeInOut",
          }}
          className={
            filled
              ? "glow-purple-strong"
              : active
              ? "glow-purple"
              : ""
          }
        />

        {/* ── Travelling energy orb (only on active segments) ── */}
        <AnimatePresence>
          {active && (
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/*
               * Three-layer orb: outer glow → mid glow → bright core.
               * Each layer travels bottom-to-top with the same
               * sequential delay so the orb flows pipe-by-pipe.
               */}

              {/* Outer soft glow (large, semi-transparent) */}
              <motion.ellipse
                cx="16"
                rx={ORB_RX + 6}
                ry={ORB_RY + 10}
                fill="rgba(168,85,247,0.12)"
                initial={{ cy: PIPE_HEIGHT }}
                animate={{ cy: 0 }}
                transition={{
                  duration: SEGMENT_ANIM_DURATION,
                  delay,
                  ease: "easeInOut",
                }}
              />

              {/* Mid glow */}
              <motion.ellipse
                cx="16"
                rx={ORB_RX}
                ry={ORB_RY}
                fill="rgba(168,85,247,0.3)"
                className="glow-purple-strong"
                initial={{ cy: PIPE_HEIGHT }}
                animate={{ cy: 0 }}
                transition={{
                  duration: SEGMENT_ANIM_DURATION,
                  delay,
                  ease: "easeInOut",
                }}
              />

              {/* Core bright centre */}
              <motion.ellipse
                cx="16"
                rx={ORB_RX - 3}
                ry={ORB_RY - 3}
                fill="#c084fc"
                className="glow-purple-strong"
                initial={{ cy: PIPE_HEIGHT, opacity: 0 }}
                animate={{ cy: 0, opacity: [0, 1, 1, 0.2] }}
                transition={{
                  duration: SEGMENT_ANIM_DURATION,
                  delay,
                  ease: "easeInOut",
                }}
              />
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Gradient definitions ────────────────────────────── */}
        <defs>
          {/* Standard pipe gradient (unfilled goals). */}
          <linearGradient id="pipeGlow" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>

          {/*
           * Brighter gradient for COMPLETED goal pipes.
           * Uses more saturated purple to visually distinguish
           * "filled" connections from still-in-progress ones.
           */}
          <linearGradient id="pipeGlowFilled" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#9333ea" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#d8b4fe" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
