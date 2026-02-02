import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // GET /api/trades
  app.get(api.trades.list.path, async (req, res) => {
    const allTrades = await storage.getTrades();
    // Basic filtering if query params are present
    const type = req.query.type as string;
    const status = req.query.status as string;

    let filtered = allTrades;
    if (type) {
      filtered = filtered.filter(t => t.type === type);
    }
    if (status) {
      filtered = filtered.filter(t => t.status === status);
    }
    
    res.json(filtered);
  });

  // GET /api/stats
  app.get(api.trades.stats.path, async (_req, res) => {
    const allTrades = await storage.getTrades();
    const closedTrades = allTrades.filter(t => t.status === 'CLOSED');
    
    // Sort by entry date for equity curve
    const sortedTrades = [...closedTrades].sort((a, b) => 
      new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
    );

    let cumulativePnL = 0;
    let totalWins = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    const strategyPnL: Record<string, number> = {};

    const equityCurve = sortedTrades.map(t => {
      const pnl = (Number(t.sellPrice) - Number(t.buyPrice)) * Number(t.quantity) - Number(t.fees || 0);
      cumulativePnL += pnl;
      
      if (pnl > 0) {
        totalWins++;
        grossProfit += pnl;
      } else if (pnl < 0) {
        grossLoss += Math.abs(pnl);
      }

      const strategy = t.strategy || 'Uncategorized';
      strategyPnL[strategy] = (strategyPnL[strategy] || 0) + pnl;

      // Calculate R-Multiple
      let rMultiple = 0;
      if (t.buyPrice && t.stopLoss) {
        const initialRiskPerUnit = Math.abs(Number(t.buyPrice) - Number(t.stopLoss));
        if (initialRiskPerUnit > 0) {
          rMultiple = pnl / (initialRiskPerUnit * Number(t.quantity));
        }
      }

      return {
        date: t.entryDate.toISOString(),
        cumulativePnL: Number(cumulativePnL.toFixed(2)),
        rMultiple: Number(rMultiple.toFixed(2)),
        ticker: t.ticker
      };
    });

    const strategyBreakdown = Object.entries(strategyPnL).map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
    }));

    // Calculate Max Drawdown
    let maxPnL = 0;
    let maxDD = 0;
    equityCurve.forEach(point => {
      if (point.cumulativePnL > maxPnL) maxPnL = point.cumulativePnL;
      const dd = maxPnL > 0 ? (maxPnL - point.cumulativePnL) / maxPnL : 0;
      if (dd > maxDD) maxDD = dd;
    });

    res.json({
      netPnL: Number(cumulativePnL.toFixed(2)),
      winRate: closedTrades.length > 0 ? Number(((totalWins / closedTrades.length) * 100).toFixed(2)) : 0,
      profitFactor: grossLoss === 0 ? (grossProfit > 0 ? 99.9 : 0) : Number((grossProfit / grossLoss).toFixed(2)),
      maxDrawdown: Number((maxDD * 100).toFixed(2)),
      equityCurve,
      strategyBreakdown,
    });
  });

  // GET /api/market-price/:symbol - Fetch live market price from Yahoo Finance
  app.get("/api/market-price/:symbol", async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    
    try {
      // Add .NS suffix for NSE stocks (Indian market)
      const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
      
      // Yahoo Finance v8 API (free, delayed data)
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        // Try without .NS suffix (for US stocks, futures, etc.)
        const usUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
        const usResponse = await fetch(usUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (!usResponse.ok) {
          return res.status(404).json({ message: 'Symbol not found' });
        }
        
        const usData = await usResponse.json();
        const result = usData.chart?.result?.[0];
        
        if (!result) {
          return res.status(404).json({ message: 'No data available' });
        }
        
        const meta = result.meta;
        const price = meta.regularMarketPrice || meta.previousClose;
        const previousClose = meta.previousClose || price;
        const change = price - previousClose;
        const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
        
        return res.json({
          symbol,
          price: Number(price.toFixed(2)),
          change: Number(change.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
          currency: meta.currency || 'USD'
        });
      }
      
      const data = await response.json();
      const result = data.chart?.result?.[0];
      
      if (!result) {
        return res.status(404).json({ message: 'No data available' });
      }
      
      const meta = result.meta;
      const price = meta.regularMarketPrice || meta.previousClose;
      const previousClose = meta.previousClose || price;
      const change = price - previousClose;
      const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
      
      res.json({
        symbol,
        price: Number(price.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        currency: meta.currency || 'INR'
      });
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error);
      res.status(500).json({ message: 'Failed to fetch market price' });
    }
  });

  // GET /api/trades/:id
  app.get(api.trades.get.path, async (req, res) => {
    const trade = await storage.getTrade(Number(req.params.id));
    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }
    res.json(trade);
  });

  // POST /api/trades
  app.post(api.trades.create.path, async (req, res) => {
    try {
      // Coerce numeric strings if necessary, though Zod + Drizzle handles it well usually
      // Ideally frontend sends correct types, but pure JSON is usually fine.
      const input = api.trades.create.input.parse(req.body);
      const trade = await storage.createTrade(input);
      res.status(201).json(trade);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // PUT /api/trades/:id
  app.put(api.trades.update.path, async (req, res) => {
    try {
      const input = api.trades.update.input.parse(req.body);
      const trade = await storage.updateTrade(Number(req.params.id), input);
      if (!trade) {
        return res.status(404).json({ message: 'Trade not found' });
      }
      res.json(trade);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

    // DELETE /api/trades/:id
    app.delete(api.trades.delete.path, async (req, res) => {
      const trade = await storage.getTrade(Number(req.params.id));
      if (!trade) {
        return res.status(404).json({ message: 'Trade not found' });
      }
      await storage.deleteTrade(Number(req.params.id));
      res.status(204).end();
    });

    app.get("/api/trades/:id/campaign", async (req, res) => {
      try {
        const id = Number(req.params.id);
        const allTrades = await storage.getTrades();
        const trade = allTrades.find(t => t.id === id);
        
        if (!trade) {
          return res.status(404).json({ message: "Trade not found" });
        }

        const parentId = trade.parentTradeId || trade.id;
        const mainTrade = allTrades.find(t => t.id === parentId);
        
        if (!mainTrade) {
          return res.status(404).json({ message: "Parent trade not found" });
        }

        const children = allTrades.filter(t => t.parentTradeId === parentId);
        
        // Calculate original quantity (initial entry)
        // In our system, the parent row's quantity is the "current holding" 
        // and children rows represent the "sold parts".
        const soldQty = children.reduce((acc, c) => acc + Number(c.quantity), 0);
        const currentQty = Number(mainTrade.quantity);
        const originalQty = soldQty + currentQty;

        const totalRealizedPnL = children.reduce((acc, c) => {
          const pnl = (Number(c.sellPrice) - Number(c.buyPrice)) * Number(c.quantity) - Number(c.fees || 0);
          return acc + pnl;
        }, 0);

        const timeline = [
          { 
            type: 'ENTRY', 
            date: mainTrade.entryDate.toISOString(), 
            qty: originalQty, 
            price: Number(mainTrade.buyPrice) 
          },
          ...children.map(c => ({
            type: 'EXIT',
            date: (c.exitDate || c.entryDate).toISOString(),
            qty: Number(c.quantity),
            price: Number(c.sellPrice),
            pnl: (Number(c.sellPrice) - Number(c.buyPrice)) * Number(c.quantity) - Number(c.fees || 0)
          })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        ];

        if (currentQty > 0) {
          timeline.push({
            type: 'HOLDING',
            date: new Date().toISOString(),
            qty: currentQty,
            price: Number(mainTrade.buyPrice) // Holding at cost
          } as any);
        }

        res.json({
          main_ticker: mainTrade.ticker,
          original_quantity: originalQty,
          total_realized_pnl: totalRealizedPnL,
          timeline
        });
      } catch (err) {
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/api/trades/:id/history", async (req, res) => {
      const id = Number(req.params.id);
      const allTrades = await storage.getTrades();
      const tradeHistory = allTrades.filter(t => t.id === id || t.parentTradeId === id);
      res.json(tradeHistory);
    });

    // POST /api/trades/:id/close
  app.post("/api/trades/:id/close", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { quantity, sellPrice, exitDate, fees } = z.object({
        quantity: z.string(),
        sellPrice: z.string(),
        exitDate: z.string(),
        fees: z.string().optional().default("0"),
      }).parse(req.body);

      const originalTrade = await storage.getTrade(id);
      if (!originalTrade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      const sellQty = Number(quantity);
      const originalQty = Number(originalTrade.quantity);

      if (sellQty > originalQty) {
        return res.status(400).json({ message: "Cannot sell more than owned quantity" });
      }

      // Create the closed trade record
      const closedTrade = await storage.createTrade({
        ...originalTrade,
        id: undefined,
        quantity: quantity,
        sellPrice: sellPrice,
        exitDate: new Date(exitDate),
        status: "CLOSED",
        fees: (Number(originalTrade.fees || 0) + Number(fees)).toString(),
        parentTradeId: id,
      } as any);

      if (sellQty === originalQty) {
        // Full sell: Delete or mark original as closed? 
        // Best practice: Delete the "OPEN" placeholder if we just created a "CLOSED" one to represent it
        await storage.deleteTrade(id);
      } else {
        // Partial sell: Update original quantity
        await storage.updateTrade(id, {
          quantity: (originalQty - sellQty).toString(),
        });
      }

      res.json(closedTrade);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Seed Data
  seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existing = await storage.getTrades();
  if (existing.length > 0) return;

  console.log("Seeding database...");

  // Active Trades (Futures)
  await storage.createTrade({
    ticker: "ES",
    type: "FUTURES",
    status: "CLOSED",
    buyPrice: "5200.50",
    sellPrice: "5210.00",
    quantity: "2",
    entryDate: new Date("2024-01-10T09:30:00"),
    exitDate: new Date("2024-01-10T10:15:00"),
    strategy: "Scalp",
    leverage: "10",
    notes: "Quick morning scalp off support",
  });

  await storage.createTrade({
    ticker: "NQ",
    type: "FUTURES",
    status: "CLOSED",
    buyPrice: "18100.00",
    sellPrice: "18050.00",
    quantity: "1",
    entryDate: new Date("2024-01-11T14:00:00"),
    exitDate: new Date("2024-01-11T15:30:00"),
    strategy: "Trend Follow",
    leverage: "10",
    notes: "Failed breakout, stopped out",
    stopLoss: "18050.00",
  });

  // Long Term Investments
  await storage.createTrade({
    ticker: "NVDA",
    type: "LONG_TERM_HOLDING",
    status: "OPEN",
    buyPrice: "450.00",
    quantity: "50",
    entryDate: new Date("2023-05-15"),
    sector: "Technology",
    fundamentalReason: "AI boom leader, strong moat",
  });

  await storage.createTrade({
    ticker: "JPM",
    type: "LONG_TERM_HOLDING",
    status: "OPEN",
    buyPrice: "140.00",
    quantity: "100",
    entryDate: new Date("2023-08-20"),
    sector: "Financials",
    fundamentalReason: "Safe haven, good yield",
  });
  
  console.log("Database seeded!");
}
