/**
 * POST /api/external
 * ────────────────────
 * Receives payout deposits from external apps (e.g. Trading Journal V.1.15).
 * Money lands as an "unallocated deposit" — it sits in a holding area until
 * the user manually allocates it to goals, expenses, or bills on the website.
 *
 * Also handles account sync data when the `accountSync` field is present —
 * financial account balances are stored for display in the Accounts/Credit tab.
 *
 * ─── Authentication ───
 * Requires `letter` + `code` in the request body to identify the account.
 *
 * ─── Request Body (POST) ───
 * {
 *   "letter": "A",
 *   "code": "1598",
 *   "amountCAD": 1400.00,
 *   "amountUSD": 1000.00,
 *   "note": "Payout from Tradovate",
 *   "date": "2025-01-15",
 *   "accountSync": { ... }   // optional — financial account data
 * }
 *
 * ─── Response ───
 * { "success": true, "deposit": { id, amountCAD, amountUSD, ... } }
 *
 * GET /api/external?letter=X&code=XXXX
 * ─── Fetches and clears pending deposits from the server-side queue ───
 * Also returns synced account data if present.
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getRedisClient } from "@/lib/redis";

/* ── Server-side queue (file-based, works without Redis) ───────── */

const TMP_QUEUE_DIR = path.join("/tmp", ".external-queue");
const REDIS_INBOX_PREFIX = "money-goals:inbox";

function redisKey(letter: string, code: string) {
  return `${REDIS_INBOX_PREFIX}:${letter}-${code}`;
}

async function ensureQueueDir() {
  try {
    await fs.mkdir(TMP_QUEUE_DIR, { recursive: true });
  } catch {
    // already exists
  }
}

function queueFile(letter: string, code: string) {
  return path.join(TMP_QUEUE_DIR, `${letter}-${code}.json`);
}

interface QueuedDeposit {
  id: string;
  amountCAD: number;
  amountUSD: number;
  note: string;
  date: string;
  source: string;
  pushedAt: string;
}

async function readQueue(letter: string, code: string): Promise<QueuedDeposit[]> {
  try {
    await ensureQueueDir();
    const data = await fs.readFile(queueFile(letter, code), "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeQueue(letter: string, code: string, entries: QueuedDeposit[]) {
  await ensureQueueDir();
  await fs.writeFile(queueFile(letter, code), JSON.stringify(entries, null, 2));
}

async function getRedisSafe() {
  try {
    return await getRedisClient();
  } catch (err) {
    console.error("[api/external] Redis connection failed, falling back to filesystem", err);
    return null;
  }
}

/* ── Sync data storage (Redis primary, /tmp fallback) ──────────── */

const SYNC_KEY_PREFIX = "money-goals:sync";

function syncRedisKey(type: string, letter: string, code: string) {
  return `${SYNC_KEY_PREFIX}:${type}:${letter}-${code}`;
}

function syncTmpFile(type: string, letter: string, code: string) {
  return path.join(TMP_QUEUE_DIR, `${type}-${letter}-${code}.json`);
}

async function readSyncData(type: string, letter: string, code: string) {
  // Try Redis first
  const redis = await getRedisSafe();
  if (redis) {
    try {
      const raw = await redis.get(syncRedisKey(type, letter, code));
      if (raw) return JSON.parse(raw);
    } catch {
      // fall through to file
    }
  }
  // Fallback to /tmp file
  try {
    const data = await fs.readFile(syncTmpFile(type, letter, code), "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function writeSyncData(type: string, letter: string, code: string, data: unknown) {
  const json = JSON.stringify(data);
  // Write to Redis (primary)
  const redis = await getRedisSafe();
  if (redis) {
    try {
      // Store with 7-day TTL so old data auto-cleans
      await redis.set(syncRedisKey(type, letter, code), json, { EX: 604800 });
    } catch {
      // fall through to file
    }
  }
  // Also write to /tmp as fallback
  try {
    await ensureQueueDir();
    await fs.writeFile(syncTmpFile(type, letter, code), json);
  } catch {
    // ignore – Redis is the primary store
  }
}

async function readAccountSync(letter: string, code: string) {
  return readSyncData("accounts", letter, code);
}

async function writeAccountSync(letter: string, code: string, data: unknown) {
  return writeSyncData("accounts", letter, code, data);
}

async function readFullSync(letter: string, code: string) {
  return readSyncData("full-sync", letter, code);
}

async function writeFullSync(letter: string, code: string, data: unknown) {
  return writeSyncData("full-sync", letter, code, data);
}

async function readWebsiteSync(letter: string, code: string) {
  return readSyncData("website-sync", letter, code);
}

async function writeWebsiteSync(letter: string, code: string, data: unknown) {
  return writeSyncData("website-sync", letter, code, data);
}

/* ── POST: receive data from an external app ───────────────────── */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.letter || !body.code) {
      return NextResponse.json(
        { success: false, error: "Missing letter or code" },
        { status: 400 }
      );
    }

    /* ── Test ping (no side effects) ─────────────────────────── */
    if (body.note === "__TEST_PING__") {
      return NextResponse.json(
        { success: true, message: "Connection OK" },
        { status: 200 }
      );
    }

    /* ── Website pushes its data for the app to pull ────────── */
    if (body.note === "__WEBSITE_SYNC__") {
      await writeWebsiteSync(body.letter, body.code, {
        expenses: body.expenses || [],
        bills: body.bills || [],
        billPayments: body.billPayments || [],
        goals: body.goals || [],
        syncedAt: new Date().toISOString(),
      });
      return NextResponse.json(
        { success: true, message: "Website data saved for app sync" },
        { status: 200 }
      );
    }

    /* ── Full bidirectional sync ─────────────────────────────── */
    if (body.note === "__FULL_SYNC__") {
      // Store app data for the website to pick up
      if (body.accountSync) {
        await writeAccountSync(body.letter, body.code, body.accountSync);
      }
      if (body.appData) {
        await writeFullSync(body.letter, body.code, {
          ...body.appData,
          syncedAt: new Date().toISOString(),
        });
      }

      // Read website data for the app to pull
      const websiteData = await readWebsiteSync(body.letter, body.code);

      return NextResponse.json(
        {
          success: true,
          synced: true,
          websiteData: websiteData || null,
          message: "Full sync complete",
        },
        { status: 200 }
      );
    }

    /* ── Handle account sync data (sent with note === "__ACCOUNT_SYNC__") ── */
    if (body.accountSync) {
      await writeAccountSync(body.letter, body.code, body.accountSync);

      // If this is a pure account sync (no real deposit), return early
      if (body.note === "__ACCOUNT_SYNC__") {
        return NextResponse.json(
          { success: true, accountsSynced: true, message: "Account data synced" },
          { status: 200 }
        );
      }
    }

    const amountCAD = parseFloat(body.amountCAD) || 0;
    const amountUSD = parseFloat(body.amountUSD) || 0;

    if (amountCAD <= 0 && amountUSD <= 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    const deposit: QueuedDeposit = {
      id: crypto.randomUUID(),
      amountCAD,
      amountUSD,
      note: body.note || "",
      date: body.date || new Date().toISOString().split("T")[0],
      source: body.source || "Trading Journal",
      pushedAt: new Date().toISOString(),
    };

    // Append to queue for the client to pick up
    const redis = await getRedisSafe();
    if (redis) {
      await redis.rPush(redisKey(body.letter, body.code), JSON.stringify(deposit));
    } else {
      const queue = await readQueue(body.letter, body.code);
      queue.push(deposit);
      await writeQueue(body.letter, body.code, queue);
    }

    return NextResponse.json(
      {
        success: true,
        deposit,
        message: `CA$${amountCAD.toFixed(2)} queued for ${body.letter}-${body.code} holding area`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[api/external] POST error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/* ── GET: fetch and clear pending deposits ─────────────────────── */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const letter = searchParams.get("letter");
    const code = searchParams.get("code");

    if (!letter || !code) {
      return NextResponse.json(
        { success: false, error: "Missing letter or code query params" },
        { status: 400 }
      );
    }

    const redis = await getRedisSafe();
    let queue: QueuedDeposit[] = [];

    if (redis) {
      const rawEntries = await redis.lRange(redisKey(letter, code), 0, -1);
      queue = rawEntries
        .map((entry) => {
          try {
            return JSON.parse(entry) as QueuedDeposit;
          } catch {
            return null;
          }
        })
        .filter(Boolean) as QueuedDeposit[];
      if (queue.length > 0) {
        await redis.del(redisKey(letter, code));
      }
    } else {
      queue = await readQueue(letter, code);
      if (queue.length > 0) {
        await writeQueue(letter, code, []);
      }
    }

    /* Also fetch synced account data and full app sync (non-destructive reads) */
    const accountData = await readAccountSync(letter, code);
    const fullSyncData = await readFullSync(letter, code);

    return NextResponse.json(
      {
        success: true,
        deposits: queue,
        count: queue.length,
        accountSync: accountData || null,
        appData: fullSyncData || null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[api/external] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
