import "dotenv/config";
import express from "express";
import cors from "cors";
import cron from "node-cron";
import { initDb, db } from "./db.js";
import { syncAllFromWix } from "./wix.js";
import { sendReminderDigest } from "./mailer.js";

const CLOSED_STATUSES = ["Complete", "Lost", "Lost to price", "Dead"];

const app = express();
app.use(cors());
app.use(express.json());

await initDb();

// TEMPORARY DEBUG ENDPOINT — remove before deploying anywhere public.
// Shows whether .env actually loaded, without exposing the real secret.
app.get("/api/debug-env", (req, res) => {
  const key = process.env.WIX_API_KEY || "";
  res.json({
    WIX_API_KEY_length: key.length,
    WIX_API_KEY_last6: key.slice(-6),
    WIX_SITE_ID: process.env.WIX_SITE_ID || "(missing)",
    WIX_ACCOUNT_ID: process.env.WIX_ACCOUNT_ID || "(missing)",
  });
});

/* ---------- Whole-app data (used by the frontend) ---------- */
app.get("/api/data", (req, res) => {
  res.json({ contacts: db.data.contacts, records: db.data.records, deals: db.data.deals });
});
app.put("/api/data", async (req, res) => {
  db.data.contacts = req.body.contacts || [];
  db.data.records = req.body.records || [];
  db.data.deals = req.body.deals || [];
  await db.write();
  res.json({ ok: true });
});

/* ---------- Contacts ---------- */
app.get("/api/contacts", (req, res) => res.json(db.data.contacts));
app.post("/api/contacts", async (req, res) => {
  const c = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...req.body };
  db.data.contacts.push(c);
  await db.write();
  res.json(c);
});
app.patch("/api/contacts/:id", async (req, res) => {
  const c = db.data.contacts.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: "not found" });
  Object.assign(c, req.body);
  await db.write();
  res.json(c);
});
app.delete("/api/contacts/:id", async (req, res) => {
  db.data.contacts = db.data.contacts.filter((x) => x.id !== req.params.id);
  db.data.records = db.data.records.filter((x) => x.contactId !== req.params.id);
  await db.write();
  res.json({ ok: true });
});

/* ---------- Records (orders/bookings/quotes/invoices) ---------- */
app.get("/api/records", (req, res) => res.json(db.data.records));
app.post("/api/records", async (req, res) => {
  const r = { id: crypto.randomUUID(), ...req.body };
  db.data.records.push(r);
  await db.write();
  res.json(r);
});
app.patch("/api/records/:id", async (req, res) => {
  const r = db.data.records.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: "not found" });
  Object.assign(r, req.body);
  await db.write();
  res.json(r);
});
app.delete("/api/records/:id", async (req, res) => {
  db.data.records = db.data.records.filter((x) => x.id !== req.params.id);
  await db.write();
  res.json({ ok: true });
});

/* ---------- Deals ---------- */
app.get("/api/deals", (req, res) => res.json(db.data.deals));
app.post("/api/deals", async (req, res) => {
  const d = { id: crypto.randomUUID(), status: "Uncontacted", lastContact: "", nextReminder: "", ...req.body };
  db.data.deals.push(d);
  await db.write();
  res.json(d);
});
app.patch("/api/deals/:id", async (req, res) => {
  const d = db.data.deals.find((x) => x.id === req.params.id);
  if (!d) return res.status(404).json({ error: "not found" });
  Object.assign(d, req.body);
  await db.write();
  res.json(d);
});
app.delete("/api/deals/:id", async (req, res) => {
  db.data.deals = db.data.deals.filter((x) => x.id !== req.params.id);
  await db.write();
  res.json({ ok: true });
});

/* ---------- Manual trigger endpoints (useful for testing) ---------- */
function upsertContact(wixContact) {
  let existing = db.data.contacts.find((c) => c.wixId === wixContact.wixId);
  if (existing) {
    Object.assign(existing, {
      name: wixContact.name,
      email: wixContact.email,
      phone: wixContact.phone,
    });
    return existing;
  }
  const created = {
    id: crypto.randomUUID(),
    wixId: wixContact.wixId,
    name: wixContact.name,
    email: wixContact.email,
    phone: wixContact.phone,
    company: "",
    stage: "Lead",
    createdAt: new Date().toISOString(),
  };
  db.data.contacts.push(created);
  return created;
}

function upsertRecord(type, item, contactLocalId) {
  const existing = db.data.records.find((r) => r.wixId === item.wixId && r.type === type);
  const payload = {
    wixId: item.wixId,
    contactId: contactLocalId || "",
    type,
    title: item.title,
    amount: item.amount || 0,
    status: item.status,
    date: item.date,
    notes: "",
  };
  if (existing) {
    Object.assign(existing, payload);
  } else {
    db.data.records.push({ id: crypto.randomUUID(), ...payload });
  }
}

function mergeWixDataIn(wixResult) {
  const contactIdMap = {}; // wix contact id -> local contact id
  (wixResult.contacts || []).forEach((c) => {
    const local = upsertContact(c);
    contactIdMap[c.wixId] = local.id;
  });
  (wixResult.orders || []).forEach((o) => upsertRecord("order", o, contactIdMap[o.contactId]));
  (wixResult.bookings || []).forEach((b) => upsertRecord("booking", b, contactIdMap[b.contactId]));
  (wixResult.quotes || []).forEach((q) => upsertRecord("quote", q, contactIdMap[q.contactId]));
  (wixResult.invoices || []).forEach((i) => upsertRecord("invoice", i, contactIdMap[i.contactId]));
}

app.post("/api/sync-wix", async (req, res) => {
  try {
    const result = await syncAllFromWix();
    const { _errors, ...sources } = result;
    mergeWixDataIn(sources);
    await db.write();
    res.json({
      ok: true,
      counts: Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, v.length])),
      errors: _errors,
      savedContacts: db.data.contacts.length,
      savedRecords: db.data.records.length,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/send-digest-now", async (req, res) => {
  try {
    const result = await runDigest();
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

async function runDigest() {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = db.data.deals.filter(
    (d) => !CLOSED_STATUSES.includes(d.status) && d.nextReminder && d.nextReminder <= today
  );
  return sendReminderDigest(overdue);
}

/* ---------- Scheduled jobs ---------- */
cron.schedule(process.env.DIGEST_CRON || "0 8 * * *", async () => {
  try {
    const result = await runDigest();
    console.log("[digest]", result);
  } catch (e) {
    console.error("[digest] failed", e);
  }
});

const syncMinutes = Number(process.env.WIX_SYNC_INTERVAL_MINUTES || 30);
setInterval(async () => {
  try {
    const result = await syncAllFromWix();
    const { _errors, ...sources } = result;
    mergeWixDataIn(sources);
    await db.write();
  } catch (e) {
    console.error("[wix sync] failed", e);
  }
}, syncMinutes * 60 * 1000);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`CRM backend running on port ${port}`));
