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
import { ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

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

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTrades(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSort = (key: keyof Trade | 'pnl') => {
    setSortConfig((current) => {
      if (current?.key === key) {
        if (current.direction === 'desc') return { key, direction: 'asc' };
        // Default back to desc if clicked again (cycle: desc -> asc -> desc)
        return { key, direction: 'desc' }; 
      }
      return { key, direction: 'desc' };
    });
  };


  // Group trades by parentTradeId
  const mainTrades = useMemo(() => trades.filter(t => !t.parentTradeId), [trades]);
  const childTrades = useMemo(() => trades.filter(t => t.parentTradeId), [trades]);

  const processedTrades = useMemo(() => {
    // 1. Calculate P&L for everyone first
    let result = mainTrades.map(trade => {
      const children = childTrades.filter(t => t.parentTradeId === trade.id);
      const totalPnL = children.reduce((acc, child) => {
        const pnl = (Number(child.sellPrice) - Number(child.buyPrice)) * Number(child.quantity) - Number(child.fees || 0);
        return acc + pnl;
      }, 0);
      // We attach the calculated P&L to the trade object for sorting
      return { ...trade, pnl: totalPnL };
    });

    // 2. Apply Sorting
    if (sortConfig) {
      result.sort((a, b) => {
        let aVal: any = a[sortConfig.key as keyof typeof a];
        let bVal: any = b[sortConfig.key as keyof typeof b];

        // Special handling for dates
        if (sortConfig.key === 'entryDate') {
            aVal = new Date(aVal).getTime();
            bVal = new Date(bVal).getTime();
        } 
        // Special handling for numbers (prices, qty, pnl)
        else if (['buyPrice', 'quantity', 'pnl'].includes(sortConfig.key)) {
            aVal = Number(aVal);
            bVal = Number(bVal);
        }
        // Special handling for strings (ticker, status) - case insensitive
        else if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }
        
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
    if (sortConfig?.key !== column) return <ArrowUpDown className="ml-1 h-3 w-3 inline-block opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-1 h-3 w-3 inline-block text-primary" /> : <ArrowDown className="ml-1 h-3 w-3 inline-block text-primary" />;
  };

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-xl overflow-hidden shadow-sm animate-in fade-in duration-500">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
        <h3 className="font-semibold text-lg font-display">Master Ledger</h3>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            Grouped Execution Logs
          </Badge>
          <div className="h-1.5 w-1.5 rounded-full bg-profit animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" title="Connected to Real-time Engine" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border bg-muted/5">
              <TableHead className="w-[40px]"></TableHead>
              <TableHead 
                className="py-2 text-[10px] uppercase font-bold tracking-tighter cursor-pointer hover:text-primary transition-colors select-none"
                onClick={() => handleSort('entryDate')}
              >
                Timestamp <SortIcon column="entryDate" />
              </TableHead>
              <TableHead 
                className="py-2 text-[10px] uppercase font-bold tracking-tighter cursor-pointer hover:text-primary transition-colors select-none"
                onClick={() => handleSort('ticker')}
              >
                Ticker <SortIcon column="ticker" />
              </TableHead>
              <TableHead className="py-2 text-[10px] uppercase font-bold tracking-tighter">Side</TableHead>
              <TableHead 
                className="py-2 text-[10px] uppercase font-bold tracking-tighter text-right cursor-pointer hover:text-primary transition-colors select-none"
                onClick={() => handleSort('buyPrice')}
              >
                Entry Price <SortIcon column="buyPrice" />
              </TableHead>
              <TableHead 
                className="py-2 text-[10px] uppercase font-bold tracking-tighter text-right cursor-pointer hover:text-primary transition-colors select-none"
                onClick={() => handleSort('quantity')}
              >
                Qty <SortIcon column="quantity" />
              </TableHead>
              <TableHead 
                className="py-2 text-[10px] uppercase font-bold tracking-tighter cursor-pointer hover:text-primary transition-colors select-none"
                onClick={() => handleSort('status')}
              >
                Status <SortIcon column="status" />
              </TableHead>
              <TableHead 
                className="py-2 text-[10px] uppercase font-bold tracking-tighter text-right cursor-pointer hover:text-primary transition-colors select-none"
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
