import { useTrades } from "@/hooks/use-trades";
import { useState } from "react";
import { TradeDialog } from "@/components/trade-dialog";
import { TradeDetails } from "@/components/trade-details";
import { SearchFilter } from "@/components/search-filter";
import { Button } from "@/components/ui/button";
import { Trade } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Legend, 
  Tooltip as RechartsTooltip 
} from 'recharts';
import { Plus, TrendingUp, TrendingDown, ExternalLink, Image as ImageIcon } from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Portfolio() {
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

  if (isLoading) return <div className="p-8 text-center">Loading Portfolio...</div>;

  // Filter for Long-Term Holdings
  const investments = (trades || []).filter(t => t.type === "LONG_TERM_HOLDING");
  
  const filteredInvestments = investments.filter(t => {
    const matchesSearch = t.ticker.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
    const matchesType = typeFilter === "ALL" || t.type === typeFilter;
    
    // Date Range Filter
    const entryDate = new Date(t.entryDate);
    const matchesDate = (!dateRange.from || entryDate >= dateRange.from) && 
                       (!dateRange.to || entryDate <= dateRange.to);
    
    // P&L Filter (for investments, usually based on closed profit or unrealized but we'll stick to closed for consistency if available)
    let matchesPnl = true;
    if (pnlFilter !== "ALL" && t.status === 'CLOSED' && t.sellPrice) {
      const pnl = (Number(t.sellPrice) - Number(t.buyPrice)) * Number(t.quantity) - Number(t.fees || 0);
      if (pnlFilter === "PROFIT") matchesPnl = pnl > 0;
      if (pnlFilter === "LOSS") matchesPnl = pnl < 0;
    }
    
    return matchesSearch && matchesStatus && matchesType && matchesDate && matchesPnl;
  });

  const availableTypes = Array.from(new Set(investments.map(t => t.type)));

  // Calculate stats
  const totalInvestment = investments.reduce((acc, t) => acc + (Number(t.buyPrice) * Number(t.quantity)), 0);
  
  // Sector allocation data
  const sectorDataMap = investments.reduce((acc: any, t) => {
    const sector = t.sector || 'Uncategorized';
    const value = Number(t.buyPrice) * Number(t.quantity);
    acc[sector] = (acc[sector] || 0) + value;
    return acc;
  }, {});

  const sectorData = Object.entries(sectorDataMap).map(([name, value]) => ({
    name,
    value: Number(value)
  }));

  const sortedInvestments = [...filteredInvestments].sort((a, b) => 
    new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Investment Vault</h1>
          <p className="text-muted-foreground mt-1">Long-term equity portfolio tracking.</p>
        </div>
        <TradeDialog defaultType="LONG_TERM_HOLDING">
          <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
            <Plus className="mr-2 h-4 w-4" /> Add Asset
          </Button>
        </TradeDialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="glass-card border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Total Capital Deployed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display text-primary">₹{totalInvestment.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Across {investments.length} assets</p>
          </CardContent>
        </Card>
      </div>

      {/* High-Density Detailed Table */}
      <Card className="glass-card border-border/50 overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-muted/5 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold whitespace-nowrap">Asset Details</CardTitle>
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50 bg-muted/10">
                  <TableHead className="py-3 text-[10px] uppercase font-bold tracking-wider">Timestamp</TableHead>
                  <TableHead className="py-3 text-[10px] uppercase font-bold tracking-wider">Script Name</TableHead>
                  <TableHead className="py-3 text-[10px] uppercase font-bold tracking-wider">Sector</TableHead>
                  <TableHead className="py-3 text-[10px] uppercase font-bold tracking-wider text-right">Avg Price</TableHead>
                  <TableHead className="py-3 text-[10px] uppercase font-bold tracking-wider text-right">Quantity</TableHead>
                  <TableHead className="py-3 text-[10px] uppercase font-bold tracking-wider text-right">Invested Value</TableHead>
                  <TableHead className="py-3 text-[10px] uppercase font-bold tracking-wider">Status</TableHead>
                  <TableHead className="py-3 text-[10px] uppercase font-bold tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedInvestments.map((trade) => {
                  const investedValue = Number(trade.buyPrice) * Number(trade.quantity);
                  
                  return (
                    <TableRow 
                      key={trade.id} 
                      className="border-border/40 hover:bg-muted/30 transition-colors group cursor-pointer"
                      onClick={() => handleTradeClick(trade)}
                    >
                      <TableCell className="font-mono text-[10px] text-muted-foreground whitespace-nowrap py-3">
                        {format(new Date(trade.entryDate), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm tracking-tight">{trade.ticker}</span>
                          <span className="text-[9px] text-muted-foreground uppercase">{trade.type.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="secondary" className="text-[10px] bg-muted/50 border-border/50">
                          {trade.sector || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs py-3">
                        ₹{Number(trade.buyPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs py-3">
                        {Number(trade.quantity).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold py-3 text-primary">
                        ₹{investedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge className={cn(
                          "text-[10px] h-5",
                          trade.status === 'OPEN' ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" : "bg-muted text-muted-foreground"
                        )}>
                          {trade.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {trade.chartUrl && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-primary hover:bg-primary/10"
                              onClick={() => window.open(trade.chartUrl!, '_blank')}
                            >
                              <ImageIcon className="h-4 w-4" />
                            </Button>
                          )}
                          <TradeDialog initialData={trade}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TradeDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {sortedInvestments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      No assets match your search criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <TradeDetails
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        trade={selectedTrade}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Sector Allocation */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Sector Allocation</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sectorData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sectorData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  itemStyle={{ color: '#f8fafc' }}
                  formatter={(value: number) => `₹${value.toLocaleString()}`}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Fundamental Thesis Highlights */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Core Thesis Log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
            {investments.filter(t => t.fundamentalReason).map((trade) => (
              <div key={trade.id} className="p-4 rounded-lg bg-muted/20 border border-border/50 space-y-2 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{trade.ticker}</span>
                  <Badge variant="outline" className="text-[10px]">{trade.sector}</Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed italic">
                  "{trade.fundamentalReason}"
                </p>
              </div>
            ))}
            {investments.filter(t => t.fundamentalReason).length === 0 && (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic py-12">
                No fundamental reasons recorded yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
