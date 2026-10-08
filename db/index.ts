import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { env } from "cloudflare:workers";
import type { ArchiveDatabase } from "../app/lib/archive-store";
export function getArchiveDb(): ArchiveDatabase {
  const db = (env as {DB?: ArchiveDatabase}).DB;
  if (!db) throw new Error("Archive database is unavailable");
  return db;
}

// Retain the starter helper used by its optional examples.
export function getDb() { return drizzle(env.DB, {schema}); }
