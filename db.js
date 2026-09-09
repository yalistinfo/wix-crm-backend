import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";

const file = path.join(process.cwd(), "data.json");
const adapter = new JSONFile(file);
const defaultData = { contacts: [], records: [], deals: [] };

export const db = new Low(adapter, defaultData);

export async function initDb() {
  await db.read();
  db.data ||= defaultData;
  db.data.contacts ||= [];
  db.data.records ||= [];
  db.data.deals ||= [];
  await db.write();
}

// Swap this file for a real Postgres/Mongo connection later without
// touching server.js — every route reads/writes through db.data.
