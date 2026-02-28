/**
 * AppShell.tsx  –  Top-level tabbed layout
 * ------------------------------------------
 * Provides a horizontal slider bar at the top to switch between
 * Money Goals and Expenses (combined discretionary + bills) pages.
 */

"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Target, Receipt } from "lucide-react";
import MainView from "@/components/MainView";
import ExpensesView from "@/components/ExpensesView";
import { AuthSession } from "@/lib/types";

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
    </motion.div>
  );
}
