import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// --- NEW: Auto-Initialize Database (Fix for missing table.sql) ---
const initDb = async () => {
  const client = await pool.connect();
  try {
    // 1. Create Users Table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      );
    `);

    // 2. Create Trades Table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        ticker TEXT NOT NULL,
        type TEXT NOT NULL,
        side TEXT NOT NULL DEFAULT 'LONG',
        status TEXT NOT NULL DEFAULT 'OPEN',
        quantity NUMERIC NOT NULL,
        buy_price NUMERIC NOT NULL,
        sell_price NUMERIC,
        entry_date TIMESTAMP NOT NULL DEFAULT NOW(),
        exit_date TIMESTAMP,
        strategy TEXT,
        leverage TEXT,
        stop_loss NUMERIC,
        target_price NUMERIC,
        fees NUMERIC DEFAULT 0,
        notes TEXT,
        chart_url TEXT,
        sector TEXT,
        fundamental_reason TEXT,
        parent_trade_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // 3. Create Session Table (for connect-pg-simple)
    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid varchar NOT NULL COLLATE "default",
        sess json NOT NULL,
        expire timestamp(6) NOT NULL
      )
      WITH (OIDS=FALSE);
      
      ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);
    `);

    console.log("✅ Database tables verified/created successfully.");
  } catch (err) {
    console.error("❌ Error initializing database tables:", err);
  } finally {
    client.release();
  }
};

// Run initialization immediately on import
initDb();