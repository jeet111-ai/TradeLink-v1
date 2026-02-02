import { db } from "./db";
import { trades, type Trade, type InsertTrade } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getTrades(): Promise<Trade[]>;
  getTrade(id: number): Promise<Trade | undefined>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: number, updates: Partial<InsertTrade>): Promise<Trade>;
  deleteTrade(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
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
