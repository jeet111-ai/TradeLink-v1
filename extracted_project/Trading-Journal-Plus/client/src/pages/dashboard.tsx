import { useState } from "react";
import { useTrades, useDeleteTrade } from "@/hooks/use-trades";
import { StatCard } from "@/components/stat-card";
import { TradeDialog } from "@/components/trade-dialog";
import { TradeDetails } from "@/components/trade-details";
import { TradingCalendar } from "@/components/trading-calendar";
import { MasterLedger } from "@/components/master-ledger";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  Wallet,
  TrendingUp,
  BarChart3,
  Activity,
  Search as SearchIcon,
} from "lucide-react";
import { Trade } from "@shared/schema";

import { MarketTicker } from "@/components/market-ticker";
import SymbolSearch from "@/components/symbol-search";

export default function Dashboard() {
  const { data: trades, isLoading } = useTrades();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Quick stats calculation
  const totalTrades = trades?.length || 0;
  const activePositions =
    trades?.filter((t) => t.status === "OPEN").length || 0;

  // Calculate Net P&L (very basic logic for demo)
  const netPnL =
    trades?.reduce((acc, t) => {
      if (t.sellPrice && t.status === "CLOSED") {
        const pnl =
          (Number(t.sellPrice) - Number(t.buyPrice)) * Number(t.quantity) -
          Number(t.fees || 0);
        return acc + pnl;
      }
      return acc;
    }, 0) || 0;

  const winRate = (() => {
    const closed = trades?.filter((t) => t.status === "CLOSED") || [];
    if (closed.length === 0) return 0;
    const wins = closed.filter(
      (t) => Number(t.sellPrice) > Number(t.buyPrice),
    ).length;
    return Math.round((wins / closed.length) * 100);
  })();

  const handleNewTrade = () => {
    setSelectedTrade(null);
    setIsDialogOpen(true);
  };

  const handleTradeClick = (trade: Trade) => {
    setSelectedTrade(trade);
    setIsDetailsOpen(true);
  };

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="-mx-8 -mt-8 mb-8 border-b border-border/50">
        <MarketTicker />
      </div>

      <div className="flex items-center justify-between">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative px-4 py-2 bg-card rounded-lg border border-border">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Welcome back,{" "}
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                Trader
              </span>
            </h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Activity className="h-3 w-3 text-primary animate-pulse" />
              Your trading engine is ready.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button
            onClick={handleNewTrade}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
          >
            <Plus className="mr-2 h-4 w-4" /> New Entry
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Net P&L"
          value={`₹${netPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          icon={Wallet}
          trend={netPnL >= 0 ? "up" : "down"}
          trendValue={netPnL >= 0 ? "+4.5%" : "-2.1%"}
          className="border-primary/20"
        />
        <StatCard
          title="Win Rate"
          value={`${winRate}%`}
          icon={Activity}
          description="Based on closed trades"
        />
        <StatCard
          title="Active Positions"
          value={activePositions}
          icon={TrendingUp}
          description="Currently open"
        />
        <StatCard
          title="Total Trades"
          value={totalTrades}
          icon={BarChart3}
          description="Lifetime volume"
        />
      </div>

      {/* Trading Calendar Heatmap & Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TradingCalendar trades={trades || []} />
        </div>
        <div className="space-y-6">
          <Card className="glass-card border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg">Quick Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Best Day
                </p>
                <p className="text-lg font-bold text-profit mt-1">₹12,450.00</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Worst Day
                </p>
                <p className="text-lg font-bold text-loss mt-1">-₹4,200.00</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Avg Daily P&L
                </p>
                <p className="text-lg font-bold mt-1"></p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/50 overflow-hidden">
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2 px-4 py-3 border-b border-border/50">
              <SearchIcon className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium uppercase tracking-wider">
                Market Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <SymbolSearch />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Master Ledger (High-Density Grid) */}
      <MasterLedger trades={trades || []} onTradeClick={handleTradeClick} />

      <TradeDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setSelectedTrade(null);
        }}
        trade={selectedTrade}
      />

      <TradeDetails
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        trade={selectedTrade}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
}
