import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LayoutSidebar } from "@/components/layout-sidebar";
import NotFound from "@/pages/not-found";

// Pages
import Dashboard from "@/pages/dashboard";
import ActiveJournal from "@/pages/active-journal";
import Portfolio from "@/pages/portfolio";
import Analytics from "@/pages/analytics";
import MasterLedgerPage from "@/pages/master-ledger";

function Router() {
  const [location] = useLocation();
  
  // Master Ledger is full-screen without sidebar
  const isFullScreenRoute = location === "/" || location === "/ledger";
  
  if (isFullScreenRoute) {
    return (
      <Switch>
        <Route path="/" component={MasterLedgerPage} />
        <Route path="/ledger" component={MasterLedgerPage} />
      </Switch>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <LayoutSidebar />
      <main className="flex-1 ml-64 overflow-y-auto h-screen bg-grid-pattern">
        <div className="mx-auto max-w-7xl p-8">
          <Switch>
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/journal" component={ActiveJournal} />
            <Route path="/portfolio" component={Portfolio} />
            <Route path="/analytics" component={Analytics} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
