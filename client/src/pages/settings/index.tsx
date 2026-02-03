import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUp, FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTrades, useCreateTrade } from "@/hooks/use-trades";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { data: trades } = useTrades();
  const createTrade = useCreateTrade();
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = () => {
    if (!trades || trades.length === 0) return;
    
    const headers = Object.keys(trades[0]).join(",");
    const rows = trades.map(t => Object.values(t).map(v => `"${v}"`).join(",")).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "trades_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      if (lines.length < 2) {
        setIsImporting(false);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const data = lines.slice(1);

      const findHeader = (aliases: string[]) => headers.findIndex(h => aliases.includes(h));

      const tickerIdx = findHeader(['ticker', 'symbol', 'script', 'stock']);
      const buyPriceIdx = findHeader(['buy price', 'entry', 'avg price', 'buy_price', 'price']);
      const qtyIdx = findHeader(['quantity', 'qty', 'units', 'vol']);
      const typeIdx = findHeader(['type', 'segment', 'category']);
      const sideIdx = findHeader(['side', 'direction', 'buy/sell']);

      let importedCount = 0;
      for (const line of data) {
        if (!line.trim()) continue;
        const cols = line.split(',').map(c => c.trim());

        const trade = {
          ticker: tickerIdx !== -1 ? cols[tickerIdx] : 'UNKNOWN',
          buyPrice: buyPriceIdx !== -1 ? cols[buyPriceIdx] : '0',
          quantity: qtyIdx !== -1 ? cols[qtyIdx] : '0',
          type: typeIdx !== -1 ? cols[typeIdx].toUpperCase() : 'EQUITY_INTRADAY',
          side: (sideIdx !== -1 ? (cols[sideIdx].toUpperCase().includes('SELL') || cols[sideIdx].toUpperCase().includes('SHORT') ? 'SHORT' : 'LONG') : 'LONG') as "LONG" | "SHORT",
          status: 'OPEN' as const,
          entryDate: new Date(),
        };

        try {
          await createTrade.mutateAsync(trade);
          importedCount++;
        } catch (err) {
          console.error('Failed to import trade:', err);
        }
      }

      toast({
        title: "Import Complete",
        description: `Successfully imported ${importedCount} trades.`,
      });
      setIsImporting(false);
      if (event.target) event.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>Import or export your trading data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Import Trades (CSV)</p>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvImport}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isImporting}
                />
                <Button variant="outline" className="w-full gap-2" disabled={isImporting}>
                  {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                  Smart CSV Import
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Export Trades</p>
              <Button variant="outline" className="w-full gap-2" onClick={handleExport}>
                <FileDown className="h-4 w-4" />
                Export to Excel/CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
