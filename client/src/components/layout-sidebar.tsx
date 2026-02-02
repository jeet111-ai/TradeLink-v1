import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Briefcase, 
  LineChart, 
  Settings,
  LogOut,
  Table2,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";

export function LayoutSidebar() {
  const [location] = useLocation();

  const { logoutMutation } = useAuth();

  const navItems = [
    { href: "/", label: "Master Ledger", icon: Table2 },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/journal", label: "Active Journal", icon: Activity },
    { href: "/portfolio", label: "Portfolio", icon: Briefcase },
    { href: "/analytics", label: "Analytics", icon: LineChart },
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card/50 backdrop-blur-xl">
      <div className="flex h-full flex-col px-3 py-4">
        <div className="mb-10 px-3 pt-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-600 text-white shadow-lg shadow-primary/20">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-xl font-bold tracking-tight text-white leading-none">
                TradeLink
              </span>
            </div>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-primary/10 text-primary shadow-sm shadow-primary/5" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}>
                  <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-1 border-t border-border pt-4">
          <div className="px-3 pb-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-bold mb-1">Branding</p>
            <p className="text-xs text-muted-foreground italic">Designed by Jeet</p>
          </div>
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
            <Settings className="h-4 w-4" />
            Settings
          </button>
          <button 
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>
      </div>
    </aside>
  );
}
