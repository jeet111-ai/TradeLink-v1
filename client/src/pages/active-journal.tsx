import { useTrades } from "@/hooks/use-trades";
import { useState } from "react";
import { TradeDialog } from "@/components/trade-dialog";
import { TradeDetails } from "@/components/trade-details";
import { SearchFilter } from "@/components/search-filter";
import { Button } from "@/components/ui/button";
import { Trade } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { Plus, ArrowUpRight, ArrowDownRight, ExternalLink, Image as ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
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

export default function ActiveJournal() {
  const { data: trades, isLoading } = useTrades();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [pnlFilter, setPnlFilter] = useState("ALL");
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "spreadsheet">("spreadsheet");

  const handleTradeClick = (trade: Trade) => {
    setSelectedTrade(trade);
    setIsDetailsOpen(true);
  };

  if (isLoading) return <div className="flex items-center justify-center h-64">Loading...</div>;

  // Filter logic
  const activeTrades = (trades || []).filter(t => t.type !== "LONG_TERM_HOLDING");
  
  const filteredTrades = activeTrades.filter(t => {
    const matchesSearch = t.ticker.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
    const matchesType = typeFilter === "ALL" || t.type === typeFilter;
    
    // Date Range Filter
    const entryDate = new Date(t.entryDate);
    const matchesDate = (!dateRange.from || entryDate >= dateRange.from) && 
                       (!dateRange.to || entryDate <= dateRange.to);
    
    // P&L Filter
    let matchesPnl = true;
    if (pnlFilter !== "ALL" && t.status === 'CLOSED') {
      const pnl = (Number(t.sellPrice) - Number(t.buyPrice)) * Number(t.quantity) - Number(t.fees || 0);
      if (pnlFilter === "PROFIT") matchesPnl = pnl > 0;
      if (pnlFilter === "LOSS") matchesPnl = pnl < 0;
    }
    
    return matchesSearch && matchesStatus && matchesType && matchesDate && matchesPnl;
  });

  const availableTypes = Array.from(new Set(activeTrades.map(t => t.type)));

  // Prepare chart data (Cumulative P&L)
  const sortedTrades = [...activeTrades].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
  
  let cumulative = 0;
  const pnlData = sortedTrades
    .filter(t => t.status === 'CLOSED')
    .map(t => {
      const pnl = (Number(t.sellPrice) - Number(t.buyPrice)) * Number(t.quantity) - Number(t.fees || 0);
      cumulative += pnl;
      return {
        date: format(new Date(t.entryDate), 'MMM dd'),
        pnl: pnl,
        cumulative: cumulative,
        ticker: t.ticker
      };
    });

  const grossProfit = pnlData.filter(d => d.pnl > 0).reduce((a, b) => a + b.pnl, 0);
  const grossLoss = Math.abs(pnlData.filter(d => d.pnl < 0).reduce((a, b) => a + b.pnl, 0));
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 99 : 0) : grossProfit / grossLoss;

  // Calculate derived values for spreadsheet view
  const calculateTradeMetrics = (trade: Trade, index: number, runningTotal: number) => {
    const entryPrice = Number(trade.buyPrice);
    const exitPrice = trade.sellPrice ? Number(trade.sellPrice) : null;
    const quantity = Number(trade.quantity);
    const stopLoss = trade.stopLoss ? Number(trade.stopLoss) : null;
    const fees = Number(trade.fees || 0);
    
    // SL% = (Entry - SL) / Entry * 100
    const slPercent = stopLoss && entryPrice ? ((entryPrice - stopLoss) / entryPrice) * 100 : null;
    
    // RPT (Risk Per Trade) = (Entry - SL) * Quantity
    const rpt = stopLoss ? Math.abs((entryPrice - stopLoss) * quantity) : null;
    
    // Gross Profit/Loss
    const grossPnl = exitPrice ? (exitPrice - entryPrice) * quantity : null;
    
    // Net Profit = Gross P&L - Fees
    const netProfit = grossPnl !== null ? grossPnl - fees : null;
    
    // Trade Gain % = (Net Profit / Entry Value) * 100
    const entryValue = entryPrice * quantity;
    const tradeGainPercent = netProfit !== null && entryValue > 0 ? (netProfit / entryValue) * 100 : null;
    
    // R Multiple = Net Profit / RPT
    const rMultiple = netProfit !== null && rpt && rpt > 0 ? netProfit / rpt : null;
    
    // Holding Days
    const entryDate = new Date(trade.entryDate);
    const exitDate = trade.exitDate ? new Date(trade.exitDate) : null;
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
      exitDate: exitDate ? format(exitDate, 'dd/MM/yyyy') : '-',
      exitQty: trade.status === 'CLOSED' ? quantity : null,
      exitPrice,
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

  // Calculate metrics for all filtered trades
  let runningAccountValue = 0; // Starting account value
  const spreadsheetData = filteredTrades
    .sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
    .map((trade, index) => {
      const metrics = calculateTradeMetrics(trade, index, runningAccountValue);
      if (metrics.netProfit !== null) {
        runningAccountValue += metrics.netProfit;
      }
      return { ...metrics, accountValue: runningAccountValue };
    });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Active Journal</h1>
          <p className="text-muted-foreground mt-1">Intraday & Futures performance analytics.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-1">
            <Button 
              variant={viewMode === "spreadsheet" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setViewMode("spreadsheet")}
              data-testid="button-spreadsheet-view"
            >
              Spreadsheet
            </Button>
            <Button 
              variant={viewMode === "table" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setViewMode("table")}
              data-testid="button-table-view"
            >
              Cards
            </Button>
          </div>
          <TradeDialog defaultType="EQUITY_INTRADAY">
            <Button className="bg-primary hover:bg-primary/90" data-testid="button-log-trade">
              <Plus className="mr-2 h-4 w-4" /> Log Trade
            </Button>
          </TradeDialog>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit Factor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{profitFactor.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-display ${cumulative >= 0 ? 'text-profit' : 'text-loss'}`}>
              ₹{cumulative.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{pnlData.length}</div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Account Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-display ${runningAccountValue >= 0 ? 'text-profit' : 'text-loss'}`}>
              ₹{runningAccountValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="py-4">
          <SearchFilter
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            pnlFilter={pnlFilter}
            onPnlFilterChange={setPnlFilter}
            availableTypes={availableTypes}
          />
        </CardContent>
      </Card>

      {/* Spreadsheet View */}
      {viewMode === "spreadsheet" && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <span>Trading Ledger</span>
              <span className="text-sm font-normal text-muted-foreground">
                {spreadsheetData.length} trades
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <div className="min-w-[1800px]">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/50 bg-muted/30">
                      <TableHead className="w-12 text-center font-bold">No.</TableHead>
                      <TableHead className="font-bold">Entry Date</TableHead>
                      <TableHead className="font-bold">Strategy</TableHead>
                      <TableHead className="font-bold">Stock</TableHead>
                      <TableHead className="text-right font-bold">Qty</TableHead>
                      <TableHead className="text-right font-bold">Entry</TableHead>
                      <TableHead className="text-right font-bold">SL</TableHead>
                      <TableHead className="text-right font-bold">SL%</TableHead>
                      <TableHead className="text-right font-bold">RPT</TableHead>
                      <TableHead className="font-bold">Exit Date</TableHead>
                      <TableHead className="text-right font-bold">Exit Qty</TableHead>
                      <TableHead className="text-right font-bold">Exit Price</TableHead>
                      <TableHead className="text-right font-bold">Gain %</TableHead>
                      <TableHead className="text-right font-bold">R Multiple</TableHead>
                      <TableHead className="text-right font-bold">Days</TableHead>
                      <TableHead className="text-right font-bold">Profit</TableHead>
                      <TableHead className="text-right font-bold">Brokerage</TableHead>
                      <TableHead className="text-right font-bold">Net Profit</TableHead>
                      <TableHead className="text-right font-bold">Account</TableHead>
                      <TableHead className="font-bold min-w-[200px]">Notes / Mistakes</TableHead>
                      <TableHead className="text-center font-bold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {spreadsheetData.map((row) => {
                      const isProfitable = row.netProfit !== null && row.netProfit > 0;
                      const isLoss = row.netProfit !== null && row.netProfit < 0;
                      
                      return (
                        <TableRow 
                          key={row.trade.id} 
                          className="hover:bg-card/50 border-border/50 cursor-pointer"
                          onClick={() => handleTradeClick(row.trade)}
                          data-testid={`row-trade-${row.trade.id}`}
                        >
                          <TableCell className="text-center font-mono text-muted-foreground">{row.no}</TableCell>
                          <TableCell className="font-mono text-sm">{row.entryDate}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {row.strategy}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono font-bold text-primary">{row.stock}</TableCell>
                          <TableCell className="text-right font-mono">{row.qty}</TableCell>
                          <TableCell className="text-right font-mono">₹{row.entry.toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right font-mono text-loss">
                            {row.sl ? `₹${row.sl.toLocaleString('en-IN')}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-loss">
                            {row.slPercent !== null ? `${row.slPercent.toFixed(2)}%` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.rpt !== null ? `₹${row.rpt.toLocaleString('en-IN', { minimumFractionDigits: 0 })}` : '-'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{row.exitDate}</TableCell>
                          <TableCell className="text-right font-mono">
                            {row.exitQty !== null ? row.exitQty : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.exitPrice !== null ? `₹${row.exitPrice.toLocaleString('en-IN')}` : '-'}
                          </TableCell>
                          <TableCell className={`text-right font-mono font-medium ${isProfitable ? 'text-profit' : isLoss ? 'text-loss' : ''}`}>
                            {row.tradeGainPercent !== null ? `${row.tradeGainPercent.toFixed(2)}%` : '-'}
                          </TableCell>
                          <TableCell className={`text-right font-mono font-medium ${isProfitable ? 'text-profit' : isLoss ? 'text-loss' : ''}`}>
                            {row.rMultiple !== null ? `${row.rMultiple.toFixed(2)}R` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.holdingDays !== null ? row.holdingDays : '-'}
                          </TableCell>
                          <TableCell className={`text-right font-mono font-medium ${isProfitable ? 'text-profit' : isLoss ? 'text-loss' : ''}`}>
                            {row.grossProfit !== null ? `₹${row.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            ₹{row.brokerage.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className={`text-right font-mono font-bold ${isProfitable ? 'text-profit bg-profit-soft' : isLoss ? 'text-loss bg-loss-soft' : ''}`}>
                            {row.netProfit !== null ? `₹${row.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ₹{row.accountValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {row.notes}
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              {row.trade.chartUrl && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-primary"
                                  onClick={() => window.open(row.trade.chartUrl!, '_blank')}
                                  data-testid={`button-chart-${row.trade.id}`}
                                >
                                  <ImageIcon className="h-3 w-3" />
                                </Button>
                              )}
                              {row.status === 'OPEN' && (
                                <TradeDialog initialData={row.trade} mode="close">
                                  <Button size="sm" variant="outline" className="h-7 text-xs" data-testid={`button-exit-${row.trade.id}`}>
                                    Exit
                                  </Button>
                                </TradeDialog>
                              )}
                              <TradeDialog initialData={row.trade}>
                                <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-edit-${row.trade.id}`}>
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
                        <TableCell colSpan={21} className="h-24 text-center text-muted-foreground">
                          No trades match your search criteria.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Cards View (Original) */}
      {viewMode === "table" && (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle>Cumulative P&L</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pnlData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      itemStyle={{ color: '#f8fafc' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cumulative" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2} 
                      dot={false}
                      activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle>Trade Performance</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pnlData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="ticker" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{fill: 'transparent'}}
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {pnlData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? 'hsl(var(--profit))' : 'hsl(var(--loss))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Recent Trades</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead>Ticker</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Entry Price</TableHead>
                    <TableHead>Exit Price</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrades.map(trade => (
                    <TableRow 
                      key={trade.id} 
                      className="hover:bg-card/50 border-border/50 cursor-pointer"
                      onClick={() => handleTradeClick(trade)}
                    >
                      <TableCell className="font-mono font-bold">{trade.ticker}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase font-semibold tracking-wider">
                          {trade.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={trade.status === 'OPEN' ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'bg-muted text-muted-foreground'}>
                          {trade.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">₹{Number(trade.buyPrice).toLocaleString()}</TableCell>
                      <TableCell className="font-mono">{trade.sellPrice ? `₹${Number(trade.sellPrice).toLocaleString()}` : '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {trade.chartUrl && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-primary"
                              onClick={() => window.open(trade.chartUrl!, '_blank')}
                            >
                              <ImageIcon className="h-4 w-4" />
                            </Button>
                          )}
                          {trade.status === 'OPEN' && (
                            <TradeDialog initialData={trade} mode="close">
                              <Button size="sm" variant="outline" className="h-8 text-xs">Exit</Button>
                            </TradeDialog>
                          )}
                          <TradeDialog initialData={trade}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TradeDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTrades.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No trades match your search criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <TradeDetails
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        trade={selectedTrade}
      />
    </div>
  );
}
