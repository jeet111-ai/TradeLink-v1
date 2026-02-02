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
import { Plus, ArrowUpRight, ArrowDownRight, ExternalLink, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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

  const handleTradeClick = (trade: Trade) => {
    setSelectedTrade(trade);
    setIsDetailsOpen(true);
  };

  if (isLoading) return <div>Loading...</div>;

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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Active Journal</h1>
          <p className="text-muted-foreground mt-1">Intraday & Futures performance analytics.</p>
        </div>
        <TradeDialog defaultType="EQUITY_INTRADAY">
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Log Day Trade
          </Button>
        </TradeDialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit Factor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{profitFactor.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Gross Profit / Gross Loss</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Realized P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-display ${cumulative >= 0 ? 'text-profit' : 'text-loss'}`}>
              ₹{cumulative.toFixed(2)}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              {cumulative >= 0 ? <ArrowUpRight className="h-3 w-3 text-profit" /> : <ArrowDownRight className="h-3 w-3 text-loss" />}
              <span>All time</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Trade Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{pnlData.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Closed trades</p>
          </CardContent>
        </Card>
      </div>

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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Recent Trades</CardTitle>
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

      <TradeDetails
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        trade={selectedTrade}
      />
    </div>
  );
}
