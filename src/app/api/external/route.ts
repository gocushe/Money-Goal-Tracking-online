/**
 * POST /api/external
 * ────────────────────
 * Receives payout deposits from external apps (e.g. Trading Journal V.1.13).
 * Money lands as an "unallocated deposit" — it sits in a holding area until
 * the user manually allocates it to goals, expenses, or bills on the website.
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
 *   "date": "2025-01-15"
 * }
 *
 * ─── Response ───
 * { "success": true, "deposit": { id, amountCAD, amountUSD, ... } }
 *
 * GET /api/external?letter=X&code=XXXX
 * ─── Fetches and clears pending deposits from the server-side queue ───
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/* ── Server-side queue (file-based, works without Redis) ───────── */

const QUEUE_DIR = path.join(process.cwd(), ".external-queue");

async function ensureQueueDir() {
  try {
    await fs.mkdir(QUEUE_DIR, { recursive: true });
  } catch {
    // already exists
  }
}

function queueFile(letter: string, code: string) {
  return path.join(QUEUE_DIR, `${letter}-${code}.json`);
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

/* ── POST: receive a deposit from an external app ──────────────── */

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
    const queue = await readQueue(body.letter, body.code);
    queue.push(deposit);
    await writeQueue(body.letter, body.code, queue);

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

    const queue = await readQueue(letter, code);

    // Clear the queue after reading
    if (queue.length > 0) {
      await writeQueue(letter, code, []);
    }

    return NextResponse.json(
      {
        success: true,
        deposits: queue,
        count: queue.length,
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
