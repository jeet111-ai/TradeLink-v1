import { db } from "./db";
import { pool } from "./db";
import { trades, type Trade, type InsertTrade, users, type User, type InsertUser } from "@shared/schema";
import { eq, desc, and, gt } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getTrades(): Promise<Trade[]>;
  getTrade(id: number): Promise<Trade | undefined>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: number, updates: Partial<InsertTrade>): Promise<Trade>;
  deleteTrade(id: number): Promise<void>;

  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>; // Changed to Email
  getUserByEmailAndResetToken(
    email: string,
    tokenHash: string,
    now: Date,
  ): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  setResetToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void>;
  clearResetToken(userId: number): Promise<void>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  // --- USER METHODS ---
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByEmailAndResetToken(
    email: string,
    tokenHash: string,
    now: Date,
  ): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, email),
          eq(users.resetTokenHash, tokenHash),
          gt(users.resetTokenExpires, now),
        ),
      );
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async setResetToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    await db
      .update(users)
      .set({ resetTokenHash: tokenHash, resetTokenExpires: expiresAt })
      .where(eq(users.id, userId));
  }

  async clearResetToken(userId: number): Promise<void> {
    await db
      .update(users)
      .set({ resetTokenHash: null, resetTokenExpires: null })
      .where(eq(users.id, userId));
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({
        password: hashedPassword,
        resetTokenHash: null,
        resetTokenExpires: null,
      })
      .where(eq(users.id, userId));
  }

  // --- TRADE METHODS ---
  async getTrades(): Promise<Trade[]> {
    return await db.select().from(trades).orderBy(desc(trades.entryDate));
  }

  async getTrade(id: number): Promise<Trade | undefined> {
    const [trade] = await db.select().from(trades).where(eq(trades.id, id));
    return trade;
  }

  async createTrade(insertTrade: InsertTrade): Promise<Trade> {
    const [trade] = await db.insert(trades).values(insertTrade).returning();
    return trade;
  }

  async updateTrade(id: number, updates: Partial<InsertTrade>): Promise<Trade> {
    const [updated] = await db
      .update(trades)
      .set(updates)
      .where(eq(trades.id, id))
      .returning();
    return updated;
  }

  async deleteTrade(id: number): Promise<void> {
    await db.delete(trades).where(eq(trades.id, id));
  }
}

export const storage = new DatabaseStorage();
