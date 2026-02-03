import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trade } from "@shared/schema";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreateTrade } from "@/hooks/use-trades";
import { useToast } from "@/hooks/use-toast";

interface MasterLedgerProps {
  trades: Trade[];
  onTradeClick?: (trade: Trade) => void;
}

type SortConfig = {
  key: keyof Trade | 'pnl';
  direction: 'asc' | 'desc';
} | null;

export function MasterLedger({ trades, onTradeClick }: MasterLedgerProps) {
  const [expandedTrades, setExpandedTrades] = useState<Record<number, boolean>>({});
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'entryDate', direction: 'desc' });
  const [isImporting, setIsImporting] = useState(false);
  const createTrade = useCreateTrade();
  const { toast } = useToast();

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTrades(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSort = (key: keyof Trade | 'pnl') => {
    setSortConfig((current) => {
      if (current?.key === key) {
        if (current.direction === 'desc') return { key, direction: 'asc' };
        return null;
      }
      return { key, direction: 'desc' };
    });
  };

  const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      if (lines.length < 2) {
        setIsImporting(false);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const data = lines.slice(1);

      // Smart mapping
      const findHeader = (aliases: string[]) => {
        return headers.findIndex(h => aliases.includes(h));
      };

      const tickerIdx = findHeader(['ticker', 'symbol', 'script', 'stock']);
      const buyPriceIdx = findHeader(['buy price', 'entry', 'avg price', 'buy_price', 'price']);
      const qtyIdx = findHeader(['quantity', 'qty', 'units', 'vol']);
      const typeIdx = findHeader(['type', 'segment', 'category']);
      const sideIdx = findHeader(['side', 'direction', 'buy/sell']);

      let importedCount = 0;
      for (const line of data) {
        if (!line.trim()) continue;
        const cols = line.split(',').map(c => c.trim());

        const trade = {
          ticker: tickerIdx !== -1 ? cols[tickerIdx] : 'UNKNOWN',
          buyPrice: buyPriceIdx !== -1 ? cols[buyPriceIdx] : '0',
          quantity: qtyIdx !== -1 ? cols[qtyIdx] : '0',
          type: typeIdx !== -1 ? cols[typeIdx].toUpperCase() : 'EQUITY_INTRADAY',
          side: sideIdx !== -1 ? (cols[sideIdx].toUpperCase().includes('SELL') || cols[sideIdx].toUpperCase().includes('SHORT') ? 'SHORT' : 'LONG') : 'LONG',
          status: 'OPEN' as const,
          entryDate: new Date(),
        };

        try {
          await createTrade.mutateAsync(trade);
          importedCount++;
        } catch (err) {
          console.error('Failed to import trade:', err);
        }
      }

      toast({
        title: "Import Complete",
        description: `Successfully imported ${importedCount} trades.`,
      });
      setIsImporting(false);
      if (event.target) event.target.value = '';
    };
    reader.readAsText(file);
  };

  // Group trades by parentTradeId
  const mainTrades = trades.filter(t => !t.parentTradeId);
  const childTrades = trades.filter(t => t.parentTradeId);

  const processedTrades = useMemo(() => {
    let result = mainTrades.map(trade => {
      const children = childTrades.filter(t => t.parentTradeId === trade.id);
      const totalPnL = children.reduce((acc, child) => {
        const pnl = (Number(child.sellPrice) - Number(child.buyPrice)) * Number(child.quantity) - Number(child.fees || 0);
        return acc + pnl;
      }, 0);
      return { ...trade, pnl: totalPnL };
    });

    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        const comparison = aVal < bVal ? -1 : 1;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [mainTrades, childTrades, sortConfig]);

  const SortIcon = ({ column }: { column: keyof Trade | 'pnl' }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="ml-1 h-3 w-3 inline-block opacity-50" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-1 h-3 w-3 inline-block" /> : <ArrowDown className="ml-1 h-3 w-3 inline-block" />;
  };

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
        <h3 className="font-semibold text-lg font-display">Master Ledger</h3>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvImport}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isImporting}
            />
            <Button variant="outline" size="sm" className="gap-2 h-8" disabled={isImporting}>
              {isImporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileUp className="h-3 w-3" />}
              Import CSV
            </Button>
          </div>
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            Grouped Execution Logs
          </Badge>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border bg-muted/5">
              <TableHead className="w-[40px]"></TableHead>
              <TableHead 
                className="py-2 text-[10px] uppercase font-bold tracking-tighter cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleSort('entryDate')}
              >
                Timestamp <SortIcon column="entryDate" />
              </TableHead>
              <TableHead 
                className="py-2 text-[10px] uppercase font-bold tracking-tighter cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleSort('ticker')}
              >
                Ticker <SortIcon column="ticker" />
              </TableHead>
              <TableHead className="py-2 text-[10px] uppercase font-bold tracking-tighter">Side</TableHead>
              <TableHead 
                className="py-2 text-[10px] uppercase font-bold tracking-tighter text-right cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleSort('buyPrice')}
              >
                Entry Price <SortIcon column="buyPrice" />
              </TableHead>
              <TableHead 
                className="py-2 text-[10px] uppercase font-bold tracking-tighter text-right cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleSort('quantity')}
              >
                Qty <SortIcon column="quantity" />
              </TableHead>
              <TableHead 
                className="py-2 text-[10px] uppercase font-bold tracking-tighter cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleSort('status')}
              >
                Status <SortIcon column="status" />
              </TableHead>
              <TableHead 
                className="py-2 text-[10px] uppercase font-bold tracking-tighter text-right cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleSort('pnl')}
              >
                Net P&L <SortIcon column="pnl" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedTrades.map((mainTrade) => {
              const children = childTrades.filter(t => t.parentTradeId === mainTrade.id);
              const isExpanded = expandedTrades[mainTrade.id];
              const hasChildren = children.length > 0;
              const totalPnL = mainTrade.pnl;

              const isWin = totalPnL > 0;
              const isLong = mainTrade.side === "LONG" || !mainTrade.side;
              const isOpen = mainTrade.status === 'OPEN';
              
              return (
                <React.Fragment key={mainTrade.id}>
                  <TableRow 
                    className="border-border hover:bg-muted/30 transition-colors group cursor-pointer"
                    onClick={() => onTradeClick?.(mainTrade as unknown as Trade)}
                  >
                    <TableCell className="p-2">
                      {hasChildren && (
                        <div 
                          className="p-1 hover:bg-muted rounded"
                          onClick={(e) => toggleExpand(mainTrade.id, e)}
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground whitespace-nowrap py-2">
                      {format(new Date(mainTrade.entryDate), 'MMM dd, HH:mm')}
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="font-bold text-xs tracking-tight">
                        {mainTrade.ticker}
                      </span>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[9px] px-1 h-4 leading-none",
                          isLong ? "text-profit border-profit/20 bg-profit/5" : "text-loss border-loss/20 bg-loss/5"
                        )}
                      >
                        {isLong ? "LONG" : "SHORT"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs py-2">
                      ₹{Number(mainTrade.buyPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs py-2">
                      {Number(mainTrade.quantity).toLocaleString()}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        {isOpen && (
                          <div className="h-1.5 w-1.5 rounded-full bg-profit animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                        )}
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-tight",
                          isOpen ? "text-profit" : "text-muted-foreground"
                        )}>
                          {mainTrade.status}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold py-2">
                      {hasChildren ? (
                        <span className={isWin ? "text-profit" : "text-loss"}>
                          {isWin ? "+" : ""}₹{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50 italic">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && children.map((child) => {
                    const childPnL = (Number(child.sellPrice) - Number(child.buyPrice)) * Number(child.quantity) - Number(child.fees || 0);
                    return (
                      <TableRow key={child.id} className="bg-muted/10 border-border hover:bg-muted/20 transition-colors">
                        <TableCell></TableCell>
                        <TableCell className="font-mono text-[9px] text-muted-foreground pl-8">
                          └ {format(new Date(child.exitDate || child.entryDate), 'MMM dd, HH:mm')}
                        </TableCell>
                        <TableCell className="py-1 italic text-xs text-muted-foreground">Exit</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right font-mono text-[10px] py-1">
                          ₹{Number(child.sellPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[10px] py-1">
                          {Number(child.quantity).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[8px] h-3 px-1">CHILD</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-[10px] font-semibold py-1">
                          <span className={childPnL >= 0 ? "text-profit" : "text-loss"}>
                            {childPnL >= 0 ? "+" : ""}₹{childPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              );
            })}
            {(!mainTrades || mainTrades.length === 0) && (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  No execution data available.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
