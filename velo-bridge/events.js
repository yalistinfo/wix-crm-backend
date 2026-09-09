// ============================================================
// PASTE THIS INTO YOUR WIX SITE'S OWN CODE — NOT this Node backend.
//
// Where: Wix Editor → Dev Mode (Velo) → Backend section → events.js
//
// Why: Wix has no "list all quotes/invoices" API. The only way to
// capture them is to catch the events Wix fires the moment a quote
// or invoice is created/sent/accepted/paid, and save that data into
// your own collection (QuoteSync / InvoiceSync) as it happens.
//
// This defines both a plain name (onPriceQuoteCreated) and a
// prefixed name (wixBillingBackend_onPriceQuoteCreated) for each
// event, since we're not certain which naming convention this
// account's billing events expect. Having both registered is
// harmless — only the one Wix actually recognizes will ever fire.
// ============================================================

import wixData from "wix-data";

function quoteToRecord(quote) {
  return {
    _id: quote.id?.id || quote._id,
    title: quote.title || `Quote ${quote.number || quote.id?.id}`,
    amount: Number(quote.totals?.total?.amount || quote.totals?.total || 0),
    status: quote.status,
    contactId: quote.customer?.contactId || "",
    customerEmail: quote.customer?.email || "",
    date: quote.dates?.createdDate || new Date(),
  };
}

function invoiceToRecord(invoice) {
  return {
    _id: invoice.id?.id || invoice._id,
    title: `Invoice ${invoice.number || invoice.id?.id}`,
    amount: Number(invoice.totals?.total?.amount || invoice.totals?.total || 0),
    status: invoice.status,
    contactId: invoice.recipient?.contactId || invoice.customer?.contactId || "",
    customerEmail: invoice.recipient?.email || invoice.customer?.email || "",
    date: invoice.dates?.createdDate || new Date(),
  };
}

// --- Price Quote events: plain names ---

export function onPriceQuoteCreated(event) {
  return wixData.save("QuoteSync", quoteToRecord(event));
}

export function onPriceQuoteSent(event) {
  return wixData.save("QuoteSync", quoteToRecord(event));
}

export function onPriceQuoteAccepted(event) {
  return wixData.save("QuoteSync", quoteToRecord(event));
}

export function onPriceQuoteExpired(event) {
  return wixData.save("QuoteSync", quoteToRecord(event));
}

// --- Price Quote events: prefixed names ---

export function wixBillingBackend_onPriceQuoteCreated(event) {
  return wixData.save("QuoteSync", quoteToRecord(event));
}

export function wixBillingBackend_onPriceQuoteSent(event) {
  return wixData.save("QuoteSync", quoteToRecord(event));
}

export function wixBillingBackend_onPriceQuoteAccepted(event) {
  return wixData.save("QuoteSync", quoteToRecord(event));
}

export function wixBillingBackend_onPriceQuoteExpired(event) {
  return wixData.save("QuoteSync", quoteToRecord(event));
}

// --- Invoice events: plain names ---

export function onInvoiceCreated(event) {
  return wixData.save("InvoiceSync", invoiceToRecord(event));
}

export function onInvoiceSent(event) {
  return wixData.save("InvoiceSync", invoiceToRecord(event));
}

export function onInvoicePaid(event) {
  return wixData.save("InvoiceSync", invoiceToRecord(event));
}

export function onInvoiceOverdue(event) {
  return wixData.save("InvoiceSync", invoiceToRecord(event));
}

// --- Invoice events: prefixed names ---

export function wixBillingBackend_onInvoiceCreated(event) {
  return wixData.save("InvoiceSync", invoiceToRecord(event));
}

export function wixBillingBackend_onInvoiceSent(event) {
  return wixData.save("InvoiceSync", invoiceToRecord(event));
}

export function wixBillingBackend_onInvoicePaid(event) {
  return wixData.save("InvoiceSync", invoiceToRecord(event));
}

export function wixBillingBackend_onInvoiceOverdue(event) {
  return wixData.save("InvoiceSync", invoiceToRecord(event));
}
