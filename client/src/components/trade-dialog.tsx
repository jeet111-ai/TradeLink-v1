import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateTrade, useUpdateTrade } from "@/hooks/use-trades";
import { insertTradeSchema, TRADE_TYPES, TRADE_STATUS, type Trade } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

// Extend schema for numeric coercion since inputs return strings
const formSchema = insertTradeSchema.extend({
  buyPrice: z.coerce.number().transform(String),
  sellPrice: z.coerce.number().optional().transform(v => v ? String(v) : undefined),
  quantity: z.coerce.number().transform(String),
  fees: z.coerce.number().transform(String),
  leverage: z.coerce.number().optional().transform(v => v ? String(v) : undefined),
  stopLoss: z.coerce.number().optional().transform(v => v ? String(v) : undefined),
  targetPrice: z.coerce.number().optional().transform(v => v ? String(v) : undefined),
  chartUrl: z.string().url("Invalid URL format").or(z.literal("")).optional(),
  entryDate: z.string().optional(),
  exitDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface TradeDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trade?: Trade | null;
  initialData?: Trade | null;
  mode?: "edit" | "close";
  defaultType?: string;
}

export function TradeDialog({ 
  children, 
  open: controlledOpen, 
  onOpenChange: controlledOnOpenChange, 
  trade,
  initialData: propInitialData, 
  mode = "edit",
  defaultType 
}: TradeDialogProps) {
  const initialData = propInitialData || trade;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange !== undefined ? controlledOnOpenChange : setInternalOpen;

  const createTrade = useCreateTrade();
  const updateTrade = useUpdateTrade();
  
  const isEditing = !!initialData && mode === "edit";
  const isClosing = !!initialData && mode === "close";
  const isPending = createTrade.isPending || updateTrade.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ticker: "",
      type: defaultType || "EQUITY_INTRADAY",
      side: "LONG",
      status: "OPEN",
      buyPrice: "0",
      quantity: "0",
      fees: "0",
      notes: "",
      strategy: "",
      sector: "",
      fundamentalReason: "",
      chartUrl: "",
      entryDate: new Date().toISOString().split('T')[0],
      exitDate: "",
    },
  });

  // Reset form when dialog opens or initialData changes
  useEffect(() => {
    if (open) {
      if (initialData) {
        form.reset({
          ticker: initialData.ticker,
          type: initialData.type as any,
          side: (initialData.side as any) || "LONG",
          status: isClosing ? "CLOSED" : (initialData.status as any),
          buyPrice: initialData.buyPrice,
          sellPrice: isClosing ? "" : (initialData.sellPrice || undefined),
          quantity: initialData.quantity,
          fees: isClosing ? "0" : (initialData.fees || "0"),
          strategy: initialData.strategy || undefined,
          leverage: initialData.leverage || undefined,
          stopLoss: initialData.stopLoss || undefined,
          targetPrice: initialData.targetPrice || undefined,
          sector: initialData.sector || undefined,
          fundamentalReason: initialData.fundamentalReason || undefined,
          notes: isClosing ? "" : (initialData.notes || undefined),
          chartUrl: initialData.chartUrl || "",
          entryDate: initialData.entryDate ? new Date(initialData.entryDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          exitDate: initialData.exitDate ? new Date(initialData.exitDate).toISOString().split('T')[0] : "",
        });
      } else {
        form.reset({
          ticker: "",
          type: defaultType || "EQUITY_INTRADAY",
          side: "LONG",
          status: "OPEN",
          buyPrice: "",
          quantity: "",
          fees: "0",
          strategy: "",
          notes: "",
          chartUrl: "",
          entryDate: new Date().toISOString().split('T')[0],
          exitDate: "",
        });
      }
    }
  }, [open, initialData, form, isClosing, defaultType]);

  const watchType = form.watch("type");
  const isInvestment = watchType === "LONG_TERM_HOLDING";

  async function onSubmit(data: FormValues) {
    // Convert date strings to Date objects
    const processedData = {
      ...data,
      entryDate: data.entryDate ? new Date(data.entryDate) : undefined,
      exitDate: data.exitDate ? new Date(data.exitDate) : undefined,
    };

    if (isClosing && initialData) {
      const res = await fetch(`/api/trades/${initialData.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: data.quantity,
          sellPrice: data.sellPrice,
          exitDate: new Date().toISOString(),
          fees: data.fees
        }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
        queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
        setOpen(false);
      }
    } else if (isEditing && initialData) {
      updateTrade.mutate(
        { id: initialData.id, ...processedData },
        { onSuccess: () => setOpen(false) }
      );
    } else {
      createTrade.mutate(processedData, { onSuccess: () => setOpen(false) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card border-border shadow-2xl">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl font-bold font-display">
            {isClosing ? `Exit Position: ${initialData?.ticker}` : (isEditing ? "Edit Trade" : "New Trade Entry")}
          </DialogTitle>
          <DialogDescription>
            {isClosing 
              ? "Sell your partial or full quantity to realize P&L." 
              : (isEditing ? "Update trade details below." : "Log a new position in your journal.")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          <Form {...form}>
            <form id="trade-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="ticker"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ticker</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g. TATASTEEL" 
                          className="font-mono uppercase" 
                          {...field} 
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          data-testid="input-ticker"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="entryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entry Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          value={field.value || new Date().toISOString().split('T')[0]}
                          data-testid="input-entry-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g. FUTURES, OPTIONS, CRYPTO" 
                          className="uppercase" 
                          {...field} 
                          value={field.value || ""} 
                          data-testid="input-type"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!isInvestment && (
                  <FormField
                    control={form.control}
                    name="side"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Direction</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Direction" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="LONG">Long (Buy)</SelectItem>
                            <SelectItem value="SHORT">Short (Sell)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TRADE_STATUS.map(status => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="buyPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entry Price</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fees"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fees/Commissions</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity {isClosing && `(Max: ${initialData?.quantity})`}</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sellPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isClosing ? "Selling Price" : "Exit Price (Optional)"}</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="chartUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chart / Screenshot URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://tradingview.com/..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Dynamic Fields based on Type */}
              {!isInvestment && (
                <div className="grid grid-cols-3 gap-4 border-t border-border pt-4">
                  <FormField
                    control={form.control}
                    name="stopLoss"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stop Loss</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="targetPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="leverage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Leverage (x)</FormLabel>
                        <FormControl>
                          <Input type="number" step="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="col-span-3">
                    <FormField
                      control={form.control}
                      name="strategy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Strategy Setup</FormLabel>
                          <FormControl>
                          <Input 
                          placeholder="e.g. Breakout, Reversal, Supply Zone" 
                          {...field} 
                          value={field.value || ""}
                        />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {isInvestment && (
                <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                  <FormField
                    control={form.control}
                    name="sector"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sector</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || "OTHER"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Sector" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {["FINANCIALS", "ENERGY", "IT", "AUTO", "PHARMA", "FMCG", "COMMODITIES", "CRYPTO", "OTHER"].map(sector => (
                              <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="fundamentalReason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fundamental Thesis</FormLabel>
                          <FormControl>
                          <Textarea 
                          placeholder="Why this investment?" 
                          {...field} 
                          value={field.value || ""}
                        />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Trade execution details, emotions, lessons..." 
                        className="resize-none h-20"
                        {...field} 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        <DialogFooter className="p-6 pt-2 border-t border-border">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button form="trade-form" type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isClosing ? "Sell/Exit" : (isEditing ? "Save Changes" : "Log Trade")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
