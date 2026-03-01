/**
 * AppShell.tsx  –  Top-level tabbed layout
 * ------------------------------------------
 * Provides a horizontal slider bar at the top to switch between
 * Money Goals and Expenses (combined discretionary + bills) pages.
 */

"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Receipt, RefreshCw, Settings, Wallet } from "lucide-react";
import MainView from "@/components/MainView";
import ExpensesView from "@/components/ExpensesView";
import SettingsView from "@/components/SettingsView";
import { AuthSession } from "@/lib/types";
import { useExternalSync } from "@/lib/useExternalSync";
import { useUnallocatedFunds } from "@/lib/store";

const TABS = [
  { id: "goals", label: "Goals", icon: Target },
  { id: "expenses", label: "Expenses", icon: Receipt },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface AppShellProps {
  session: AuthSession;
  onLogout: () => void;
}

export default function AppShell({ session, onLogout }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<TabId>("goals");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { totalUnallocated, deposits } = useUnallocatedFunds();

  // External sync runs at the shell level so it stays active regardless of tab
  useExternalSync(session);

  /** Manual sync trigger — forces a poll of the external API */
  const handleManualSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      // Trigger a sync by calling the API directly
      const res = await fetch(
        `/api/external?letter=${encodeURIComponent(session.letter)}&code=${encodeURIComponent(session.code)}`
      );
      if (res.ok) {
        // The useExternalSync hook will pick up the data on its next poll
        // For immediate feedback, we can force a page-level state refresh
        window.dispatchEvent(new CustomEvent('money-goals-sync'));
      }
    } catch {
      // Silently ignore
    } finally {
      setTimeout(() => setIsSyncing(false), 800);
    }
  }, [session.letter, session.code]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="min-h-dvh"
    >
      {/* ── Tab slider bar ──────────────────────────────────────── */}
      <div className="fixed top-0 inset-x-0 z-40 px-4 pt-3 pb-2 bg-background/95 backdrop-blur-lg border-b border-white/5">
        {/* Account badge */}
        <div className="flex items-center justify-center mb-2">
          <span className="text-[11px] text-muted tracking-wider uppercase">
            {session.letter}-{session.code} &middot; {session.label}
          </span>
        </div>

        {/* Tab buttons */}
        <div className="flex items-center bg-surface/60 rounded-xl p-1 max-w-md mx-auto relative">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-colors z-10 ${
                  isActive ? "text-foreground" : "text-muted hover:text-foreground/70"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute inset-0 bg-accent/20 rounded-lg border border-accent/30"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Page content ────────────────────────────────────────── */}
      <div className="pt-[88px]">
        {activeTab === "goals" && <MainView session={session} onLogout={onLogout} />}
        {activeTab === "expenses" && <ExpensesView />}
      </div>

      {/* ── Floating Action Button ─────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end">
        {/* Unallocated badge */}
        {totalUnallocated > 0 && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-[10px] text-green-400"
          >
            <Wallet className="w-3 h-3" />
            ${totalUnallocated.toLocaleString()} unallocated
          </motion.div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleManualSync}
            disabled={isSyncing}
            className="w-11 h-11 rounded-full bg-surface border border-white/10 flex items-center justify-center text-muted hover:text-accent hover:border-accent/30 transition-colors shadow-lg disabled:opacity-50"
            title="Sync now"
          >
            <RefreshCw className={`w-4.5 h-4.5 ${isSyncing ? "animate-spin" : ""}`} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSettingsOpen(true)}
            className="w-11 h-11 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent hover:bg-accent/30 transition-colors shadow-lg"
            title="Settings"
          >
            <Settings className="w-4.5 h-4.5" />
          </motion.button>
        </div>
      </div>

      {/* ── Settings Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSettingsOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 z-50 overflow-auto"
            >
              <div className="min-h-full flex items-start justify-center py-8">
                <div className="w-full max-w-lg bg-surface rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <h2 className="text-lg font-semibold">Settings</h2>
                    <button
                      onClick={() => setSettingsOpen(false)}
                      className="text-muted hover:text-foreground text-xl leading-none"
                    >
                      ×
                    </button>
                  </div>
                  <div className="p-5">
                    <SettingsView 
                      isOpen={settingsOpen} 
                      onClose={() => setSettingsOpen(false)} 
                      session={session}
                      onLogout={onLogout}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
