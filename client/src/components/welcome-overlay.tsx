import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LineChart, BookOpen, Wallet, Activity, ArrowRight, CheckCircle2 } from "lucide-react";

export function WelcomeOverlay() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if user has seen the welcome screen
    const hasSeenWelcome = localStorage.getItem("has_seen_welcome_v1");
    if (!hasSeenWelcome) {
      setShow(true);
    }
  }, []);

  const handleGetStarted = () => {
    // Save the flag so it never shows again
    localStorage.setItem("has_seen_welcome_v1", "true");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm animate-in fade-in duration-500">
      <div className="max-w-4xl w-full mx-4">
        <div className="grid md:grid-cols-2 gap-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card">
          
          {/* Left Side: Visuals & Branding */}
          <div className="relative p-8 md:p-12 bg-primary flex flex-col justify-between text-primary-foreground overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
            
            <div className="relative z-10">
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center mb-6 backdrop-blur-md border border-white/10">
                <Activity className="h-6 w-6 text-white" />
              </div>
              
              {/* --- APP NAME ADDED HERE --- */}
              <h1 className="text-3xl md:text-4xl font-bold font-display mb-4">
                Welcome to <br/> TradeLink
              </h1>
              
              <p className="text-primary-foreground/80 text-lg leading-relaxed">
                Your professional trading companion. Stop guessing, start tracking, and master the markets with TradeLink.
              </p>
            </div>

            <div className="relative z-10 mt-12 space-y-4">
              <div className="flex items-center gap-3 text-sm font-medium">
                <CheckCircle2 className="h-5 w-5 text-green-300" />
                <span>Real-time Analytics</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-medium">
                <CheckCircle2 className="h-5 w-5 text-green-300" />
                <span>Institutional Grade Ledger</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-medium">
                <CheckCircle2 className="h-5 w-5 text-green-300" />
                <span>Live Market Data</span>
              </div>
            </div>
          </div>

          {/* Right Side: Features & Action */}
          <div className="p-8 md:p-12 flex flex-col justify-center bg-card">
            <div className="space-y-8">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">What's Inside TradeLink?</h3>
                <p className="text-muted-foreground text-sm">Everything you need to become profitable.</p>
              </div>

              <div className="grid gap-6">
                <FeatureItem 
                  icon={<BookOpen className="h-5 w-5 text-blue-500" />}
                  title="Master Ledger"
                  desc="Log every trade with precision. Track entry, exit, SL, and notes."
                />
                <FeatureItem 
                  icon={<LineChart className="h-5 w-5 text-green-500" />}
                  title="Advanced Analytics"
                  desc="Visualize your win rate, equity curve, and drawdown automatically."
                />
                <FeatureItem 
                  icon={<Wallet className="h-5 w-5 text-purple-500" />}
                  title="Portfolio Manager"
                  desc="Keep track of long-term holdings separate from intraday trades."
                />
              </div>

              <div className="pt-4">
                <Button 
                  size="lg" 
                  className="w-full text-base font-semibold shadow-lg hover:shadow-primary/20 transition-all duration-300"
                  onClick={handleGetStarted}
                >
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-center text-xs text-muted-foreground mt-4">
                  TradeLink v1.0 • Initial Release
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="flex gap-4 items-start group">
      <div className="h-10 w-10 shrink-0 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-muted transition-colors">
        {icon}
      </div>
      <div>
        <h4 className="font-medium text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground leading-snug">{desc}</p>
      </div>
    </div>
  );
}