import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const rawUrl = process.env.DATABASE_URL;
const isSupabase = rawUrl.includes("supabase.com");

// Supabase's pooler cert is not in Node's trusted CA list, so we must skip
// cert verification. pg v8 treats sslmode=require as verify-full in the
// connection string parser, overriding our explicit ssl option — so strip
// those params from the URL and rely solely on the explicit ssl config below.
let connectionString = rawUrl;
if (isSupabase) {
  try {
    const u = new URL(rawUrl);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("uselibpqcompat");
    connectionString = u.toString();
  } catch {
    connectionString = rawUrl;
  }
}

export const pool = new Pool({
  connectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
