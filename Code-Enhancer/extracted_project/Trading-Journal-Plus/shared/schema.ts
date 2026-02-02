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

export const insertTradeSchema = createInsertSchema(trades).omit({ 
  id: true 
});

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
