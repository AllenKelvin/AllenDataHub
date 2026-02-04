import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

const BACKEND_URL = "https://allen-data-hub-backend.onrender.com";

// List Unverified Agents
export function useUnverifiedAgents() {
  return useQuery({
    queryKey: [api.users.listUnverifiedAgents.path],
    queryFn: async () => {
      const { fetchWithAuth } = await import("@/lib/fetchWithAuth");
      const res = await fetchWithAuth(api.users.listUnverifiedAgents.path);
      if (!res.ok) throw new Error("Failed to fetch unverified agents");
      return api.users.listUnverifiedAgents.responses[200].parse(await res.json());
    },
  });
}

// Verify Agent
export function useVerifyAgent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const url = buildUrl(api.users.verifyAgent.path, { id });
      const { fetchWithAuth } = await import("@/lib/fetchWithAuth");
      const res = await fetchWithAuth(url, { method: "PATCH" });

      if (!res.ok) throw new Error("Failed to verify agent");
      return api.users.verifyAgent.responses[200].parse(await res.json());
    },
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: [api.users.listUnverifiedAgents.path] });
      toast({ title: "Agent Verified", description: `${user.username} can now access the dashboard.` });
    },
    onError: (error: Error) => {
      toast({ title: "Verification Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useAgents() {
  return useQuery({
    queryKey: ["/api/users/agents"],
    queryFn: async () => {
      const { fetchWithAuth } = await import("@/lib/fetchWithAuth");
      const res = await fetchWithAuth('/api/users/agents');
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json();
    },
  });
}

export function useCreditAgent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const { fetchWithAuth } = await import("@/lib/fetchWithAuth");
      const res = await fetchWithAuth(`/api/admin/wallet/${id}/load`, { method: "POST", body: JSON.stringify({ amount }) });
      if (!res.ok) throw new Error("Failed to credit agent");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/agents"] });
      toast({ title: "Wallet Updated", description: "Agent wallet credited" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useAdminTotals() {
  return useQuery({
    queryKey: ["/api/admin/totals"],
    queryFn: async () => {
      const { fetchWithAuth } = await import("@/lib/fetchWithAuth");
      const res = await fetchWithAuth('/api/admin/totals');
      if (!res.ok) throw new Error("Failed to fetch totals");
      return res.json();
    },
  });
}

export function useAdminAllOrders(page = 1, limit = 50) {
  return useQuery({
    queryKey: ["/api/admin/orders", page, limit],
    queryFn: async () => {
      const { fetchWithAuth } = await import("@/lib/fetchWithAuth");
      const res = await fetchWithAuth(`/api/admin/orders?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();
      return { ...data, pagination: data.pagination || { total: 0, page: 1, limit, pages: 0 } };
    },
  });
}
