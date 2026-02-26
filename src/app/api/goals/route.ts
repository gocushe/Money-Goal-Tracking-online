/**
 * GET & PUT  /api/goals
 * -----------------------
 * Server-side API route that bridges the frontend with Redis.
 *
 * Endpoints:
 *   GET  /api/goals  → Returns the stored `Goal[]` JSON array.
 *   PUT  /api/goals  → Accepts a `Goal[]` JSON body and overwrites
 *                       the entire array in Redis.
 *
 * If `REDIS_URL` is not configured (e.g. local dev without Redis),
 * the endpoints return a 503 with a helpful message so the frontend
 * can fall back to localStorage gracefully.
 *
 * Data shape stored in Redis (single key `money-goals:goals`):
 *   JSON string of `Goal[]`  –  see `@/lib/types` for the interface.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRedisClient, GOALS_KEY } from "@/lib/redis";
import { Goal } from "@/lib/types";

/* ── GET handler ──────────────────────────────────────────────── */
/**
 * Fetch all goals from Redis.
 * Returns `{ goals: Goal[] }` on success.
 * Returns `{ goals: null }` with 503 if Redis is unavailable.
 */
export async function GET() {
  try {
    const redis = await getRedisClient();

    /* Redis not configured — signal the frontend to use localStorage. */
    if (!redis) {
      return NextResponse.json(
        { goals: null, message: "Redis not configured" },
        { status: 503 }
      );
    }

    const raw = await redis.get(GOALS_KEY);
    const goals: Goal[] = raw ? JSON.parse(raw) : [];

    return NextResponse.json({ goals }, { status: 200 });
  } catch (error) {
    console.error("[api/goals] GET error:", error);
    return NextResponse.json(
      { goals: null, message: "Internal server error" },
      { status: 500 }
    );
  }
}

/* ── PUT handler ──────────────────────────────────────────────── */
/**
 * Overwrite the entire goals array in Redis.
 * Expects body: `{ goals: Goal[] }`.
 * Returns `{ success: true }` on success, appropriate error otherwise.
 */
export async function PUT(request: NextRequest) {
  try {
    const redis = await getRedisClient();

    if (!redis) {
      return NextResponse.json(
        { success: false, message: "Redis not configured" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const goals: Goal[] = body.goals;

    /* Basic validation: must be an array. */
    if (!Array.isArray(goals)) {
      return NextResponse.json(
        { success: false, message: "Invalid payload – goals must be an array" },
        { status: 400 }
      );
    }

    /* Persist the entire array as a single JSON string. */
    await redis.set(GOALS_KEY, JSON.stringify(goals));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[api/goals] PUT error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
