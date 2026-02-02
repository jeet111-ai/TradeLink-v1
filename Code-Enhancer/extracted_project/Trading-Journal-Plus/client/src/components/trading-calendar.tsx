import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isToday,
  startOfWeek,
  endOfWeek
} from "date-fns";
import { Trade } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TradingCalendarProps {
  trades: Trade[];
}

export function TradingCalendar({ trades }: TradingCalendarProps) {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const getDayPnL = (day: Date) => {
    return trades
      .filter(t => t.status === 'CLOSED' && t.exitDate && isSameDay(new Date(t.exitDate), day))
      .reduce((acc, t) => {
        const pnl = (Number(t.sellPrice) - Number(t.buyPrice)) * Number(t.quantity) - Number(t.fees || 0);
        return acc + pnl;
      }, 0);
  };

  const getHeatmapColor = (pnl: number) => {
    if (pnl === 0) return "bg-muted/20";
    if (pnl > 0) {
      if (pnl > 5000) return "bg-green-600 text-white";
      if (pnl > 2000) return "bg-green-500 text-white";
      return "bg-green-400 text-white";
    }
    if (pnl < 0) {
      if (pnl < -5000) return "bg-red-600 text-white";
      if (pnl < -2000) return "bg-red-500 text-white";
      return "bg-red-400 text-white";
    }
    return "bg-muted/20";
  };

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">
          {format(today, 'MMMM yyyy')}
        </CardTitle>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" /> Profit
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" /> Loss
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-[10px] font-medium text-muted-foreground py-1 uppercase tracking-wider">
              {day}
            </div>
          ))}
          <TooltipProvider>
            {days.map((day, i) => {
              const pnl = getDayPnL(day);
              const isCurrentMonth = day.getMonth() === today.getMonth();
              
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "aspect-square rounded-sm flex items-center justify-center text-[10px] font-mono transition-all cursor-default",
                        isCurrentMonth ? getHeatmapColor(pnl) : "opacity-20 pointer-events-none",
                        isToday(day) && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                      )}
                    >
                      {format(day, 'd')}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <p className="font-bold">{format(day, 'MMMM d, yyyy')}</p>
                      <p className={cn(
                        "mt-1 font-mono",
                        pnl > 0 ? "text-green-400" : pnl < 0 ? "text-red-400" : "text-muted-foreground"
                      )}>
                        Net P&L: ₹{pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
