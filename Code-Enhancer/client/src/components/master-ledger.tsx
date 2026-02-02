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
import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface MasterLedgerProps {
  trades: Trade[];
  onTradeClick?: (trade: Trade) => void;
}

export function MasterLedger({ trades, onTradeClick }: MasterLedgerProps) {
  const [expandedTrades, setExpandedTrades] = useState<Record<number, boolean>>({});

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTrades(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Group trades by parentTradeId
  const mainTrades = trades.filter(t => !t.parentTradeId);
  const childTrades = trades.filter(t => t.parentTradeId);

  const sortedMainTrades = [...mainTrades].sort((a, b) => 
    new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()
  );

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
        <h3 className="font-semibold text-lg font-display">Master Ledger</h3>
        <Badge variant="outline" className="font-mono text-[10px] uppercase">
          Grouped Execution Logs
        </Badge>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border bg-muted/5">
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="py-2 text-[10px] uppercase font-bold tracking-tighter">Timestamp</TableHead>
              <TableHead className="py-2 text-[10px] uppercase font-bold tracking-tighter">Ticker</TableHead>
              <TableHead className="py-2 text-[10px] uppercase font-bold tracking-tighter">Side</TableHead>
              <TableHead className="py-2 text-[10px] uppercase font-bold tracking-tighter text-right">Entry Price</TableHead>
              <TableHead className="py-2 text-[10px] uppercase font-bold tracking-tighter text-right">Qty</TableHead>
              <TableHead className="py-2 text-[10px] uppercase font-bold tracking-tighter">Status</TableHead>
              <TableHead className="py-2 text-[10px] uppercase font-bold tracking-tighter text-right">Net P&L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMainTrades.map((mainTrade) => {
              const children = childTrades.filter(t => t.parentTradeId === mainTrade.id);
              const isExpanded = expandedTrades[mainTrade.id];
              const hasChildren = children.length > 0;

              // Calculate total realized P&L for the main row
              const totalPnL = children.reduce((acc, child) => {
                const pnl = (Number(child.sellPrice) - Number(child.buyPrice)) * Number(child.quantity) - Number(child.fees || 0);
                return acc + pnl;
              }, 0);

              const isWin = totalPnL > 0;
              const isLong = mainTrade.side === "LONG" || !mainTrade.side;
              
              return (
                <React.Fragment key={mainTrade.id}>
                  <TableRow 
                    className="border-border hover:bg-muted/30 transition-colors group cursor-pointer"
                    onClick={() => onTradeClick?.(mainTrade)}
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
                      <span className={cn(
                        "text-[10px] font-bold",
                        mainTrade.status === 'OPEN' ? "text-primary" : "text-muted-foreground"
                      )}>
                        {mainTrade.status}
                      </span>
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
