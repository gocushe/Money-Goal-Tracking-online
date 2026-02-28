/**
 * useExternalSync.ts  –  Client-side polling for external deposits
 * ------------------------------------------------------------------
 * Polls /api/external?letter=X&code=XXXX every 30 seconds to pick up
 * new deposits pushed from the Trading Journal (or any external source).
 *
 * Deposits are added to the UnallocatedFunds context — they sit in a
 * visible "holding area" until the user manually allocates them to
 * goals, expenses, or bills.
 */

"use client";

import { useEffect, useCallback, useRef } from "react";
import { useUnallocatedFunds } from "@/lib/store";
import { AuthSession } from "@/lib/types";

const POLL_INTERVAL = 30_000; // 30 seconds

interface QueuedDeposit {
  id: string;
  amountCAD: number;
  amountUSD: number;
  note: string;
  date: string;
  source: string;
  pushedAt: string;
}

export function useExternalSync(session: AuthSession) {
  const { addDeposit } = useUnallocatedFunds();
  const addDepositRef = useRef(addDeposit);

  useEffect(() => {
    addDepositRef.current = addDeposit;
  }, [addDeposit]);

  const processDeposits = useCallback((deposits: QueuedDeposit[]) => {
    for (const dep of deposits) {
      addDepositRef.current({
        amountCAD: dep.amountCAD,
        amountUSD: dep.amountUSD,
        note: dep.note,
        date: dep.date,
        source: dep.source,
        pushedAt: dep.pushedAt,
      });
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/external?letter=${encodeURIComponent(session.letter)}&code=${encodeURIComponent(session.code)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.deposits && data.deposits.length > 0) {
          processDeposits(data.deposits);
        }
      } catch {
        // Silently ignore network errors on polling
      }
    };

    // Initial poll after a short delay
    const initialTimeout = setTimeout(poll, 3000);
    timer = setInterval(poll, POLL_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(timer);
    };
  }, [session.letter, session.code, processDeposits]);
}
