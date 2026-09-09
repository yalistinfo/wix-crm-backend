import fetch from "node-fetch";

const BASE = "https://www.wixapis.com";

function headers() {
  return {
    Authorization: process.env.WIX_API_KEY,
    "wix-site-id": process.env.WIX_SITE_ID,
    "Content-Type": "application/json",
  };
}

async function callWix(path, body, method = "POST") {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: method === "GET" ? undefined : JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Wix API ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

// NOTE: confirm exact endpoint paths/fields against current Wix REST docs
// (dev.wix.com) before going live — Wix has been migrating several of
// these APIs (especially Bookings and Billing) during 2026.

export async function fetchContacts() {
  const data = await callWix("/contacts/v4/contacts/query", { query: { paging: { limit: 100 } } });
  return (data.contacts || []).map((c) => ({
    wixId: c.id,
    name: [c.info?.name?.first, c.info?.name?.last].filter(Boolean).join(" ") || "Unnamed",
    email: c.info?.emails?.items?.[0]?.email || "",
    phone: c.info?.phones?.items?.[0]?.phone || "",
  }));
}

export async function fetchOrders() {
  const data = await callWix("/ecom/v1/orders/search", { search: { cursorPaging: { limit: 100 } } });
  return (data.orders || []).map((o) => ({
    wixId: o.id,
    contactId: o.buyerInfo?.contactId,
    title: `Order ${o.number || o.id}`,
    amount: Number(o.priceSummary?.total?.amount || 0),
    status: o.status,
    date: o.createdDate,
  }));
}

export async function fetchBookings() {
  const data = await callWix("/bookings/v2/bookings/query", { query: { paging: { limit: 100 } } });
  return (data.bookings || []).map((b) => ({
    wixId: b.id,
    contactId: b.contactDetails?.contactId,
    title: b.bookedEntity?.title || "Booking",
    status: b.status,
    date: b.createdDate,
  }));
}

// NOTE: Price Quotes still has NO public REST API and no bulk query
// method at all (confirmed against Wix's docs, Sept 2026) — only
// get-by-ID, create, update, delete, send. The only way to capture
// quotes is the event-listener bridge in velo-bridge/ (events.js +
// http-functions.js) running on your own Wix site.
export async function fetchQuotes() {
  const base = process.env.WIX_SITE_URL;
  const secret = process.env.VELO_BRIDGE_SECRET;
  if (!base || !secret) {
    throw new Error(
      "Set WIX_SITE_URL and VELO_BRIDGE_SECRET in .env, and deploy velo-bridge/ to your Wix site first."
    );
  }
  const res = await fetch(`${base.replace(/\/$/, "")}/_functions/quotes`, {
    headers: { "x-bridge-secret": secret },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Velo bridge /quotes failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.quotes || [];
}
export async function fetchInvoices() {
  const data = await callWix("/invoices/v4/invoices/query", {
    query: { cursorPaging: { limit: 100 } },
  });
  return (data.invoices || []).map((i) => ({
    wixId: i.id,
    contactId: i.customerInfo?.contactId || "",
    title: i.title || `Invoice ${i.numbering?.displayNumber || i.id}`,
    amount: Number(i.totals?.total || 0),
    status: i.status,
    date: i.createdDate,
  }));
}

export async function syncAllFromWix() {
  const results = await Promise.allSettled([
    fetchContacts(),
    fetchOrders(),
    fetchBookings(),
    fetchQuotes(),
    fetchInvoices(),
  ]);
  const keys = ["contacts", "orders", "bookings", "quotes", "invoices"];
  const data = {};
  const errors = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled") data[keys[i]] = r.value;
    else {
      data[keys[i]] = [];
      errors[keys[i]] = r.reason.message;
    }
  });
  return { ...data, _errors: errors };
}
