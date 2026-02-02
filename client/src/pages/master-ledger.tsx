import { useTrades } from "@/hooks/use-trades";
import { useState, useEffect } from "react";
import { TradeDialog } from "@/components/trade-dialog";
import { TradeDetails } from "@/components/trade-details";
import { Button } from "@/components/ui/button";
import { Trade } from "@shared/schema";
import { 
  Plus, 
  ArrowLeft, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  Image as ImageIcon,
  ExternalLink,
  Filter
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface MarketPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  lastUpdated: Date;
}

export default function MasterLedgerPage() {
  const { data: trades, isLoading, refetch } = useTrades();
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();
  const [marketPrices, setMarketPrices] = useState<Record<string, MarketPrice>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const handleTradeClick = (trade: Trade) => {
    setSelectedTrade(trade);
    setIsDetailsOpen(true);
  };

  // Fetch live market prices for open positions
  const fetchMarketPrices = async () => {
    if (!trades) return;
    
    const openTrades = trades.filter(t => t.status === 'OPEN' && t.type !== 'LONG_TERM_HOLDING');
    const uniqueSymbols = Array.from(new Set(openTrades.map(t => t.ticker)));
    
    if (uniqueSymbols.length === 0) return;

    setIsRefreshing(true);
    
    try {
      // Using Yahoo Finance API via a proxy (free, delayed data)
      const newPrices: Record<string, MarketPrice> = {};
      
      for (const symbol of uniqueSymbols) {
        try {
          // Try fetching from our backend which will proxy to a free API
          const response = await fetch(`/api/market-price/${symbol}`);
          if (response.ok) {
            const data = await response.json();
            newPrices[symbol] = {
              symbol,
              price: data.price,
              change: data.change || 0,
              changePercent: data.changePercent || 0,
              lastUpdated: new Date()
            };
          }
        } catch (err) {
          console.log(`Could not fetch price for ${symbol}`);
        }
      }
      
      setMarketPrices(prev => ({ ...prev, ...newPrices }));
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching market prices:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-refresh prices every 30 seconds
  useEffect(() => {
    fetchMarketPrices();
    const interval = setInterval(fetchMarketPrices, 30000);
    return () => clearInterval(interval);
  }, [trades]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading Master Ledger...</p>
        </div>
      </div>
    );
  }

  // Filter trades (exclude long-term holdings for the trading ledger)
  const activeTrades = (trades || []).filter(t => t.type !== "LONG_TERM_HOLDING");
  
  const filteredTrades = activeTrades.filter(t => 
    t.ticker.toLowerCase().includes(search.toLowerCase())
  );

  // Calculate metrics for spreadsheet
  const calculateTradeMetrics = (trade: Trade, index: number, runningTotal: number) => {
    const entryPrice = Number(trade.buyPrice);
    const exitPrice = trade.sellPrice ? Number(trade.sellPrice) : null;
    const quantity = Number(trade.quantity);
    const stopLoss = trade.stopLoss ? Number(trade.stopLoss) : null;
    const fees = Number(trade.fees || 0);
    
    // Get live CMP for open trades
    const livePrice = marketPrices[trade.ticker]?.price;
    const currentPrice = trade.status === 'OPEN' && livePrice ? livePrice : exitPrice;
    
    // SL% = (Entry - SL) / Entry * 100
    const slPercent = stopLoss && entryPrice ? ((entryPrice - stopLoss) / entryPrice) * 100 : null;
    
    // RPT (Risk Per Trade) = abs((Entry - SL) * Quantity)
    const rpt = stopLoss ? Math.abs((entryPrice - stopLoss) * quantity) : null;
    
    // Gross Profit/Loss (use live price for open, exit price for closed)
    const grossPnl = currentPrice ? (currentPrice - entryPrice) * quantity : null;
    
    // Net Profit = Gross P&L - Fees
    const netProfit = grossPnl !== null ? grossPnl - fees : null;
    
    // Trade Gain % = (Net Profit / Entry Value) * 100
    const entryValue = entryPrice * quantity;
    const tradeGainPercent = netProfit !== null && entryValue > 0 ? (netProfit / entryValue) * 100 : null;
    
    // R Multiple = Net Profit / RPT
    const rMultiple = netProfit !== null && rpt && rpt > 0 ? netProfit / rpt : null;
    
    // Holding Days
    const entryDate = new Date(trade.entryDate);
    const exitDate = trade.exitDate ? new Date(trade.exitDate) : (trade.status === 'OPEN' ? new Date() : null);
    const holdingDays = exitDate ? differenceInDays(exitDate, entryDate) : null;
    
    // Account Value (running total)
    const accountValue = runningTotal + (netProfit || 0);
    
    return {
      no: index + 1,
      entryDate: format(entryDate, 'dd/MM/yyyy'),
      strategy: trade.strategy || '-',
      stock: trade.ticker,
      qty: quantity,
      entry: entryPrice,
      sl: stopLoss,
      slPercent,
      rpt,
      exitDate: trade.exitDate ? format(new Date(trade.exitDate), 'dd/MM/yyyy') : '-',
      exitQty: trade.status === 'CLOSED' ? quantity : null,
      exitPrice,
      cmp: livePrice || null,
      tradeGainPercent,
      rMultiple,
      holdingDays,
      grossProfit: grossPnl,
      brokerage: fees,
      netProfit,
      accountValue,
      notes: trade.notes || '-',
      status: trade.status,
      type: trade.type,
      trade,
    };
  };

  // Calculate metrics for all trades
  let runningAccountValue = 0;
  const spreadsheetData = filteredTrades
    .sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
    .map((trade, index) => {
      const metrics = calculateTradeMetrics(trade, index, runningAccountValue);
      if (metrics.netProfit !== null) {
        runningAccountValue += metrics.netProfit;
      }
      return { ...metrics, accountValue: runningAccountValue };
    });

  // Summary stats
  const totalTrades = spreadsheetData.length;
  const openTrades = spreadsheetData.filter(t => t.status === 'OPEN').length;
  const closedTrades = spreadsheetData.filter(t => t.status === 'CLOSED').length;
  const totalNetPnl = spreadsheetData.reduce((sum, t) => sum + (t.netProfit || 0), 0);
  const winningTrades = spreadsheetData.filter(t => t.status === 'CLOSED' && t.netProfit !== null && t.netProfit > 0).length;
  const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-background flex flex-col z-50" data-testid="master-ledger-page">
      {/* Minimal Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation('/dashboard')}
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold font-display text-foreground">Master Ledger</h1>
            <p className="text-xs text-muted-foreground">
              Full-screen trading journal • {lastRefresh ? `Updated ${format(lastRefresh, 'HH:mm:ss')}` : 'Live prices loading...'}
            </p>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="hidden md:flex items-center gap-6 text-sm">
          <div className="text-center">
            <div className="text-muted-foreground text-xs">Total</div>
            <div className="font-bold font-mono">{totalTrades}</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground text-xs">Open</div>
            <div className="font-bold font-mono text-primary">{openTrades}</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground text-xs">Win Rate</div>
            <div className="font-bold font-mono">{winRate.toFixed(1)}%</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground text-xs">Net P&L</div>
            <div className={cn("font-bold font-mono", totalNetPnl >= 0 ? "text-profit" : "text-loss")}>
              ₹{totalNetPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ticker..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-40 h-8 text-sm"
              data-testid="input-search-ticker"
            />
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchMarketPrices}
            disabled={isRefreshing}
            data-testid="button-refresh-prices"
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
          <TradeDialog defaultType="EQUITY_INTRADAY">
            <Button size="sm" className="bg-primary hover:bg-primary/90" data-testid="button-new-trade">
              <Plus className="h-4 w-4 mr-1" /> New Trade
            </Button>
          </TradeDialog>
        </div>
      </header>

      {/* Full Screen Spreadsheet */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full w-full">
          <div className="min-w-[2000px]">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="hover:bg-transparent border-border/50 bg-muted">
                  <TableHead className="w-12 text-center font-bold text-xs">No.</TableHead>
                  <TableHead className="font-bold text-xs">Entry Date</TableHead>
                  <TableHead className="font-bold text-xs">Strategy</TableHead>
                  <TableHead className="font-bold text-xs">Stock</TableHead>
                  <TableHead className="text-right font-bold text-xs">Qty</TableHead>
                  <TableHead className="text-right font-bold text-xs">Entry</TableHead>
                  <TableHead className="text-right font-bold text-xs">SL</TableHead>
                  <TableHead className="text-right font-bold text-xs">SL%</TableHead>
                  <TableHead className="text-right font-bold text-xs">RPT</TableHead>
                  <TableHead className="font-bold text-xs">Exit Date</TableHead>
                  <TableHead className="text-right font-bold text-xs">Exit Qty</TableHead>
                  <TableHead className="text-right font-bold text-xs">Exit/CMP</TableHead>
                  <TableHead className="text-right font-bold text-xs">Gain %</TableHead>
                  <TableHead className="text-right font-bold text-xs">R Multiple</TableHead>
                  <TableHead className="text-right font-bold text-xs">Days</TableHead>
                  <TableHead className="text-right font-bold text-xs">Gross P&L</TableHead>
                  <TableHead className="text-right font-bold text-xs">Brokerage</TableHead>
                  <TableHead className="text-right font-bold text-xs">Net Profit</TableHead>
                  <TableHead className="text-right font-bold text-xs">Account</TableHead>
                  <TableHead className="font-bold text-xs min-w-[180px]">Notes / Mistakes</TableHead>
                  <TableHead className="text-center font-bold text-xs sticky right-0 bg-muted">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spreadsheetData.map((row) => {
                  const isProfitable = row.netProfit !== null && row.netProfit > 0;
                  const isLoss = row.netProfit !== null && row.netProfit < 0;
                  const isOpen = row.status === 'OPEN';
                  const hasLivePrice = row.cmp !== null;
                  
                  return (
                    <TableRow 
                      key={row.trade.id} 
                      className={cn(
                        "hover:bg-muted/50 border-border/50 cursor-pointer transition-colors",
                        isOpen && "bg-primary/5"
                      )}
                      onClick={() => handleTradeClick(row.trade)}
                      data-testid={`row-trade-${row.trade.id}`}
                    >
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">{row.no}</TableCell>
                      <TableCell className="font-mono text-xs">{row.entryDate}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {row.strategy}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-primary">{row.stock}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{row.qty}</TableCell>
                      <TableCell className="text-right font-mono text-xs">₹{row.entry.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-loss">
                        {row.sl ? `₹${row.sl.toLocaleString('en-IN')}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-loss">
                        {row.slPercent !== null ? `${row.slPercent.toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.rpt !== null ? `₹${row.rpt.toLocaleString('en-IN', { minimumFractionDigits: 0 })}` : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.exitDate}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.exitQty !== null ? row.exitQty : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {isOpen && hasLivePrice ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-primary font-bold">₹{row.cmp!.toLocaleString('en-IN')}</span>
                            {row.cmp! > row.entry ? (
                              <TrendingUp className="h-3 w-3 text-profit" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-loss" />
                            )}
                          </div>
                        ) : row.exitPrice !== null ? (
                          `₹${row.exitPrice.toLocaleString('en-IN')}`
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono text-xs font-medium", isProfitable ? 'text-profit' : isLoss ? 'text-loss' : '')}>
                        {row.tradeGainPercent !== null ? `${row.tradeGainPercent.toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono text-xs font-medium", isProfitable ? 'text-profit' : isLoss ? 'text-loss' : '')}>
                        {row.rMultiple !== null ? `${row.rMultiple.toFixed(2)}R` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.holdingDays !== null ? row.holdingDays : '-'}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono text-xs font-medium", isProfitable ? 'text-profit' : isLoss ? 'text-loss' : '')}>
                        {row.grossProfit !== null ? `₹${row.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        ₹{row.brokerage.toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-mono text-xs font-bold",
                        isProfitable ? 'text-profit bg-profit/10' : isLoss ? 'text-loss bg-loss/10' : ''
                      )}>
                        {row.netProfit !== null ? `₹${row.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        ₹{row.accountValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                        {row.notes}
                      </TableCell>
                      <TableCell className="text-center sticky right-0 bg-background" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {row.trade.chartUrl && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-primary"
                              onClick={() => window.open(row.trade.chartUrl!, '_blank')}
                              data-testid={`button-chart-${row.trade.id}`}
                            >
                              <ImageIcon className="h-3 w-3" />
                            </Button>
                          )}
                          {isOpen && (
                            <TradeDialog initialData={row.trade} mode="close">
                              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" data-testid={`button-exit-${row.trade.id}`}>
                                Exit
                              </Button>
                            </TradeDialog>
                          )}
                          <TradeDialog initialData={row.trade}>
                            <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`button-edit-${row.trade.id}`}>
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </TradeDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {spreadsheetData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={21} className="h-32 text-center text-muted-foreground">
                      No trades found. Click "New Trade" to add your first entry.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Footer Stats Bar */}
      <footer className="flex items-center justify-between px-4 py-2 border-t border-border bg-card/50 backdrop-blur-sm text-xs">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">
            Showing {spreadsheetData.length} of {totalTrades} trades
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div>
            <span className="text-muted-foreground mr-2">Closed:</span>
            <span className="font-mono font-bold">{closedTrades}</span>
          </div>
          <div>
            <span className="text-muted-foreground mr-2">Win Rate:</span>
            <span className="font-mono font-bold">{winRate.toFixed(1)}%</span>
          </div>
          <div>
            <span className="text-muted-foreground mr-2">Account Value:</span>
            <span className={cn("font-mono font-bold", runningAccountValue >= 0 ? "text-profit" : "text-loss")}>
              ₹{runningAccountValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </footer>

      <TradeDetails
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        trade={selectedTrade}
      />
    </div>
  );
}
