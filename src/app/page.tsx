/**
 * page.tsx  –  Application Entry Point
 * ----------------------------------------
 * This is the single route for the entire SPA.  It orchestrates:
 *
 *  1. **PIN Screen** – Shown on initial load.  User must enter the
 *     correct PIN ("1234") before proceeding.
 *  2. **Main View**  – The goal-chain visualization with water-flow
 *     animations, fund input, and settings panel.
 *
 * Authentication state is kept in React state (not persisted) so the
 * PIN is required on every page load / refresh.
 *
 * The `GoalsProvider` wraps the entire authenticated UI so all child
 * components share the same goal state.
 */

"use client";

import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import PinScreen from "@/components/PinScreen";
import MainView from "@/components/MainView";
import { GoalsProvider } from "@/lib/store";

/* ── Page Component ────────────────────────────────────────────── */

export default function Home() {
  /**
   * `authenticated` flips to `true` once the correct PIN is entered.
   * It is intentionally *not* persisted — every refresh requires re-auth.
   */
  const [authenticated, setAuthenticated] = useState(false);

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <AnimatePresence mode="wait">
        {!authenticated ? (
          /**
           * Gate: PIN lock screen.
           * `onSuccess` callback transitions the user to the main app.
           */
          <PinScreen
            key="pin"
            onSuccess={() => setAuthenticated(true)}
          />
        ) : (
          /**
           * Authenticated: Goal tracker wrapped in the state provider.
           * Every child can call `useGoals()` to read/write goal data.
           */
          <GoalsProvider key="app">
            <MainView />
          </GoalsProvider>
        )}
      </AnimatePresence>
    </main>
  );
}
