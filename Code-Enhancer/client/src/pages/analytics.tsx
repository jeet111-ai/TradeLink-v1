import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, Target, BarChart3, Loader2, AlertTriangle } from "lucide-react";

export default function Analytics() {
  const { data: stats, isLoading } = useQuery<any>({
    queryKey: [api.trades.stats.path],
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-8 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="grid gap-6 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-muted rounded-xl" />
          ))}
        </div>
        <div className="h-[400px] bg-muted rounded-xl" />
      </div>
    );
  }

  if (!stats) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const isProfit = stats.netPnL >= 0;

  // Prepare scatter data
  const scatterData = stats.equityCurve
    .filter((point: any) => point.rMultiple !== 0)
    .map((point: any) => ({
      x: new Date(point.date).getTime(),
      y: point.rMultiple,
      ticker: point.ticker,
      formattedDate: format(new Date(point.date), 'MMM d, yyyy')
    }));

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Advanced Analytics</h1>
        <p className="text-muted-foreground mt-1">Deep dive into your trading performance and strategy efficiency.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card overflow-hidden relative">
          <div className={`absolute top-0 left-0 w-1 h-full ${isProfit ? 'bg-profit' : 'bg-loss'}`} />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold font-display ${isProfit ? 'text-profit' : 'text-loss'}`}>
              ₹{stats.netPnL.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display text-blue-500">
              {stats.winRate}%
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit Factor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display text-amber-500">
              {stats.profitFactor}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Max Drawdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display text-destructive">
              {stats.maxDrawdown}%
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3 text-destructive" />
              <span>Peak to valley drop</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Equity Curve */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Equity Growth Curve</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.equityCurve}>
                <defs>
                  <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isProfit ? "hsl(var(--profit))" : "hsl(var(--loss))"} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={isProfit ? "hsl(var(--profit))" : "hsl(var(--loss))"} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => format(new Date(val), 'MMM d')}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                  itemStyle={{ color: '#f8fafc' }}
                  labelFormatter={(val) => format(new Date(val), 'PPP')}
                />
                <Area 
                  type="monotone" 
                  dataKey="cumulativePnL" 
                  stroke={isProfit ? "hsl(var(--profit))" : "hsl(var(--loss))"} 
                  fillOpacity={1} 
                  fill="url(#colorPnL)" 
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* R-Multiple Scatter Plot */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Trade Quality (R-Multiple)</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name="Date" 
                  domain={['auto', 'auto']}
                  tickFormatter={(val) => format(new Date(val), 'MMM dd')}
                  stroke="#94a3b8"
                  fontSize={10}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name="R-Multiple" 
                  stroke="#94a3b8"
                  fontSize={12}
                />
                <ZAxis range={[60, 60]} />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                  labelFormatter={(val) => format(new Date(val), 'PPP')}
                  formatter={(value: any, name: string, props: any) => {
                    if (name === "R-Multiple") return [`${value} R`, "Quality"];
                    return [props.payload.ticker, "Ticker"];
                  }}
                />
                <Scatter name="Trades" data={scatterData} fill="hsl(var(--primary))" />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Strategy Distribution */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Strategy Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.strategyBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.strategyBreakdown.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => `₹${value.toLocaleString()}`}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
