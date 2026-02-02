import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export default function SymbolSearch() {
  const container = useRef<HTMLDivElement>(null);
  const [symbol, setSymbol] = useState("NSE:NIFTY");
  const [inputValue, setInputValue] = useState("");

  const handleSearch = () => {
    if (inputValue.trim()) {
      // Basic formatting to help TradingView find the symbol
      let formattedSymbol = inputValue.trim().toUpperCase();
      if (!formattedSymbol.includes(":")) {
        formattedSymbol = `NSE:${formattedSymbol}`;
      }
      setSymbol(formattedSymbol);
    }
  };

  useEffect(() => {
    if (!container.current) return;
    
    container.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: symbol,
      width: "100%",
      height: "100%",
      locale: "en",
      dateRange: "12M",
      colorTheme: "dark",
      isTransparent: true,
      autosize: true,
      largeChartUrl: ""
    });

    container.current.appendChild(script);
  }, [symbol]);

  return (
    <div className="flex flex-col h-full w-full gap-2 p-4">
      <div className="flex gap-2">
        <Input 
          placeholder="Search Symbol (e.g., RELIANCE, TATAMOTORS)"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="h-9 text-xs"
        />
        <Button size="sm" onClick={handleSearch} className="h-9">
          <Search className="h-4 w-4" />
        </Button>
      </div>
      <div className="tradingview-widget-container flex-1 min-h-[180px]" ref={container}>
        <div className="tradingview-widget-container__widget h-full w-full"></div>
      </div>
    </div>
  );
}
