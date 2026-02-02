import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertTrade } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useTrades(filters?: { type?: "FUTURES" | "EQUITY_INTRADAY" | "LONG_TERM_HOLDING", status?: "OPEN" | "CLOSED" }) {
  const queryKey = [api.trades.list.path, filters?.type, filters?.status].filter(Boolean);
  
  // Construct URL with query params
  let url = api.trades.list.path;
  if (filters) {
    const params = new URLSearchParams();
    if (filters.type) params.append("type", filters.type);
    if (filters.status) params.append("status", filters.status);
    if (params.toString()) url += `?${params.toString()}`;
  }

  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch trades');
      return api.trades.list.responses[200].parse(await res.json());
    },
  });
}

export function useTrade(id: number) {
  return useQuery({
    queryKey: [api.trades.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.trades.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch trade');
      return api.trades.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateTrade() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertTrade) => {
      const res = await fetch(api.trades.create.path, {
        method: api.trades.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.trades.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error('Failed to create trade');
      }
      return api.trades.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.trades.list.path] });
      toast({
        title: "Trade Logged",
        description: "Your trade has been successfully recorded.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateTrade() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertTrade>) => {
      const url = buildUrl(api.trades.update.path, { id });
      const res = await fetch(url, {
        method: api.trades.update.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.trades.update.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error('Failed to update trade');
      }
      return api.trades.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.trades.list.path] });
      toast({
        title: "Trade Updated",
        description: "Your changes have been saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteTrade() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.trades.delete.path, { id });
      const res = await fetch(url, { 
        method: api.trades.delete.method, 
        credentials: "include" 
      });
      
      if (!res.ok) throw new Error('Failed to delete trade');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.trades.list.path] });
      toast({
        title: "Trade Deleted",
        description: "The trade entry has been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
