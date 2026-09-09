# CRM Backend — Wix sync + reminder digest

This is the piece that can't live in the browser app: it holds your Wix API
key safely, pulls contacts/orders/bookings/quotes/invoices from Wix, and
sends the daily "deals overdue for follow-up" email to `info@yalistlabs.com`.

## What's here

- `server.js` — REST API (contacts, records, deals) + the cron schedule
- `wix.js` — calls the Wix REST API (Contacts, Orders, Bookings, Price Quotes, Invoices)
- `mailer.js` — builds and sends the digest email over SMTP
- `db.js` — simple local JSON database (swap for Postgres later if you outgrow it)

## Setting up Quotes and Invoices (important — extra step required)

Unlike Contacts/Orders/Bookings, Wix does **not** expose Price Quotes or
Invoices through a public REST API. They only exist via Velo code that
runs inside your own Wix site. To bridge that gap:

1. Open your site in the **Wix Editor**, turn on **Dev Mode** (Velo)
2. In the Backend section of the code panel, create a new file named
   exactly `http-functions.js`
3. Copy the entire contents of `velo-bridge/http-functions.js` (in this
   folder) into it
4. Generate a long random string (any password generator works) and paste
   it in for `BRIDGE_SECRET` inside that file — then put the *same* string
   into this project's `.env` as `VELO_BRIDGE_SECRET`
5. **Publish** your Wix site — Velo code only takes effect after publishing
6. Set `WIX_SITE_URL` in `.env` to your live site's URL (e.g.
   `https://www.yoursite.com`)

Once published, `POST /api/sync-wix` will pull quotes and invoices from
`https://yoursite.com/_functions/quotes` and `/_functions/invoices`
instead of failing.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in:
   - Your Wix API key + Site ID (create an app at dev.wix.com with Contacts,
     eCommerce, Bookings, and Billing permissions)
   - SMTP credentials for sending mail (Gmail app password, SendGrid, Postmark, etc.)
3. `npm start` — runs on `http://localhost:3000` by default

## Testing without waiting for the schedule

- `POST /api/sync-wix` — pulls fresh data from Wix right now
- `POST /api/send-digest-now` — sends today's digest immediately, so you can
  check formatting before trusting the 8am schedule

## Before this reflects real Wix data

The functions in `wix.js` are written against Wix's documented REST shapes,
but Wix has been migrating several of these APIs (especially Bookings and
Billing) during 2026 — **confirm the exact endpoint paths and response
fields against the current docs at dev.wix.com before relying on this in
production**, and wire up the merge step marked `TODO` in `server.js` (it
currently fetches from Wix but doesn't yet write the results into the local
database — that mapping depends on how you want Wix records matched to your
existing contacts).

## Deploying

Any Node host works — Render, Railway, Fly.io. Steps are the same everywhere:
push this folder, set the same environment variables from `.env` in the
host's dashboard, and set the start command to `npm start`.

## Connecting the frontend

The CRM artifact currently saves to Claude's in-browser storage. Once this
backend is deployed, point it at your backend's URL instead — replace the
`window.storage.get/set` calls with `fetch` calls to `/api/contacts`,
`/api/records`, and `/api/deals` on this server. That's what makes it a real
multi-device, team-accessible app instead of a single-browser preview.
