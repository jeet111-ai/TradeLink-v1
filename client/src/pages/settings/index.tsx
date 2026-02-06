import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUp, FileDown, Loader2, FileText } from "lucide-react";
import { useState } from "react";
import { useTrades, useCreateTrade } from "@/hooks/use-trades";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  const { data: trades } = useTrades();
  const createTrade = useCreateTrade();
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const { changePasswordMutation } = useAuth();

  const changePasswordSchema = z
    .object({
      currentPassword: z.string().min(1, "Current password is required."),
      newPassword: z.string().min(6, "Password must be at least 6 characters."),
      confirmPassword: z.string().min(6, "Confirm your new password."),
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      message: "Passwords do not match.",
      path: ["confirmPassword"],
    });

  const changePasswordForm = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const TEMPLATE_HEADERS = [
    "ticker",
    "buy_price",
    "quantity",
    "type",
    "side",
    "status",
    "entry_date",
    "exit_date",
    "sell_price",
    "fees",
    "notes",
    "strategy",
    "sector",
    "leverage",
    "stop_loss",
    "target_price",
    "chart_url",
    "fundamental_reason",
    "parent_trade_id",
  ];

  const handleDownloadTemplate = () => {
    const headers = TEMPLATE_HEADERS.join(",");
    const sample = [
      "AAPL",
      "195.5",
      "10",
      "EQUITY_INTRADAY",
      "LONG",
      "OPEN",
      "2025-02-01",
      "",
      "",
      "0",
      "First import",
      "Breakout",
      "Tech",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ].join(",");

    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + sample;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "trades_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCsvLine = (line: string) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        i++;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
        continue;
      }

      current += char;
    }

    values.push(current);
    return values.map((value) => value.trim());
  };

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
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) {
        setIsImporting(false);
        return;
      }

      const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
      const data = lines.slice(1);

      const missingHeaders = ["ticker", "buy_price", "quantity", "type", "side", "status", "entry_date"]
        .filter((header) => !headers.includes(header));

      if (missingHeaders.length > 0) {
        toast({
          title: "Import failed",
          description: `Missing required columns: ${missingHeaders.join(", ")}. Please use the template.`,
          variant: "destructive",
        });
        setIsImporting(false);
        if (event.target) event.target.value = "";
        return;
      }

      const headerIndex = (header: string) => headers.indexOf(header);
      const getValue = (cols: string[], header: string) => {
        const idx = headerIndex(header);
        return idx !== -1 ? cols[idx] : "";
      };

      let importedCount = 0;
      for (const line of data) {
        if (!line.trim()) continue;
        const cols = parseCsvLine(line);

        const typeValue = getValue(cols, "type").toUpperCase() || "EQUITY_INTRADAY";
        const sideValue = getValue(cols, "side").toUpperCase() || "LONG";
        const statusValue = getValue(cols, "status").toUpperCase() || "OPEN";
        const entryDateValue = getValue(cols, "entry_date");
        const exitDateValue = getValue(cols, "exit_date");

        const parsedEntryDate = entryDateValue ? new Date(entryDateValue) : new Date();
        const parsedExitDate = exitDateValue ? new Date(exitDateValue) : undefined;

        const parentTradeIdRaw = getValue(cols, "parent_trade_id");
        const parentTradeIdValue =
          parentTradeIdRaw && !Number.isNaN(Number(parentTradeIdRaw))
            ? Number(parentTradeIdRaw)
            : undefined;

        const trade = {
          ticker: getValue(cols, "ticker") || "UNKNOWN",
          buyPrice: getValue(cols, "buy_price") || "0",
          quantity: getValue(cols, "quantity") || "0",
          type: typeValue,
          side: (sideValue === "SHORT" ? "SHORT" : "LONG") as "LONG" | "SHORT",
          status: (statusValue === "CLOSED" ? "CLOSED" : "OPEN") as "OPEN" | "CLOSED",
          entryDate: isNaN(parsedEntryDate.getTime()) ? new Date() : parsedEntryDate,
          exitDate: parsedExitDate && !isNaN(parsedExitDate.getTime()) ? parsedExitDate : null,
          sellPrice: getValue(cols, "sell_price") || undefined,
          fees: getValue(cols, "fees") || undefined,
          notes: getValue(cols, "notes") || undefined,
          strategy: getValue(cols, "strategy") || undefined,
          sector: getValue(cols, "sector") || undefined,
          leverage: getValue(cols, "leverage") || undefined,
          stopLoss: getValue(cols, "stop_loss") || undefined,
          targetPrice: getValue(cols, "target_price") || undefined,
          chartUrl: getValue(cols, "chart_url") || undefined,
          fundamentalReason: getValue(cols, "fundamental_reason") || undefined,
          parentTradeId: parentTradeIdValue,
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
              <Button variant="secondary" className="w-full gap-2" onClick={handleDownloadTemplate}>
                <FileText className="h-4 w-4" />
                Download Import Template
              </Button>
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
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>Update your account password.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...changePasswordForm}>
              <form
                onSubmit={changePasswordForm.handleSubmit((data) =>
                  changePasswordMutation.mutate(
                    { currentPassword: data.currentPassword, newPassword: data.newPassword },
                    { onSuccess: () => changePasswordForm.reset() },
                  )
                )}
                className="space-y-4"
              >
                <FormField
                  control={changePasswordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={changePasswordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={changePasswordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={changePasswordMutation.isPending}
                >
                  Update Password
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
