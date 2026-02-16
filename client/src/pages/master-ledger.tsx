import { useTrades } from "@/hooks/use-trades";
import { useState, useEffect, useMemo, Fragment } from "react";
import { TradeDialog } from "@/components/trade-dialog";
import { TradeDetails } from "@/components/trade-details";
import { SearchFilter } from "@/components/search-filter";
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronDown
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
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface MarketPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  lastUpdated: Date;
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
} | null;

export default function MasterLedgerPage() {
  // 1. All Hooks
  const { data: trades, isLoading } = useTrades();
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [marketPrices, setMarketPrices] = useState<Record<string, MarketPrice>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [, setLocation] = useLocation();
  const [manualCmpByTrade, setManualCmpByTrade] = useState<Record<number, number>>({});

  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'entryDate', direction: 'desc' });
  const [expandedParents, setExpandedParents] = useState<Record<number, boolean>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [pnlFilter, setPnlFilter] = useState("ALL");

  // 2. Effects
  const fetchMarketPrices = async () => {
    if (!trades) return;
    const openTrades = trades.filter(t => t.status === 'OPEN' && t.type !== 'LONG_TERM_HOLDING');
    const uniqueSymbols = Array.from(new Set(openTrades.map(t => t.ticker)));
    if (uniqueSymbols.length === 0) return;

    setIsRefreshing(true);
    try {
      const newPrices: Record<string, MarketPrice> = {};
      for (const symbol of uniqueSymbols) {
        try {
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

  useEffect(() => {
    if (trades && trades.length > 0) {
        fetchMarketPrices();
        const interval = setInterval(fetchMarketPrices, 30000);
        return () => clearInterval(interval);
    }
  }, [trades]);

  // 3. Logic & Memoization
  const activeTrades = useMemo(() => (trades || []).filter(t => t.type !== "LONG_TERM_HOLDING"), [trades]);
  const availableTypes = useMemo(() => Array.from(new Set(activeTrades.map(t => t.type))), [activeTrades]);

  const filteredTrades = useMemo(() => {
    return activeTrades.filter(t => {
      const matchesSearch = t.ticker.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
      const matchesType = typeFilter === "ALL" || t.type === typeFilter;
      const entryDate = new Date(t.entryDate);
      const matchesDate = (!dateRange.from || entryDate >= dateRange.from) &&
                          (!dateRange.to || entryDate <= dateRange.to);
      let matchesPnl = true;
      if (pnlFilter !== "ALL" && t.status === 'CLOSED') {
        const isShort = t.side === "SHORT";
        const pnl = isShort
          ? (Number(t.buyPrice) - Number(t.sellPrice)) * Number(t.quantity) - Number(t.fees || 0)
          : (Number(t.sellPrice) - Number(t.buyPrice)) * Number(t.quantity) - Number(t.fees || 0);
        if (pnlFilter === "PROFIT") matchesPnl = pnl > 0;
        if (pnlFilter === "LOSS") matchesPnl = pnl < 0;
      }
      return matchesSearch && matchesStatus && matchesType && matchesDate && matchesPnl;
    });
  }, [activeTrades, search, statusFilter, typeFilter, dateRange, pnlFilter]);

  const initialData = useMemo(() => {
    let runningAccountValue = 0;
    const chronologicalData = [...filteredTrades].sort((a, b) => 
      new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
    );

    return chronologicalData.map((trade, index) => {
      const entryPrice = Number(trade.buyPrice);
      const exitPrice = trade.sellPrice ? Number(trade.sellPrice) : null;
      const quantity = Number(trade.quantity);
      const stopLoss = trade.stopLoss ? Number(trade.stopLoss) : null;
      const fees = Number(trade.fees || 0);
      const livePrice = marketPrices[trade.ticker]?.price;
      const manualCmp = manualCmpByTrade[trade.id];
      const cmpValue = livePrice ?? manualCmp ?? null;
      const currentPrice = trade.status === 'OPEN' ? cmpValue : exitPrice;
      const slPercent = stopLoss && entryPrice ? ((entryPrice - stopLoss) / entryPrice) * 100 : null;
      const rpt = stopLoss ? Math.abs((entryPrice - stopLoss) * quantity) : null;
      const isShort = trade.side === "SHORT";
      const grossPnl = currentPrice
        ? isShort
          ? (entryPrice - currentPrice) * quantity
          : (currentPrice - entryPrice) * quantity
        : null;
      const netProfit = grossPnl !== null ? grossPnl - fees : null;
      const entryValue = entryPrice * quantity;
      const tradeGainPercent = netProfit !== null && entryValue > 0 ? (netProfit / entryValue) * 100 : null;
      const rMultiple = netProfit !== null && rpt && rpt > 0 ? netProfit / rpt : null;
      const entryDate = new Date(trade.entryDate);
      const exitDate = trade.exitDate ? new Date(trade.exitDate) : (trade.status === 'OPEN' ? new Date() : null);
      const holdingDays = exitDate ? differenceInDays(exitDate, entryDate) : null;
      
      if (netProfit !== null) {
        runningAccountValue += netProfit;
      }
      
      return {
        no: index + 1,
        entryDateObj: entryDate,
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
        cmp: cmpValue,
        tradeGainPercent,
        rMultiple,
        holdingDays,
        grossProfit: grossPnl,
        brokerage: fees,
        netProfit,
        accountValue: runningAccountValue,
        notes: trade.notes || '-',
        status: trade.status,
        type: trade.type,
        trade,
      };
    });
  }, [filteredTrades, marketPrices, manualCmpByTrade]);

  const initialDataByTradeId = useMemo(
    () => new Map(initialData.map((r) => [r.trade.id, r])),
    [initialData]
  );

  const childTrades = useMemo(
    () => filteredTrades.filter((t) => t.parentTradeId),
    [filteredTrades]
  );
  const childrenByParentId = useMemo(() => {
    const map = new Map<number, Trade[]>();
    for (const c of childTrades) {
      const pid = c.parentTradeId!;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(c);
    }
    return map;
  }, [childTrades]);

  const existingTradeIds = useMemo(
    () => new Set(filteredTrades.map((t) => t.id)),
    [filteredTrades]
  );

  const mainInitialData = useMemo(
    () =>
      initialData.filter(
        (r) =>
          !r.trade.parentTradeId ||
          !existingTradeIds.has(r.trade.parentTradeId!) // orphan: parent deleted
      ),
    [initialData, existingTradeIds]
  );

  const spreadsheetData = useMemo(() => {
    if (!sortConfig) return mainInitialData;

    return [...mainInitialData].sort((a, b) => {
      let aVal: any = a[sortConfig.key as keyof typeof a];
      let bVal: any = b[sortConfig.key as keyof typeof b];

      if (sortConfig.key === 'entryDate') {
        aVal = a.entryDateObj.getTime();
        bVal = b.entryDateObj.getTime();
      }

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      const comparison = aVal < bVal ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [mainInitialData, sortConfig]);

  // 4. Loading Check
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

  // 5. Helpers
  const handleTradeClick = (trade: Trade) => {
    setSelectedTrade(trade);
    setIsDetailsOpen(true);
  };

  const toggleExpand = (parentId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedParents((prev) => ({ ...prev, [parentId]: !prev[parentId] }));
  };

  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        if (current.direction === 'desc') return { key, direction: 'asc' };
        return { key, direction: 'desc' }; 
      }
      return { key, direction: 'desc' };
    });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="ml-1 h-3 w-3 inline-block opacity-30" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="ml-1 h-3 w-3 inline-block text-primary" /> 
      : <ArrowDown className="ml-1 h-3 w-3 inline-block text-primary" />;
  };

  // 6. Calculated Stats
  const totalTrades = mainInitialData.length;
  const openTrades = mainInitialData.filter((t) => t.status === 'OPEN').length;
  const closedTrades = mainInitialData.filter((t) => t.status === "CLOSED").length;
  const totalNetPnl = initialData.reduce((sum, t) => sum + (t.netProfit || 0), 0);
  const winningTrades = mainInitialData.filter(
    (t) => t.status === "CLOSED" && t.netProfit !== null && t.netProfit > 0
  ).length;
  const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;

  const realisedGain = initialData
    .filter((t) => t.status === "CLOSED")
    .reduce((sum, t) => sum + (t.netProfit || 0), 0);
  const unrealisedGain = initialData
    .filter((t) => t.status === "OPEN")
    .reduce((sum, t) => {
      const isShort = t.trade.side === "SHORT";
      const gross =
        t.cmp !== null
          ? isShort
            ? (t.entry - t.cmp) * t.qty
            : (t.cmp - t.entry) * t.qty
          : 0;
      return sum + (gross - t.brokerage);
    }, 0);
  const exposure = initialData
    .filter((t) => t.status === "OPEN")
    .reduce((sum, t) => sum + t.entry * t.qty, 0);
  const openMarketRisk = initialData
    .filter((t) => t.status === "OPEN")
    .reduce((sum, t) => sum + (t.rpt || 0), 0);

  const stickyHeaderClass = "sticky top-0 z-20 bg-background shadow-[0_1px_0_0_hsl(var(--border))]";

  return (
    <div className="fixed inset-0 bg-background flex flex-col z-50" data-testid="master-ledger-page">
      {/* Header */}
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
        
        {/* Header: 4 Financial Metrics Only */}
        <div className="hidden md:flex items-center gap-6 text-sm">
          <div className="text-center">
            <div className="text-muted-foreground text-xs">Realised</div>
            <div className={cn("font-bold font-mono", realisedGain >= 0 ? "text-profit" : "text-loss")}>
              ₹{realisedGain.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground text-xs">Unrealised</div>
            <div className={cn("font-bold font-mono", unrealisedGain >= 0 ? "text-profit" : "text-loss")}>
              ₹{unrealisedGain.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground text-xs">Exposure</div>
            <div className="font-bold font-mono">₹{exposure.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground text-xs">Risk</div>
            <div className="font-bold font-mono">₹{openMarketRisk.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchMarketPrices()}
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

      {/* Filter Bar */}
      <div className="border-b border-border bg-card/30 px-4 py-2">
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
      </div>

      {/* Full Screen Spreadsheet */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full w-full">
          <div className="min-w-[2000px]" style={{ ["--actions-col-w" as any]: "96px" }}>
            <Table wrapperClassName="overflow-visible">
              <TableHeader className="sticky top-0 z-30 bg-background">
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead
                    className={cn(
                      "text-center font-bold text-xs cursor-pointer hover:text-primary transition-colors select-none",
                      stickyHeaderClass,
                      "sticky left-0 z-40 w-12 min-w-[48px] bg-background shadow-[1px_0_0_0_hsl(var(--border))]"
                    )}
                    onClick={() => handleSort('no')}
                  >
                    No. <SortIcon column="no" />
                  </TableHead>

                  <TableHead 
                    className={cn(
                      "font-bold text-xs cursor-pointer hover:text-primary transition-colors select-none",
                      stickyHeaderClass,
                      "sticky left-12 z-40 w-32 min-w-[128px] bg-background shadow-[1px_0_0_0_hsl(var(--border))]"
                    )}
                    onClick={() => handleSort('stock')}
                  >
                    Stock <SortIcon column="stock" />
                  </TableHead>

                  <TableHead 
                    className={`font-bold text-xs cursor-pointer hover:text-primary transition-colors select-none ${stickyHeaderClass}`}
                    onClick={() => handleSort('entryDate')}
                  >
                    Entry Date <SortIcon column="entryDate" />
                  </TableHead>

                  <TableHead 
                    className={`text-right font-bold text-xs cursor-pointer hover:text-primary transition-colors select-none ${stickyHeaderClass}`}
                    onClick={() => handleSort('qty')}
                  >
                    Qty <SortIcon column="qty" />
                  </TableHead>

                  <TableHead 
                    className={`text-right font-bold text-xs cursor-pointer hover:text-primary transition-colors select-none ${stickyHeaderClass}`}
                    onClick={() => handleSort('entry')}
                  >
                    Entry <SortIcon column="entry" />
                  </TableHead>

                  <TableHead className={`text-right font-bold text-xs ${stickyHeaderClass}`}>SL</TableHead>
                  <TableHead className={`text-right font-bold text-xs ${stickyHeaderClass}`}>SL%</TableHead>
                  <TableHead
                    className={`text-right font-bold text-xs cursor-pointer hover:text-primary transition-colors select-none ${stickyHeaderClass}`}
                    onClick={() => handleSort('rpt')}
                  >
                    RPT <SortIcon column="rpt" />
                  </TableHead>
                  <TableHead className={`font-bold text-xs ${stickyHeaderClass}`}>Exit Date</TableHead>
                  <TableHead className={`text-right font-bold text-xs ${stickyHeaderClass}`}>Exit Qty</TableHead>
                  
                  {/* SPLIT COLUMN 1: Exit Price */}
                  <TableHead 
                    className={`text-right font-bold text-xs cursor-pointer hover:text-primary transition-colors select-none ${stickyHeaderClass}`}
                    onClick={() => handleSort('exitPrice')}
                  >
                    Exit Price <SortIcon column="exitPrice" />
                  </TableHead>

                  {/* SPLIT COLUMN 2: CMP */}
                  <TableHead 
                    className={`text-right font-bold text-xs cursor-pointer hover:text-primary transition-colors select-none ${stickyHeaderClass}`}
                    onClick={() => handleSort('cmp')}
                  >
                    CMP <SortIcon column="cmp" />
                  </TableHead>
                  
                  <TableHead 
                    className={`text-right font-bold text-xs cursor-pointer hover:text-primary transition-colors select-none ${stickyHeaderClass}`}
                    onClick={() => handleSort('tradeGainPercent')}
                  >
                    Gain % <SortIcon column="tradeGainPercent" />
                  </TableHead>

                  <TableHead
                    className={`text-right font-bold text-xs cursor-pointer hover:text-primary transition-colors select-none ${stickyHeaderClass}`}
                    onClick={() => handleSort('rMultiple')}
                  >
                    R Multiple <SortIcon column="rMultiple" />
                  </TableHead>
                  <TableHead 
                    className={`text-right font-bold text-xs cursor-pointer hover:text-primary transition-colors select-none ${stickyHeaderClass}`}
                    onClick={() => handleSort('holdingDays')}
                  >
                    Days <SortIcon column="holdingDays" />
                  </TableHead>
                  
                  <TableHead 
                    className={`text-right font-bold text-xs cursor-pointer hover:text-primary transition-colors select-none ${stickyHeaderClass}`}
                    onClick={() => handleSort('grossProfit')}
                  >
                    Gross Profit <SortIcon column="grossProfit" />
                  </TableHead>
                  
                  <TableHead className={`text-right font-bold text-xs ${stickyHeaderClass}`}>Brokerage</TableHead>
                  <TableHead 
                    className={`text-right font-bold text-xs cursor-pointer hover:text-primary transition-colors select-none ${stickyHeaderClass}`}
                    onClick={() => handleSort('accountValue')}
                  >
                    Account <SortIcon column="accountValue" />
                  </TableHead>
                  <TableHead className={`font-bold text-xs min-w-[180px] ${stickyHeaderClass}`}>Notes / Mistakes</TableHead>
                  <TableHead className={`font-bold text-xs ${stickyHeaderClass}`}>Strategy</TableHead>
                  
                  <TableHead 
                    className={cn(
                      "text-right font-bold text-xs cursor-pointer hover:text-primary transition-colors select-none",
                      stickyHeaderClass,
                      "sticky right-[var(--actions-col-w)] z-50 bg-background shadow-[-1px_0_0_0_hsl(var(--border))] backdrop-blur-sm"
                    )}
                    onClick={() => handleSort('netProfit')}
                  >
                    Net Profit <SortIcon column="netProfit" />
                  </TableHead>

                  {/* Sticky CORNER */}
                  <TableHead className="text-center font-bold text-xs sticky top-0 right-0 z-50 bg-background shadow-[0_1px_0_0_hsl(var(--border))] backdrop-blur-sm w-[var(--actions-col-w)] min-w-[var(--actions-col-w)] max-w-[var(--actions-col-w)]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spreadsheetData.map((mainRow, mainIndex) => {
                  const children = childrenByParentId.get(mainRow.trade.id) ?? [];
                  const hasChildren = children.length > 0;
                  const isExpanded = expandedParents[mainRow.trade.id];
                  const parentNo = mainIndex + 1;
                  return (
                    <Fragment key={mainRow.trade.id}>
                      <TableRow
                        className={cn(
                          "relative hover:bg-muted/50 border-border/50 cursor-pointer transition-colors",
                          mainRow.status === "OPEN" && "bg-primary/5"
                        )}
                        onClick={() => handleTradeClick(mainRow.trade)}
                        data-testid={`row-trade-${mainRow.trade.id}`}
                      >
                        <TableCell className="text-center font-mono text-xs text-muted-foreground sticky left-0 z-30 bg-background shadow-[1px_0_0_0_hsl(var(--border))] w-12 min-w-[48px]">
                          <div className="flex items-center justify-center gap-0.5">
                            {hasChildren && (
                              <span
                                onClick={(e) => toggleExpand(mainRow.trade.id, e)}
                                className="cursor-pointer hover:text-primary"
                                role="button"
                                aria-label={isExpanded ? "Collapse" : "Expand"}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                              </span>
                            )}
                            <span>{parentNo}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-bold text-primary sticky left-12 z-30 bg-background shadow-[1px_0_0_0_hsl(var(--border))] w-32 min-w-[128px]">
                          {mainRow.stock}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{mainRow.entryDate}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{mainRow.qty}</TableCell>
                        <TableCell className="text-right font-mono text-xs">₹{mainRow.entry.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-loss">
                          {mainRow.sl ? `₹${mainRow.sl.toLocaleString('en-IN')}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-loss">
                          {mainRow.slPercent !== null ? `${mainRow.slPercent.toFixed(2)}%` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {mainRow.rpt !== null ? `₹${mainRow.rpt.toLocaleString('en-IN', { minimumFractionDigits: 0 })}` : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{mainRow.exitDate}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {mainRow.exitQty !== null ? mainRow.exitQty : '-'}
                        </TableCell>

                        {/* SPLIT CELL 1: Exit Price */}
                        <TableCell className="text-right font-mono text-xs">
                          {mainRow.exitPrice !== null ? `₹${mainRow.exitPrice.toLocaleString('en-IN')}` : '-'}
                        </TableCell>

                        {/* SPLIT CELL 2: CMP */}
                        <TableCell className="text-right font-mono text-xs">
                          {mainRow.status === 'OPEN' && mainRow.cmp !== null ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-primary font-bold">{"\u20B9"}{mainRow.cmp.toLocaleString('en-IN')}</span>
                              {(mainRow.trade.side === "SHORT"
                                ? mainRow.entry - mainRow.cmp
                                : mainRow.cmp - mainRow.entry) >= 0 ? (
                                <TrendingUp className="h-3 w-3 text-profit" />
                              ) : (
                                <TrendingDown className="h-3 w-3 text-loss" />
                              )}
                            </div>
                          ) : mainRow.status === 'OPEN' ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              placeholder="Add CMP"
                              className="w-24 rounded border border-border bg-background px-2 py-1 text-right text-xs font-mono"
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const value = e.target.value;
                                setManualCmpByTrade((prev) => {
                                  if (!value) {
                                    const { [mainRow.trade.id]: _, ...rest } = prev;
                                    return rest;
                                  }
                                  return { ...prev, [mainRow.trade.id]: Number(value) };
                                });
                              }}
                              value={manualCmpByTrade[mainRow.trade.id] ?? ""}
                            />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        <TableCell className={cn("text-right font-mono text-xs font-medium", (mainRow.netProfit !== null && mainRow.netProfit > 0) ? 'text-profit' : (mainRow.netProfit !== null && mainRow.netProfit < 0) ? 'text-loss' : '')}>
                          {mainRow.tradeGainPercent !== null ? `${mainRow.tradeGainPercent.toFixed(2)}%` : '-'}
                        </TableCell>
                        <TableCell className={cn("text-right font-mono text-xs font-medium", (mainRow.netProfit !== null && mainRow.netProfit > 0) ? 'text-profit' : (mainRow.netProfit !== null && mainRow.netProfit < 0) ? 'text-loss' : '')}>
                          {mainRow.rMultiple !== null ? `${mainRow.rMultiple.toFixed(2)}R` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {mainRow.holdingDays !== null ? mainRow.holdingDays : '-'}
                        </TableCell>
                        <TableCell className={cn("text-right font-mono text-xs font-medium", (mainRow.netProfit !== null && mainRow.netProfit > 0) ? 'text-profit' : (mainRow.netProfit !== null && mainRow.netProfit < 0) ? 'text-loss' : '')}>
                          {mainRow.grossProfit !== null ? `\u20B9${mainRow.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {"\u20B9"}{mainRow.brokerage.toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {"\u20B9"}{mainRow.accountValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                          {mainRow.notes}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {mainRow.strategy}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn(
                          "relative text-right font-mono text-xs font-bold sticky right-[var(--actions-col-w)] z-50 bg-background shadow-[-1px_0_0_0_hsl(var(--border))] overflow-hidden",
                          (mainRow.netProfit !== null && mainRow.netProfit > 0) ? 'text-profit bg-profit/10' : (mainRow.netProfit !== null && mainRow.netProfit < 0) ? 'text-loss bg-loss/10' : ''
                        )}>
                          <span className="absolute inset-0 bg-background" aria-hidden />
                          <span className="relative z-10">
                            {mainRow.netProfit !== null ? `\u20B9${mainRow.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center sticky right-0 z-50 bg-background w-[var(--actions-col-w)] min-w-[var(--actions-col-w)] max-w-[var(--actions-col-w)] overflow-hidden shadow-[-1px_0_0_0_hsl(var(--border))] backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1 flex-nowrap">
                            {mainRow.trade.chartUrl && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-primary"
                                onClick={() => window.open(mainRow.trade.chartUrl!, '_blank')}
                                data-testid={`button-chart-${mainRow.trade.id}`}
                              >
                                <ImageIcon className="h-3 w-3" />
                              </Button>
                            )}
                            {mainRow.status === 'OPEN' && (
                              <TradeDialog initialData={mainRow.trade} mode="close">
                                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" data-testid={`button-exit-${mainRow.trade.id}`}>
                                  Exit
                                </Button>
                              </TradeDialog>
                            )}
                            <TradeDialog initialData={mainRow.trade}>
                              <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`button-edit-${mainRow.trade.id}`}>
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </TradeDialog>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Child rows (same columns as main) */}
                      {isExpanded &&
                        children.map((childTrade, childIndex) => {
                          const row = initialDataByTradeId.get(childTrade.id);
                          if (!row) return null;
                          const isProfitable = row.netProfit !== null && row.netProfit > 0;
                          const isLoss = row.netProfit !== null && row.netProfit < 0;
                          const isOpen = row.status === "OPEN";
                          return (
                            <TableRow
                              key={childTrade.id}
                              className={cn(
                                "relative hover:bg-muted/50 border-border/50 cursor-pointer transition-colors bg-muted/10",
                                isOpen && "bg-primary/5"
                              )}
                              onClick={() => handleTradeClick(row.trade)}
                              data-testid={`row-trade-${row.trade.id}`}
                            >
                              <TableCell className="text-center font-mono text-xs text-muted-foreground sticky left-0 z-30 bg-background shadow-[1px_0_0_0_hsl(var(--border))] w-12 min-w-[48px]">
                                {parentNo}.{childIndex + 1}
                              </TableCell>
                              <TableCell className="font-mono font-bold text-primary sticky left-12 z-30 bg-background shadow-[1px_0_0_0_hsl(var(--border))] w-32 min-w-[128px] pl-8">
                                └ {row.stock}
                              </TableCell>
                              <TableCell className="font-mono text-xs">{row.entryDate}</TableCell>
                              <TableCell className="text-right font-mono text-xs">{row.qty}</TableCell>
                              <TableCell className="text-right font-mono text-xs">₹{row.entry.toLocaleString("en-IN")}</TableCell>
                              <TableCell className="text-right font-mono text-xs text-loss">
                                {row.sl ? `₹${row.sl.toLocaleString("en-IN")}` : "-"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs text-loss">
                                {row.slPercent !== null ? `${row.slPercent.toFixed(2)}%` : "-"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {row.rpt !== null ? `₹${row.rpt.toLocaleString("en-IN", { minimumFractionDigits: 0 })}` : "-"}
                              </TableCell>
                              <TableCell className="font-mono text-xs">{row.exitDate}</TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {row.exitQty !== null ? row.exitQty : "-"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {row.exitPrice !== null ? `₹${row.exitPrice.toLocaleString("en-IN")}` : "-"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {isOpen && row.cmp !== null ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-primary font-bold">{"\u20B9"}{row.cmp.toLocaleString("en-IN")}</span>
                                    {(row.trade.side === "SHORT"
                                      ? row.entry - row.cmp
                                      : row.cmp - row.entry) >= 0 ? (
                                      <TrendingUp className="h-3 w-3 text-profit" />
                                    ) : (
                                      <TrendingDown className="h-3 w-3 text-loss" />
                                    )}
                                  </div>
                                ) : isOpen ? (
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    placeholder="Add CMP"
                                    className="w-24 rounded border border-border bg-background px-2 py-1 text-right text-xs font-mono"
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setManualCmpByTrade((prev) => {
                                        if (!value) {
                                          const { [row.trade.id]: _, ...rest } = prev;
                                          return rest;
                                        }
                                        return { ...prev, [row.trade.id]: Number(value) };
                                      });
                                    }}
                                    value={manualCmpByTrade[row.trade.id] ?? ""}
                                  />
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className={cn("text-right font-mono text-xs font-medium", isProfitable ? "text-profit" : isLoss ? "text-loss" : "")}>
                                {row.tradeGainPercent !== null ? `${row.tradeGainPercent.toFixed(2)}%` : "-"}
                              </TableCell>
                              <TableCell className={cn("text-right font-mono text-xs font-medium", isProfitable ? "text-profit" : isLoss ? "text-loss" : "")}>
                                {row.rMultiple !== null ? `${row.rMultiple.toFixed(2)}R` : "-"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {row.holdingDays !== null ? row.holdingDays : "-"}
                              </TableCell>
                              <TableCell className={cn("text-right font-mono text-xs font-medium", isProfitable ? "text-profit" : isLoss ? "text-loss" : "")}>
                                {row.grossProfit !== null ? `\u20B9${row.grossProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "-"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                {"\u20B9"}{row.brokerage.toLocaleString("en-IN")}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {"\u20B9"}{row.accountValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                                {row.notes}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] uppercase">
                                  {row.strategy}
                                </Badge>
                              </TableCell>
                              <TableCell className={cn(
                                "relative text-right font-mono text-xs font-bold sticky right-[var(--actions-col-w)] z-50 bg-background shadow-[-1px_0_0_0_hsl(var(--border))] overflow-hidden",
                                isProfitable ? "text-profit bg-profit/10" : isLoss ? "text-loss bg-loss/10" : ""
                              )}>
                                <span className="absolute inset-0 bg-background" aria-hidden />
                                <span className="relative z-10">
                                  {row.netProfit !== null ? `\u20B9${row.netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "-"}
                                </span>
                              </TableCell>
                              <TableCell className="text-center sticky right-0 z-50 bg-background w-[var(--actions-col-w)] min-w-[var(--actions-col-w)] max-w-[var(--actions-col-w)] overflow-hidden shadow-[-1px_0_0_0_hsl(var(--border))] backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1 flex-nowrap">
                                  {row.trade.chartUrl && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-primary"
                                      onClick={() => window.open(row.trade.chartUrl!, "_blank")}
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
                    </Fragment>
                  );
                })}
                {spreadsheetData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={22} className="h-32 text-center text-muted-foreground">
                      No trades match your search criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Footer: 5 Summary Metrics */}
      <footer className="flex items-center justify-between px-4 py-2 border-t border-border bg-card/50 backdrop-blur-sm text-xs">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">
            Showing {spreadsheetData.length} of {totalTrades} trades
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div>
            <span className="text-muted-foreground mr-2">Total:</span>
            <span className="font-mono font-bold">{totalTrades}</span>
          </div>
          <div>
            <span className="text-muted-foreground mr-2">Open:</span>
            <span className="font-mono font-bold text-primary">{openTrades}</span>
          </div>
          <div>
            <span className="text-muted-foreground mr-2">Closed:</span>
            <span className="font-mono font-bold">{closedTrades}</span>
          </div>
          <div>
            <span className="text-muted-foreground mr-2">Win Rate:</span>
            <span className="font-mono font-bold">{winRate.toFixed(1)}%</span>
          </div>
          <div>
            <span className="text-muted-foreground mr-2">Net P&L:</span>
            <span className={cn("font-mono font-bold", totalNetPnl >= 0 ? "text-profit" : "text-loss")}>
              ₹{totalNetPnl.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
