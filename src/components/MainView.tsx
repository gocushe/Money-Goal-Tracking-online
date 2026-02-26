/**
 * MainView.tsx  –  Primary Visual Experience
 * ---------------------------------------------
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
 * Water-flow animation:
 *   When funds are added, a glowing "droplet" travels from the bottom
 *   of the chain upward through each pipe segment, pausing at each
 *   node that received funds (which triggers a radial fill animation
 *   inside GoalNode).
 *
 * Key architectural decisions:
 *  • Goals are sorted by `orderIndex` ascending (0 = bottom).
 *  • The scroll container is reversed so the bottom-most goal appears
 *    at the visual bottom even without JS scroll magic.
 *  • `highlightedGoals` tracks which nodes should pulse after an
 *    `addFunds` event, cleared after a short delay.
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
const NODE_GAP = 24;

/** Duration (ms) to keep a node highlighted after receiving funds. */
const HIGHLIGHT_DURATION = 2200;

/* ── Component ─────────────────────────────────────────────────── */

export default function MainView() {
  const { goals, totalSaved } = useGoals();

  /** Set of goal IDs currently glowing after a fund event. */
  const [highlightedGoals, setHighlightedGoals] = useState<Set<string>>(
    new Set()
  );

  /** Whether the settings panel is open. */
  const [settingsOpen, setSettingsOpen] = useState(false);

  /** Trigger the flow animation after user adds money. */
  const [flowActive, setFlowActive] = useState(false);

  /** Ref to the scroll container so we can auto-scroll to bottom. */
  const scrollRef = useRef<HTMLDivElement>(null);

  /** Goals sorted bottom (index 0) → top. */
  const sortedGoals = useMemo(
    () => [...goals].sort((a, b) => a.orderIndex - b.orderIndex),
    [goals]
  );

  /**
   * Called when the AddFunds component distributes money.
   * Marks the goals that received funds so their nodes pulse.
   */
  const handleFundsAdded = useCallback(
    (_amount: number, allocation: Record<string, number>) => {
      const ids = new Set(Object.keys(allocation));
      setHighlightedGoals(ids);

      /* Trigger the pipe flow animation. */
      setFlowActive(true);

      /* Clear highlights after the animation plays out. */
      setTimeout(() => {
        setHighlightedGoals(new Set());
        setFlowActive(false);
      }, HIGHLIGHT_DURATION);
    },
    []
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

        {/* Wallet summary badge */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl
                     bg-surface/60 backdrop-blur border border-white/5"
        >
          <Wallet className="w-4 h-4 text-accent" />
          <span className="text-sm font-mono text-accent-soft">
            ${totalSaved.toLocaleString()}
          </span>
          <span className="text-[10px] text-muted">
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
          {sortedGoals.map((goal, index) => (
            <div key={goal.id} className="flex flex-col items-center">
              {/* ── Pipe connector to the next node above ──────── */}
              {index < sortedGoals.length - 1 && (
                <PipeSegment
                  active={flowActive}
                  filled={goal.currentAmount >= goal.targetAmount}
                  index={index}
                />
              )}

              {/* ── Goal circle node ──────────────────────────── */}
              <GoalNode
                goal={goal}
                index={index}
                highlight={highlightedGoals.has(goal.id)}
              />
            </div>
          ))}

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
 *  • A bright neon overlay that animates upward when `active` is true
 *    (simulating water flowing through the pipe).
 *  • A large energy orb (not just a dot) that travels the path on flow.
 *  • When the goal below is COMPLETE, the pipe becomes a thicker,
 *    permanently-lit purple line to show the "filled" state.
 *
 * Props:
 *  `active` – whether the flow animation is currently playing.
 *  `filled` – whether the goal beneath is fully funded (pipe stays lit
 *             and becomes thicker).
 *  `index`  – used to stagger the animation per pipe segment.
 */

interface PipeSegmentProps {
  active: boolean;
  filled: boolean;
  index: number;
}

function PipeSegment({ active, filled, index }: PipeSegmentProps) {
  /** Height of the pipe in pixels. */
  const PIPE_HEIGHT = 60 + NODE_GAP;

  /**
   * Line thickness changes depending on state:
   *  - Default dim pipe:      2 px
   *  - Active (animating):    3 px
   *  - Filled (goal complete): 4.5 px  ← noticeably thicker
   */
  const baseStroke = 2;
  const litStroke = filled ? 4.5 : 3;

  /**
   * The travelling energy orb radius.
   * Much larger than the old 4 px dot — creates a capsule / comet effect.
   */
  const ORB_RADIUS = 8;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ height: PIPE_HEIGHT }}
    >
      <svg
        width="24"
        height={PIPE_HEIGHT}
        viewBox={`0 0 24 ${PIPE_HEIGHT}`}
        className="overflow-visible"
      >
        {/* ── Base pipe (always visible, dim) ────────────────── */}
        <line
          x1="12"
          y1="0"
          x2="12"
          y2={PIPE_HEIGHT}
          stroke="rgba(113,113,122,0.15)"
          strokeWidth={baseStroke}
          strokeLinecap="round"
        />

        {/* ── Lit pipe — becomes thicker + glows when filled ── */}
        <motion.line
          x1="12"
          y1={PIPE_HEIGHT}
          x2="12"
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
            duration: 0.8,
            delay: active ? index * 0.25 : 0,
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

        {/* ── Travelling energy orb (large elongated glow) ──── */}
        <AnimatePresence>
          {active && (
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/*
               * The orb is an ellipse + outer glow ellipse that travel
               * from the bottom to the top of the pipe, creating a
               * comet-like streak bigger than a single dot.
               */}

              {/* Outer soft glow (large, semi-transparent) */}
              <motion.ellipse
                cx="12"
                rx={ORB_RADIUS + 4}
                ry={ORB_RADIUS + 8}
                fill="rgba(168,85,247,0.15)"
                initial={{ cy: PIPE_HEIGHT }}
                animate={{ cy: 0 }}
                transition={{
                  duration: 0.7,
                  delay: index * 0.25,
                  ease: "easeInOut",
                }}
              />

              {/* Mid glow */}
              <motion.ellipse
                cx="12"
                rx={ORB_RADIUS}
                ry={ORB_RADIUS + 3}
                fill="rgba(168,85,247,0.35)"
                className="glow-purple-strong"
                initial={{ cy: PIPE_HEIGHT }}
                animate={{ cy: 0 }}
                transition={{
                  duration: 0.7,
                  delay: index * 0.25,
                  ease: "easeInOut",
                }}
              />

              {/* Core bright centre */}
              <motion.ellipse
                cx="12"
                rx={ORB_RADIUS - 3}
                ry={ORB_RADIUS}
                fill="#c084fc"
                className="glow-purple-strong"
                initial={{ cy: PIPE_HEIGHT, opacity: 0 }}
                animate={{ cy: 0, opacity: [0, 1, 1, 0.3] }}
                transition={{
                  duration: 0.7,
                  delay: index * 0.25,
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
           * Uses a more saturated purple to visually distinguish
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
