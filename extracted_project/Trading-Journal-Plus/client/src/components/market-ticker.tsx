import { useEffect, useRef } from "react";

export function MarketTicker() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;

    // Check if the script is already added
    if (container.current.querySelector("script")) return;

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: "CAPITALCOM:CNX100", title: "NIFTY 100" },
        { proName: "FOREXCOM:SPX500", title: "S&P 500" },
        { proName: "FX_IDC:INRUSD", title: "USD/INR" },
        { proName: "TVC:GOLD", title: "GOLD" },
        { proName: "TVC:SILVER", title: "SILVER" },
        { proName: "TVC:USOIL", title: "CRUDE OIL" },
        { proName: "NASDAQ:NQ1!", title: "NASDAQ 100" },
        { proName: "BITSTAMP:BTCUSD", title: "BITCOIN" },
      ],
      showSymbolLogo: true,
      colorTheme: "dark",
      isTransparent: true,
      displayMode: "adaptive",
      locale: "en",
    });

    container.current.appendChild(script);
  }, []);

  return (
    <div className="tradingview-widget-container" ref={container}>
      <div className="tradingview-widget-container__widget"></div>
    </div>
  );
}
