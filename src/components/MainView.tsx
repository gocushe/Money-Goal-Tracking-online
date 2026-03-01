/**
 * MainView.tsx  –  Goal Chain Visualization with Side Goals
 * -----------------------------------------------------------
 * Renders the vertical goal-chain with yellow side-goal branches.
 */

"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, Wallet, Plus, X, DollarSign } from "lucide-react";
import { useGoals, useUnallocatedFunds } from "@/lib/store";
import GoalNode from "@/components/GoalNode";
import SideGoalNode from "@/components/SideGoalNode";
import SettingsView from "@/components/SettingsView";
import { AuthSession, Goal } from "@/lib/types";
import { useExternalSync } from "@/lib/useExternalSync";

/* ── Constants ─────────────────────────────────────────────────── */
const NODE_GAP = 20;
const HIGHLIGHT_DURATION = 3000;
const SEGMENT_ANIM_DURATION = 0.65;
const SEGMENT_STAGGER = 0.45;

/* ── Component ─────────────────────────────────────────────────── */

interface MainViewProps {
  session: AuthSession;
  onLogout: () => void;
}

export default function MainView({ session, onLogout }: MainViewProps) {
  const { goals, totalSaved, addSideGoal, addFundsToGoal } = useGoals();
  const { deposits, totalUnallocated, allocateDeposit } = useUnallocatedFunds();

  // Poll for external data (daytrading app payout allocations)
  useExternalSync(session);

  const [highlightedGoals, setHighlightedGoals] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [flowRange, setFlowRange] = useState<{ minIdx: number; maxIdx: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── Show-once logic for unallocated funds ──────────────── */
  const SEEN_KEY = `money-goals-seen-unallocated-${session.letter}-${session.code}`;
  const [hasSeenUnallocated, setHasSeenUnallocated] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SEEN_KEY) === "true";
  });
  const showUnallocatedBanner = deposits.length > 0 && !hasSeenUnallocated;

  // Mark as seen after user has viewed the banner for 3 seconds
  useEffect(() => {
    if (showUnallocatedBanner) {
      const timer = setTimeout(() => {
        setHasSeenUnallocated(true);
        localStorage.setItem(SEEN_KEY, "true");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showUnallocatedBanner, SEEN_KEY]);

  // Reset "seen" flag when new deposits arrive (count changes)
  const prevDepositCount = useRef(deposits.length);
  useEffect(() => {
    if (deposits.length > prevDepositCount.current) {
      setHasSeenUnallocated(false);
      localStorage.removeItem(SEEN_KEY);
    }
    prevDepositCount.current = deposits.length;
  }, [deposits.length, SEEN_KEY]);

  /* Pinch-to-zoom state */
  const [zoomScale, setZoomScale] = useState(1);
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartScale = useRef(1);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist.current = Math.hypot(dx, dy);
      pinchStartScale.current = zoomScale;
    }
  }, [zoomScale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchStartDist.current;
      const newScale = Math.min(1.5, Math.max(0.5, pinchStartScale.current * ratio));
      setZoomScale(newScale);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    pinchStartDist.current = null;
  }, []);

  /* Side goal add modal */
  const [sideGoalModal, setSideGoalModal] = useState<{ goalId: string } | null>(null);
  const [sgTitle, setSgTitle] = useState("");
  const [sgAmount, setSgAmount] = useState("");

  /* Tap-to-fund modal */
  const [fundGoalModal, setFundGoalModal] = useState<{ goalId: string; goalTitle: string; remaining: number } | null>(null);
  const [fundAmount, setFundAmount] = useState("");

  const sortedGoals = useMemo(
    () => [...goals].sort((a, b) => a.orderIndex - b.orderIndex),
    [goals]
  );

  const handleFundsAdded = useCallback(
    (_amount: number, allocation: Record<string, number>) => {
      const fundedIds = new Set(Object.keys(allocation));
      setHighlightedGoals(fundedIds);

      let minIdx = Infinity;
      let maxIdx = -Infinity;
      const sorted = [...goals].sort((a, b) => a.orderIndex - b.orderIndex);
      sorted.forEach((g, i) => {
        if (fundedIds.has(g.id)) {
          if (i < minIdx) minIdx = i;
          if (i > maxIdx) maxIdx = i;
        }
      });

      if (minIdx <= maxIdx) setFlowRange({ minIdx, maxIdx });

      const segmentCount = maxIdx - minIdx;
      const totalAnimTime = (segmentCount * SEGMENT_STAGGER + SEGMENT_ANIM_DURATION) * 1000 + 600;

      setTimeout(() => {
        setHighlightedGoals(new Set());
        setFlowRange(null);
      }, Math.max(HIGHLIGHT_DURATION, totalAnimTime));
    },
    [goals]
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sortedGoals.length]);

  const totalTarget = useMemo(
    () => goals.reduce((sum, g) => sum + g.targetAmount, 0),
    [goals]
  );

  const handleAddSideGoal = useCallback(() => {
    const amount = parseFloat(sgAmount);
    if (!sgTitle.trim() || !amount || amount <= 0 || !sideGoalModal) return;
    addSideGoal(sideGoalModal.goalId, sgTitle.trim(), amount);
    setSideGoalModal(null);
    setSgTitle("");
    setSgAmount("");
  }, [sgTitle, sgAmount, sideGoalModal, addSideGoal]);

  /** Open tap-to-fund modal when user taps a goal circle. */
  const handleGoalTap = useCallback(
    (goal: Goal) => {
      const remaining = goal.targetAmount - goal.currentAmount;
      if (remaining <= 0) return; // already fully funded
      setFundGoalModal({ goalId: goal.id, goalTitle: goal.title, remaining });
      setFundAmount("");
    },
    []
  );

  /** Allocate funds from unallocated deposits to a specific goal. */
  const handleConfirmFund = useCallback(() => {
    if (!fundGoalModal) return;
    const amt = parseFloat(fundAmount);
    if (!amt || amt <= 0) return;
    const maxAllowed = Math.min(amt, totalUnallocated, fundGoalModal.remaining);
    if (maxAllowed <= 0) return;

    // Deduct from unallocated deposits (FIFO)
    let remaining = maxAllowed;
    for (const dep of deposits) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, dep.amountCAD);
      allocateDeposit(dep.id, take);
      remaining -= take;
    }

    // Add to goal
    addFundsToGoal(fundGoalModal.goalId, maxAllowed);

    // Highlight
    setHighlightedGoals(new Set([fundGoalModal.goalId]));
    setTimeout(() => setHighlightedGoals(new Set()), HIGHLIGHT_DURATION);

    setFundGoalModal(null);
    setFundAmount("");
  }, [fundGoalModal, fundAmount, totalUnallocated, deposits, allocateDeposit, addFundsToGoal]);

  return (
    <>
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="fixed top-[88px] inset-x-0 z-30 flex items-center justify-between px-5 pt-3 pb-3 bg-gradient-to-b from-background via-background/90 to-transparent">
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setSettingsOpen(true)}
            className="p-2.5 rounded-xl bg-surface/60 backdrop-blur border border-white/5 text-muted hover:text-foreground transition-colors"
            aria-label="Open settings"
          >
            <Menu className="w-5 h-5" />
          </motion.button>
          {/* Badge when unallocated funds are waiting in settings */}
          {deposits.length > 0 && hasSeenUnallocated && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-[9px] font-bold text-black flex items-center justify-center">
              {deposits.length}
            </span>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface/60 backdrop-blur border border-white/5"
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

      {/* ── One-time unallocated funds notification ────────── */}
      <AnimatePresence>
        {showUnallocatedBanner && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-[140px] inset-x-4 z-20"
          >
            <button
              onClick={() => {
                setHasSeenUnallocated(true);
                localStorage.setItem(SEEN_KEY, "true");
                setSettingsOpen(true);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 border border-amber-500/25 text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-300">
                  CA${totalUnallocated.toLocaleString("en-US", { minimumFractionDigits: 2 })} unallocated
                </p>
                <p className="text-[10px] text-amber-400/70">Tap to allocate in Settings</p>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scrollable goal visualization with pinch-to-zoom ── */}
      <div
        ref={scrollRef}
        className="fixed inset-0 pt-[140px] pb-8 overflow-y-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="min-h-full flex flex-col-reverse items-center justify-start px-4 py-8 gap-0 origin-center"
          style={{ transform: `scale(${zoomScale})`, transformOrigin: 'center top' }}
        >
          {sortedGoals.map((goal, index) => {
            const pipeActive =
              flowRange !== null && index >= flowRange.minIdx && index < flowRange.maxIdx;
            const pipeStaggerIndex = flowRange !== null ? index - flowRange.minIdx : 0;

            return (
              <div key={goal.id} className="flex flex-col items-center">
                {/* Pipe connector */}
                {index < sortedGoals.length - 1 && (
                  <PipeSegment
                    active={pipeActive}
                    filled={goal.currentAmount >= goal.targetAmount && sortedGoals[index + 1]?.currentAmount > 0}
                    permanentLit={goal.currentAmount >= goal.targetAmount}
                    sequenceIndex={pipeStaggerIndex}
                  />
                )}

                {/* Goal node with side goals */}
                <div className="flex items-center gap-4">
                  {/* Left side goals */}
                  <div className="flex flex-col gap-1 items-end min-w-[90px]">
                    {(goal.sideGoals || [])
                      .filter((_, i) => i % 2 === 0)
                      .map((sg) => (
                        <SideGoalBranch key={sg.id} parentGoalId={goal.id} sideGoal={sg} side="left" />
                      ))}
                  </div>

                  {/* Main goal circle */}
                  <div className="relative">
                    <GoalNode goal={goal} index={index} highlight={highlightedGoals.has(goal.id)} onClick={() => handleGoalTap(goal)} />
                    {/* Add side goal button */}
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setSideGoalModal({ goalId: goal.id })}
                      className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full
                                 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400
                                 flex items-center justify-center hover:bg-yellow-500/30 transition-colors"
                      title="Add side goal"
                    >
                      <Plus className="w-3 h-3" />
                    </motion.button>
                  </div>

                  {/* Right side goals */}
                  <div className="flex flex-col gap-1 items-start min-w-[90px]">
                    {(goal.sideGoals || [])
                      .filter((_, i) => i % 2 === 1)
                      .map((sg) => (
                        <SideGoalBranch key={sg.id} parentGoalId={goal.id} sideGoal={sg} side="right" />
                      ))}
                  </div>
                </div>
              </div>
            );
          })}

          {sortedGoals.length === 0 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted text-sm text-center mt-40">
              No goals yet. Tap the menu to add your first goal!
            </motion.p>
          )}
        </div>
      </div>

      {/* ── Settings panel ──────────────────────────────────── */}
      <SettingsView
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        session={session}
        onLogout={onLogout}
      />

      {/* ── Side Goal Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {sideGoalModal && (
          <>
            <motion.div
              key="sg-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSideGoalModal(null)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              key="sg-modal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-x-4 top-1/3 z-50 max-w-sm mx-auto bg-surface rounded-2xl p-5 border border-yellow-500/20"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-yellow-400">Add Side Goal</h3>
                <button onClick={() => setSideGoalModal(null)} className="text-muted hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Side goal name"
                  value={sgTitle}
                  onChange={(e) => setSgTitle(e.target.value)}
                  className="w-full bg-background/60 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none border border-white/5 focus:border-yellow-500/40 transition-colors"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Target amount ($)"
                  value={sgAmount}
                  onChange={(e) => setSgAmount(e.target.value)}
                  className="w-full bg-background/60 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none border border-white/5 focus:border-yellow-500/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAddSideGoal}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-yellow-500/20 text-yellow-400 text-sm font-medium hover:bg-yellow-500/30 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Side Goal
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Tap-to-Fund Modal ───────────────────────────────── */}
      <AnimatePresence>
        {fundGoalModal && (
          <>
            <motion.div
              key="fund-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFundGoalModal(null)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              key="fund-modal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-x-4 top-1/3 z-50 max-w-sm mx-auto bg-surface rounded-2xl p-5 border border-purple-500/20"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-accent">
                  Fund: {fundGoalModal.goalTitle}
                </h3>
                <button onClick={() => setFundGoalModal(null)} className="text-muted hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-3 text-[12px] text-muted space-y-1">
                <p>Available (unallocated): <span className="text-accent font-mono">${totalUnallocated.toFixed(2)}</span></p>
                <p>Remaining for goal: <span className="text-foreground font-mono">${fundGoalModal.remaining.toFixed(2)}</span></p>
              </div>

              {totalUnallocated <= 0 ? (
                <p className="text-[12px] text-red-400 mb-3">
                  No unallocated funds available. Deposits from the Trading Journal app will appear here after syncing.
                </p>
              ) : (
                <div className="space-y-3">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder={`Amount (max $${Math.min(totalUnallocated, fundGoalModal.remaining).toFixed(2)})`}
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    className="w-full bg-background/60 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none border border-white/5 focus:border-purple-500/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleConfirmFund}
                    disabled={!fundAmount || parseFloat(fundAmount) <= 0}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-500/20 text-purple-300 text-sm font-medium hover:bg-purple-500/30 transition-colors disabled:opacity-40"
                  >
                    <DollarSign className="w-4 h-4" />
                    Add Funds
                  </motion.button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  SideGoalBranch – yellow branch with connector line
 * ═══════════════════════════════════════════════════════════════════ */

import { SideGoal } from "@/lib/types";

function SideGoalBranch({
  parentGoalId,
  sideGoal,
  side,
}: {
  parentGoalId: string;
  sideGoal: SideGoal;
  side: "left" | "right";
}) {
  const { addSubSideGoal, removeSideGoal, addFundsToSideGoal } = useGoals();
  const [showAddSub, setShowAddSub] = useState(false);
  const [subTitle, setSubTitle] = useState("");
  const [subAmount, setSubAmount] = useState("");
  const [showFundInput, setShowFundInput] = useState(false);
  const [fundAmount, setFundAmount] = useState("");

  const handleAddSub = () => {
    const amt = parseFloat(subAmount);
    if (!subTitle.trim() || !amt || amt <= 0) return;
    addSubSideGoal(parentGoalId, sideGoal.id, subTitle.trim(), amt);
    setShowAddSub(false);
    setSubTitle("");
    setSubAmount("");
  };

  const handleAddFunds = () => {
    const amt = parseFloat(fundAmount);
    if (!amt || amt <= 0) return;
    addFundsToSideGoal(parentGoalId, sideGoal.id, amt);
    setShowFundInput(false);
    setFundAmount("");
  };

  return (
    <div className={`flex ${side === "left" ? "flex-row-reverse" : "flex-row"} items-center gap-1`}>
      {/* Connector line */}
      <div className="w-6 h-0.5 bg-yellow-500/40" />

      <div className="flex flex-col items-center gap-1">
        <SideGoalNode
          sideGoal={sideGoal}
          onRemove={() => removeSideGoal(parentGoalId, sideGoal.id)}
          onAddFunds={() => setShowFundInput(!showFundInput)}
          onAddSubGoal={() => setShowAddSub(!showAddSub)}
        />

        {/* Fund input */}
        {showFundInput && (
          <div className="flex items-center gap-1 mt-1">
            <input
              type="number"
              placeholder="$"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              className="w-16 bg-background/60 rounded-lg px-2 py-1 text-[10px] text-foreground outline-none border border-yellow-500/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button onClick={handleAddFunds} className="text-yellow-400 text-[10px]">+</button>
          </div>
        )}

        {/* Add sub-goal form */}
        {showAddSub && (
          <div className="flex flex-col gap-1 mt-1 w-24">
            <input
              type="text"
              placeholder="Name"
              value={subTitle}
              onChange={(e) => setSubTitle(e.target.value)}
              className="w-full bg-background/60 rounded-lg px-2 py-1 text-[10px] text-foreground outline-none border border-yellow-500/30"
            />
            <input
              type="number"
              placeholder="Amount"
              value={subAmount}
              onChange={(e) => setSubAmount(e.target.value)}
              className="w-full bg-background/60 rounded-lg px-2 py-1 text-[10px] text-foreground outline-none border border-yellow-500/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button onClick={handleAddSub} className="text-yellow-400 text-[10px] bg-yellow-500/10 rounded-lg py-1">Add</button>
          </div>
        )}

        {/* Sub-goals */}
        {(sideGoal.subGoals || []).map((sub) => (
          <div key={sub.id} className="flex flex-col items-center mt-1">
            <div className="w-0.5 h-3 bg-yellow-500/30" />
            <SideGoalNode sideGoal={sub} small />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  PipeSegment – Glowing SVG connector
 * ═══════════════════════════════════════════════════════════════════ */

interface PipeSegmentProps {
  active: boolean;
  filled: boolean;
  permanentLit: boolean;
  sequenceIndex: number;
}

function PipeSegment({ active, filled, permanentLit, sequenceIndex }: PipeSegmentProps) {
  const PIPE_HEIGHT = 70 + NODE_GAP;
  const baseStroke = 2;
  const litStroke = filled ? 5 : permanentLit ? 4 : 3;
  const ORB_RX = 9;
  const ORB_RY = 14;
  const delay = sequenceIndex * SEGMENT_STAGGER;
  const shouldGlow = filled || permanentLit;

  return (
    <div className="relative flex items-center justify-center" style={{ height: PIPE_HEIGHT }}>
      <svg width="32" height={PIPE_HEIGHT} viewBox={`0 0 32 ${PIPE_HEIGHT}`} className="overflow-visible">
        <line x1="16" y1="0" x2="16" y2={PIPE_HEIGHT} stroke="rgba(113,113,122,0.15)" strokeWidth={baseStroke} strokeLinecap="round" />
        <motion.line
          x1="16" y1={PIPE_HEIGHT} x2="16" y2="0"
          stroke={filled ? "url(#pipeGlowFilled)" : "url(#pipeGlow)"}
          strokeWidth={litStroke} strokeLinecap="round"
          initial={{ pathLength: shouldGlow ? 1 : 0 }}
          animate={{ pathLength: shouldGlow || active ? 1 : 0, opacity: shouldGlow || active ? 1 : 0 }}
          transition={{ duration: shouldGlow ? 0 : SEGMENT_ANIM_DURATION, delay: active && !shouldGlow ? delay : 0, ease: "easeInOut" }}
          className={filled ? "glow-purple-strong" : shouldGlow ? "glow-purple" : active ? "glow-purple" : ""}
        />
        <AnimatePresence>
          {active && (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.ellipse cx="16" rx={ORB_RX + 6} ry={ORB_RY + 10} fill="rgba(168,85,247,0.12)" initial={{ cy: PIPE_HEIGHT }} animate={{ cy: 0 }} transition={{ duration: SEGMENT_ANIM_DURATION, delay, ease: "easeInOut" }} />
              <motion.ellipse cx="16" rx={ORB_RX} ry={ORB_RY} fill="rgba(168,85,247,0.3)" className="glow-purple-strong" initial={{ cy: PIPE_HEIGHT }} animate={{ cy: 0 }} transition={{ duration: SEGMENT_ANIM_DURATION, delay, ease: "easeInOut" }} />
              <motion.ellipse cx="16" rx={ORB_RX - 3} ry={ORB_RY - 3} fill="#c084fc" className="glow-purple-strong" initial={{ cy: PIPE_HEIGHT, opacity: 0 }} animate={{ cy: 0, opacity: [0, 1, 1, 0.2] }} transition={{ duration: SEGMENT_ANIM_DURATION, delay, ease: "easeInOut" }} />
            </motion.g>
          )}
        </AnimatePresence>
        <defs>
          <linearGradient id="pipeGlow" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
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
