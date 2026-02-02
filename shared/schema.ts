import { pgTable, text, serial, numeric, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const TRADE_TYPES = ["FUTURES", "EQUITY_INTRADAY", "LONG_TERM_HOLDING"] as const;
export const TRADE_STATUS = ["OPEN", "CLOSED"] as const;

export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  ticker: text("ticker").notNull(),
  entryDate: timestamp("entry_date").notNull().defaultNow(),
  exitDate: timestamp("exit_date"),
  // Financial values as numeric for precision, handled as strings in JS
  buyPrice: numeric("buy_price").notNull(),
  sellPrice: numeric("sell_price"),
  quantity: numeric("quantity").notNull(),
  status: text("status", { enum: TRADE_STATUS }).notNull().default("OPEN"),
  type: text("type").notNull(),
  side: text("side", { enum: ["LONG", "SHORT"] }).notNull().default("LONG"),
  
  // Active Trading specific
  strategy: text("strategy"),
  leverage: numeric("leverage"),
  stopLoss: numeric("stop_loss"),
  targetPrice: numeric("target_price"),
  
  // Investment specific
  sector: text("sector"),
  fundamentalReason: text("fundamental_reason"),
  
  notes: text("notes"),
  fees: numeric("fees").notNull().default("0"),
  chartUrl: text("chart_url"),
  parentTradeId: integer("parent_trade_id"),
});

// Base schema from drizzle, then override date fields to accept strings
const baseInsertSchema = createInsertSchema(trades).omit({ 
  id: true 
});

// Override entryDate and exitDate to accept both Date objects and ISO strings
export const insertTradeSchema = baseInsertSchema.extend({
  entryDate: z.union([z.date(), z.string().transform(s => new Date(s))]).optional(),
  exitDate: z.union([z.date(), z.string().transform(s => new Date(s)), z.null()]).optional(),
});

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users);

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
