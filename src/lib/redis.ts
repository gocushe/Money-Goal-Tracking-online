/**
 * redis.ts  –  Redis Client Singleton
 * --------------------------------------
 * Creates and exports a single Redis client instance that is reused
 * across all API routes.  In serverless environments (Vercel) each
 * cold-start gets its own instance, but within a single invocation
 * the connection is shared.
 *
 * The client reads the connection string from the `REDIS_URL`
 * environment variable, which Vercel populates automatically when
 * you link a Redis database to the project.
 *
 * Falls back gracefully: if `REDIS_URL` is missing the export will
 * be `null` and the API routes return appropriate errors.
 */

import { createClient, RedisClientType } from "redis";

/* ── Singleton holder ──────────────────────────────────────────── */

/**
 * We cache the client on the Node.js `globalThis` so that hot-reloads
 * in development don't create a new connection every time a file changes.
 */
const globalForRedis = globalThis as unknown as {
  __redis: RedisClientType | null;
};

/**
 * `getRedisClient()` – lazily creates and connects a Redis client.
 *
 * @returns A connected `RedisClientType`, or `null` if `REDIS_URL`
 *          is not configured.
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL;

  if (!url) {
    console.warn("[redis] REDIS_URL is not set – skipping Redis connection.");
    return null;
  }

  /* Return cached client if it already exists and is ready. */
  if (globalForRedis.__redis) {
    return globalForRedis.__redis;
  }

  /* Create a new client and connect. */
  const client = createClient({ url }) as RedisClientType;

  client.on("error", (err) => {
    console.error("[redis] Client error:", err);
  });

  await client.connect();
  console.log("[redis] Connected successfully.");

  /* Cache for reuse. */
  globalForRedis.__redis = client;
  return client;
}

/* ── Redis key used to store the goals JSON array ────────────── */
/**
 * All goals are stored as a single JSON string under this key.
 * The shape is `Goal[]` as defined in `@/lib/types`.
 */
export const GOALS_KEY = "money-goals:goals";
