import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
}

export function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon,
  trend,
  trendValue,
  className 
}: StatCardProps) {
  return (
    <Card className={cn("glass-card overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="font-display text-2xl font-bold text-foreground tracking-tight">{value}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Icon className="h-6 w-6" />
          </div>
        </div>
        
        {(description || trendValue) && (
          <div className="mt-4 flex items-center gap-2 text-xs">
            {trendValue && (
              <span className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                trend === "up" && "bg-profit-soft text-profit",
                trend === "down" && "bg-loss-soft text-loss",
                trend === "neutral" && "bg-muted text-muted-foreground"
              )}>
                {trendValue}
              </span>
            )}
            {description && (
              <span className="text-muted-foreground">{description}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
