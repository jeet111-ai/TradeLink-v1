import { useQuery } from "@tanstack/react-query";
import { Trade } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, ArrowRight, History, PlayCircle, Package, Receipt } from "lucide-react";

interface TradeDetailsProps {
  trade: Trade | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CampaignData {
  main_ticker: string;
  original_quantity: number;
  total_realized_pnl: number;
  timeline: Array<{
    type: 'ENTRY' | 'EXIT' | 'HOLDING';
    date: string;
    qty: number;
    price: number;
    pnl?: number;
  }>;
}

export function TradeDetails({ trade, open, onOpenChange }: TradeDetailsProps) {
  const { data: campaign, isLoading } = useQuery<CampaignData>({
    queryKey: ["/api/trades", trade?.id, "campaign"],
    queryFn: async () => {
      const res = await fetch(`/api/trades/${trade?.id}/campaign`);
      if (!res.ok) throw new Error("Failed to fetch campaign data");
      return res.json();
    },
    enabled: !!trade && open,
  });

  if (!trade) return null;

  const entryEvent = campaign?.timeline.find(t => t.type === 'ENTRY');
  const holdingEvent = campaign?.timeline.find(t => t.type === 'HOLDING');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border shadow-2xl p-0 overflow-hidden flex flex-col h-[85vh] sm:h-[80vh]">
        <DialogHeader className="p-6 pb-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <History className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold font-display">{trade.ticker}</DialogTitle>
                <p className="text-sm text-muted-foreground">Trade Family Lifecycle</p>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              trade.status === 'OPEN' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground'
            }`}>
              {trade.status}
            </div>
          </div>
          <Separator className="mt-4" />
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1">
            <div className="px-6 py-2">
              <div className="space-y-6">
                {campaign?.timeline.map((event, idx) => {
                  const isEntry = event.type === 'ENTRY';
                  const isExit = event.type === 'EXIT';
                  const isHolding = event.type === 'HOLDING';

                  return (
                    <div key={idx} className="relative pl-8 border-l-2 border-border/50 last:border-l-0 pb-6 last:pb-2">
                      <div className={cn(
                        "absolute -left-[11px] top-0 w-5 h-5 rounded-full border-4 border-card flex items-center justify-center z-10",
                        isEntry ? "bg-primary" : isExit ? "bg-amber-500" : "bg-blue-500"
                      )}>
                        {isEntry && <PlayCircle className="h-2 w-2 text-primary-foreground" />}
                        {isExit && <Receipt className="h-2 w-2 text-white" />}
                        {isHolding && <Package className="h-2 w-2 text-white" />}
                      </div>
                      
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-muted/20 p-4 rounded-xl border border-border/30 hover:bg-muted/30 transition-colors gap-4">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-foreground flex items-center gap-2 flex-wrap">
                            {isEntry ? "Original Position Opened" : isExit ? `Partial Exit ${idx}` : "Remaining Holding"}
                            {isEntry && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full whitespace-nowrap">START</span>}
                          </h4>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                            {isHolding ? "As of Now" : format(new Date(event.date), "PPP p")}
                          </p>
                        </div>
                        
                        <div className="w-full sm:w-auto text-left sm:text-right shrink-0">
                          <div className="flex items-center sm:justify-end gap-2 flex-wrap">
                            <p className="font-mono font-bold text-sm sm:text-base whitespace-nowrap">
                              {isEntry ? 'Entry' : isExit ? 'Sold' : 'Active'}: {event.qty}
                            </p>
                            {event.pnl !== undefined && (
                              <div className="flex items-center gap-2">
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <p className={cn("font-bold whitespace-nowrap", event.pnl >= 0 ? "text-profit" : "text-loss")}>
                                  {event.pnl >= 0 ? '+' : ''}₹{event.pnl.toLocaleString()}
                                </p>
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 whitespace-nowrap">
                            Avg Price: ₹{Number(event.price).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        </div>

        <div className="p-6 pt-4 border-t border-border mt-auto bg-card shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-profit/5 p-4 rounded-xl border border-profit/20">
              <p className="text-[10px] text-profit uppercase tracking-widest font-black mb-1">Realized P&L</p>
              <div className={cn("text-xl sm:text-2xl font-black", (campaign?.total_realized_pnl || 0) >= 0 ? "text-profit" : "text-loss")}>
                ₹{campaign?.total_realized_pnl.toLocaleString()}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">From sold chunks</p>
            </div>
            
            <div className="bg-blue-500/5 p-4 rounded-xl border border-blue-500/20">
              <p className="text-[10px] text-blue-500 uppercase tracking-widest font-black mb-1">Unrealized Value</p>
              <div className="text-xl sm:text-2xl font-black text-blue-500">
                ₹{((holdingEvent?.qty || 0) * (holdingEvent?.price || 0)).toLocaleString()}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Currently in market</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
