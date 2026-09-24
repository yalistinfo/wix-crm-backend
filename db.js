// Persistent storage via Upstash Redis (REST API — no extra client library needed).
//
// WHY: Render's free tier wipes local files on every redeploy. This file
// used to write to a local data.json, which meant every code update we
// pushed silently erased your CRM's data. Upstash Redis is a real,
// persistent, free-tier database — data survives redeploys, restarts,
// everything.
//
// Setup: sign up at upstash.com (free), create a Redis database, copy its
// REST URL and REST TOKEN into Render's environment variables as
// UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "wixcrm:data";

const defaultData = { contacts: [], records: [], deals: [], invoices: [] };

export const db = { data: { ...defaultData } };

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Redis GET failed: ${res.status}`);
  const json = await res.json();
  return json.result;
}

async function redisSet(key, value) {
  const res = await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "text/plain" },
    body: value,
  });
  if (!res.ok) throw new Error(`Redis SET failed: ${res.status}`);
  return res.json();
}

export async function initDb() {
  if (!REDIS_URL || !REDIS_TOKEN) {
    console.error(
      "[db] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — data will NOT persist across redeploys until this is fixed."
    );
    return;
  }
  try {
    const raw = await redisGet(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      db.data = {
        contacts: parsed.contacts || [],
        records: parsed.records || [],
        deals: parsed.deals || [],
        invoices: parsed.invoices || [],
      };
    }
  } catch (e) {
    console.error("[db] failed to load from Redis, starting empty:", e.message);
  }
}

// Keeping the name db.write() so nothing else in the codebase needs to change.
db.write = async function () {
  if (!REDIS_URL || !REDIS_TOKEN) return; // already logged the warning in initDb
  await redisSet(KEY, JSON.stringify(db.data));
};
