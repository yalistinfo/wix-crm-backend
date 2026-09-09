// ============================================================
// PASTE THIS FILE INTO YOUR WIX SITE'S OWN CODE — NOT this Node backend.
//
// Where: Wix Editor → Dev Mode (Velo) → Backend section → new file
//        named exactly: http-functions.js
//
// Why: Wix only exposes Price Quotes and Invoices through Velo code
// running inside your site (there's no public REST endpoint for them).
// This file queries the special Billing/PriceQuotes and Billing/Invoices
// collections and serves them as JSON, so your external Node backend
// can fetch them like any other API.
// ============================================================

import { ok, forbidden, badRequest } from "wix-http-functions";
import wixData from "wix-data";

// Change this to a long random string, and put the SAME value in your
// Node backend's .env as VELO_BRIDGE_SECRET. This stops random visitors
// from hitting your site's URL and reading your billing data.
const BRIDGE_SECRET = "REPLACE_WITH_A_LONG_RANDOM_SECRET";

function isAuthorized(request) {
  const provided = request.headers["x-bridge-secret"];
  return provided === BRIDGE_SECRET;
}

// Available at: https://<your-site-domain>/_functions/quotes
export async function get_quotes(request) {
  if (!isAuthorized(request)) return forbidden();
  try {
    const results = await wixData.query("QuoteSync").limit(1000).find();
    const quotes = results.items.map((q) => ({
      wixId: q._id,
      contactId: q.contactId || "",
      title: q.title,
      amount: Number(q.amount || 0),
      status: q.status,
      date: q.date,
    }));
    return ok({ headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quotes }) });
  } catch (e) {
    return badRequest({ headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: e.message }) });
  }
}

// Available at: https://<your-site-domain>/_functions/invoices
export async function get_invoices(request) {
  if (!isAuthorized(request)) return forbidden();
  try {
    const results = await wixData.query("InvoiceSync").limit(1000).find();
    const invoices = results.items.map((i) => ({
      wixId: i._id,
      contactId: i.contactId || "",
      title: i.title,
      amount: Number(i.amount || 0),
      status: i.status,
      date: i.date,
    }));
    return ok({ headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoices }) });
  } catch (e) {
    return badRequest({ headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: e.message }) });
  }
}
