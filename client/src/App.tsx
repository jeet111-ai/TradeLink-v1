import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LayoutSidebar } from "@/components/layout-sidebar";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import ActiveJournal from "@/pages/active-journal";
import Portfolio from "@/pages/portfolio";
import Analytics from "@/pages/analytics";
import MasterLedgerPage from "@/pages/master-ledger";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import AuthPage from "@/pages/auth-page";

function Router() {
  const [location] = useLocation();
  
  // Master Ledger is full-screen without sidebar
  // Auth page is also full-screen
  const isFullScreenRoute = location === "/" || location === "/ledger" || location === "/auth";
  
  if (isFullScreenRoute) {
    return (
      <Switch>
        {/* Protected Ledger */}
        <ProtectedRoute path="/" component={MasterLedgerPage} />
        <ProtectedRoute path="/ledger" component={MasterLedgerPage} />
        <Route path="/auth" component={AuthPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <LayoutSidebar />
      <main className="flex-1 ml-64 overflow-y-auto h-screen bg-grid-pattern">
        <div className="mx-auto max-w-7xl p-8">
          <Switch>
            <ProtectedRoute path="/dashboard" component={Dashboard} />
            <ProtectedRoute path="/journal" component={ActiveJournal} />
            <ProtectedRoute path="/portfolio" component={Portfolio} />
            <ProtectedRoute path="/analytics" component={Analytics} />
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
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
