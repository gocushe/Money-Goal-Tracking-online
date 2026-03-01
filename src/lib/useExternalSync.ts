/**
 * useExternalSync.ts  –  Client-side polling for external deposits, account sync & full data sync
 * ------------------------------------------------------------------
 * Polls /api/external?letter=X&code=XXXX every 30 seconds to pick up
 * new deposits pushed from the Trading Journal (or any external source).
 *
 * Deposits are added to the UnallocatedFunds context — they sit in a
 * visible "holding area" until the user manually allocates them to
 * goals, expenses, or bills.
 *
 * Also picks up account-sync data (financial & trading accounts) and
 * stores it in the AccountSync context.
 *
 * Full sync: imports app expenses as website spending entries,
 * imports app recurringExpenses as website bills,
 * and pushes website data back for the app to pull.
 */

"use client";

import { useEffect, useCallback, useRef } from "react";
import {
  useUnallocatedFunds,
  useAccountSync,
  useSpending,
  useBills,
  useGoals,
} from "@/lib/store";
import {
  AuthSession,
  AccountSyncData,
  SpendingEntry,
  BillFrequency,
} from "@/lib/types";

const POLL_INTERVAL = 15_000; // 15 seconds

interface QueuedDeposit {
  id: string;
  amountCAD: number;
  amountUSD: number;
  note: string;
  date: string;
  source: string;
  pushedAt: string;
}

interface AppExpense {
  id: string;
  title: string;
  amount: number;
  date: string;
  category?: string;
}

interface AppRecurring {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  dueDay: number;
  category?: string;
  active?: boolean;
}

export function useExternalSync(session: AuthSession) {
  const { addDeposit } = useUnallocatedFunds();
  const { setAccountSync } = useAccountSync();
  const { entries: spendingEntries, setEntries: setSpendingEntries } = useSpending();
  const { bills, billPayments, setBills, setBillPayments } = useBills();
  const { goals } = useGoals();

  const addDepositRef = useRef(addDeposit);
  const setAccountSyncRef = useRef(setAccountSync);
  const setSpendingEntriesRef = useRef(setSpendingEntries);
  const setBillsRef = useRef(setBills);

  // Keep mutable refs for data we want to push (avoids re-triggering the poll effect)
  const spendingRef = useRef(spendingEntries);
  const billsRef = useRef(bills);
  const billPaymentsRef = useRef(billPayments);
  const goalsRef = useRef(goals);

  // Track previous data hashes to detect website-side changes
  const prevSpendingHashRef = useRef("");
  const prevBillsHashRef = useRef("");

  useEffect(() => { addDepositRef.current = addDeposit; }, [addDeposit]);
  useEffect(() => { setAccountSyncRef.current = setAccountSync; }, [setAccountSync]);
  useEffect(() => { setSpendingEntriesRef.current = setSpendingEntries; }, [setSpendingEntries]);
  useEffect(() => { setBillsRef.current = setBills; }, [setBills]);
  useEffect(() => { spendingRef.current = spendingEntries; }, [spendingEntries]);
  useEffect(() => { billsRef.current = bills; }, [bills]);
  useEffect(() => { billPaymentsRef.current = billPayments; }, [billPayments]);
  useEffect(() => { goalsRef.current = goals; }, [goals]);

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

  /** Merge app expenses into website spending (add new, skip existing by id). */
  const mergeAppExpenses = useCallback((appExpenses: AppExpense[]) => {
    if (!appExpenses || appExpenses.length === 0) return;
    const currentEntries = spendingRef.current;
    const existingIds = new Set(currentEntries.map((e) => e.id));
    const newEntries: SpendingEntry[] = [];
    for (const ae of appExpenses) {
      const syncId = `app-${ae.id}`;
      if (!existingIds.has(syncId)) {
        newEntries.push({
          id: syncId,
          title: ae.title || "Untitled",
          amount: ae.amount,
          date: ae.date,
        });
      }
    }
    if (newEntries.length > 0) {
      setSpendingEntriesRef.current([...currentEntries, ...newEntries]);
    }
  }, []);

  /** Merge app recurring expenses into website bills (add new, update existing). */
  const mergeAppBills = useCallback((appRecurring: AppRecurring[]) => {
    if (!appRecurring || appRecurring.length === 0) return;
    const currentBills = billsRef.current;
    const billMap = new Map(currentBills.map((b) => [b.id, b]));
    let changed = false;

    for (const ar of appRecurring) {
      if (ar.active === false) continue;
      const syncId = `app-${ar.id}`;
      const freq = (ar.frequency || "monthly") as BillFrequency;
      if (!billMap.has(syncId)) {
        billMap.set(syncId, {
          id: syncId,
          name: ar.name || "Unnamed",
          amount: ar.amount,
          dueDay: ar.dueDay || 1,
          frequency: freq,
          category: ar.category || "General",
          isPaid: false,
        });
        changed = true;
      } else {
        // Update amount if changed
        const existing = billMap.get(syncId)!;
        if (existing.amount !== ar.amount || existing.name !== ar.name) {
          billMap.set(syncId, { ...existing, name: ar.name, amount: ar.amount });
          changed = true;
        }
      }
    }
    if (changed) {
      setBillsRef.current(Array.from(billMap.values()));
    }
  }, []);

  /** Push website data to server for the app to pull. */
  const pushWebsiteData = useCallback(async () => {
    try {
      await fetch("/api/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          letter: session.letter,
          code: session.code,
          note: "__WEBSITE_SYNC__",
          expenses: spendingRef.current,
          bills: billsRef.current,
          billPayments: billPaymentsRef.current,
          goals: goalsRef.current.map((g) => ({
            id: g.id,
            title: g.title,
            targetAmount: g.targetAmount,
            currentAmount: g.currentAmount,
          })),
        }),
      });
    } catch {
      // Silently ignore — website data push is best-effort
    }
  }, [session.letter, session.code]);

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
        // Process account sync data
        if (data.accountSync) {
          setAccountSyncRef.current(data.accountSync as AccountSyncData);
        }
        // Process full app data (expenses, recurring bills)
        if (data.appData) {
          if (data.appData.expenses) {
            mergeAppExpenses(data.appData.expenses);
          }
          if (data.appData.recurringExpenses) {
            mergeAppBills(data.appData.recurringExpenses);
          }
        }
        // Push website data back for app to pull
        await pushWebsiteData();
      } catch {
        // Silently ignore network errors on polling
      }
    };

    // Initial poll after a short delay
    const initialTimeout = setTimeout(poll, 2000);
    timer = setInterval(poll, POLL_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(timer);
    };
  }, [session.letter, session.code, processDeposits, mergeAppExpenses, mergeAppBills, pushWebsiteData]);

  // Auto-push website data when spending or bills change locally
  useEffect(() => {
    const hash = JSON.stringify(spendingEntries.map((e) => e.id + e.amount));
    if (prevSpendingHashRef.current && prevSpendingHashRef.current !== hash) {
      pushWebsiteData();
    }
    prevSpendingHashRef.current = hash;
  }, [spendingEntries, pushWebsiteData]);

  useEffect(() => {
    const hash = JSON.stringify(bills.map((b) => b.id + b.amount + b.isPaid));
    if (prevBillsHashRef.current && prevBillsHashRef.current !== hash) {
      pushWebsiteData();
    }
    prevBillsHashRef.current = hash;
  }, [bills, pushWebsiteData]);
}
