import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertOrder } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-auth";

const BACKEND_URL = "https://allen-data-hub-backend.onrender.com";

function getUserId(user: any): string | null {
  if (!user) return null;
  return (user as any).id ?? (user as any)._id?.toString() ?? null;
}

// Fetch current user's orders (10 per page for user/agent)
export function useMyOrders(page = 1, limit = 10) {
  const { data: user } = useUser();
  const userId = getUserId(user);
  return useQuery({
    queryKey: [api.orders.listMyOrders.path, userId ?? "anonymous", page, limit],
    queryFn: async () => {
      const { fetchWithAuth } = await import("@/lib/fetchWithAuth");
      const res = await fetchWithAuth(`${api.orders.listMyOrders.path}?page=${page}&limit=${limit}`);
      if (res.status === 401) return { orders: [], pagination: { total: 0, page: 1, limit, pages: 0 } };
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();
      return data.orders ? data : { orders: Array.isArray(data) ? data : [], pagination: data.pagination || { total: 0, page: 1, limit, pages: 0 }, completedCount: data.completedCount ?? 0 };
    },
    enabled: !!userId,
  });
}

// Create Order (Buy Data)
export function useCreateOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertOrder) => {
      const res = await fetch(`${BACKEND_URL}${api.orders.create.path}`, {
        method: "POST",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        if (res.status === 400) {
           const error = await res.json();
           throw new Error(error.message);
        }
        throw new Error("Failed to place order");
      }
      return api.orders.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      // Invalidate both user orders and admin orders
      queryClient.invalidateQueries({ queryKey: [api.orders.listMyOrders.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({ title: "Order Placed!", description: "Your data bundle is on the way." });
    },
    onError: (error: Error) => {
      toast({ title: "Order Failed", description: error.message, variant: "destructive" });
    },
  });
}

// Pay for order (wallet or Paystack init)
export function usePayForOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ productId, useWallet }: { productId: string; useWallet?: boolean }) => {
      const { fetchWithAuth } = await import('@/lib/fetchWithAuth');
      const res = await fetchWithAuth('/api/orders/pay', {
        method: 'POST',
        body: JSON.stringify({ productId, useWallet }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to initiate payment' }));
        throw new Error(err.message || 'Failed to initiate payment');
      }
      return res.json();
    },
    onSuccess: () => {
      // Invalidate both user orders and admin orders
      queryClient.invalidateQueries({ queryKey: [api.orders.listMyOrders.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      // If the payment initialization returned a Paystack url, redirect
      (async () => {
        try {
          const last = queryClient.getQueryData(['/api/orders/pay']);
          // Not reliable to read cache here; payment redirects are handled by callers that await the mutation result.
        } catch (e) {
          // ignore
        }
      })();
    },
    onError: (error: Error) => {
      toast({ title: "Payment Failed", description: error.message, variant: "destructive" });
    },
  });
}
