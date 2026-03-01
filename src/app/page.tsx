/**
 * page.tsx  –  Application Entry Point
 * ----------------------------------------
 * Orchestrates:
 *  1. PIN Screen (letter + code) — multi-account auth.
 *  2. Tab-based main app — Money Goals, Spending, Bills.
 */

"use client";

import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import PinScreen from "@/components/PinScreen";
import AppShell from "@/components/AppShell";
import { GoalsProvider, SpendingProvider, BillsProvider, UnallocatedFundsProvider, AccountSyncProvider } from "@/lib/store";
import { AuthSession } from "@/lib/types";

export default function Home() {
  const [session, setSession] = useState<AuthSession | null>(null);

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <AnimatePresence mode="wait">
        {!session ? (
          <PinScreen
            key="pin"
            onSuccess={(s) => setSession(s)}
          />
        ) : (
          <GoalsProvider key={`goals-${session.letter}-${session.code}`} session={session}>
            <SpendingProvider session={session}>
              <BillsProvider session={session}>
                <UnallocatedFundsProvider session={session}>
                  <AccountSyncProvider session={session}>
                    <AppShell session={session} onLogout={() => setSession(null)} />
                  </AccountSyncProvider>
                </UnallocatedFundsProvider>
              </BillsProvider>
            </SpendingProvider>
          </GoalsProvider>
        )}
      </AnimatePresence>
    </main>
  );
}
