import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-auth";
import { api } from "@shared/routes";

const BACKEND_URL = "https://allen-data-hub-backend.onrender.com";

function getUserId(user: any): string | null {
  if (!user) return null;
  return (user as any).id ?? (user as any)._id?.toString() ?? null;
}

export function useCart() {
  const { data: user } = useUser();
  const userId = getUserId(user);
  return useQuery({
    queryKey: ["/api/cart", userId ?? "anonymous"],
    queryFn: async () => {
      const { fetchWithAuth } = await import("@/lib/fetchWithAuth");
      const res = await fetchWithAuth("/api/cart");
      if (res.status === 401) {
        const pending = JSON.parse(localStorage.getItem('pendingCart') || '[]') as Array<{ productId: string; quantity?: number }>;
        if (pending.length === 0) return [];
        const prodRes = await fetchWithAuth('/api/products');
        if (!prodRes.ok) return [];
        const products = await prodRes.json();
        return pending.map((it) => ({ product: products.find((p: any) => (p.id || p._id?.toString()) === it.productId) || null, quantity: it.quantity || 1 })).filter((i: any) => i.product);
      }
      if (!res.ok) throw new Error('Failed to fetch cart');
      return res.json();
    },
    enabled: true,
  });
}

export function useAddToCart() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ productId, quantity = 1, phoneNumber }: { productId: string; quantity?: number; phoneNumber?: string }) => {
      const { fetchWithAuth } = await import('@/lib/fetchWithAuth');
      const res = await fetchWithAuth('/api/cart/add', { method: 'POST', body: JSON.stringify({ productId, quantity, phoneNumber }) });
      if (res.status === 401) {
        const pending = JSON.parse(localStorage.getItem('pendingCart') || '[]');
        pending.push({ productId, quantity });
        localStorage.setItem('pendingCart', JSON.stringify(pending));
        return pending;
      }
      if (!res.ok) throw new Error('Failed to add to cart');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/cart'] });
      toast({ title: 'Added', description: 'Product added to cart' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.message || 'Failed to add to cart', variant: 'destructive' });
    }
  });
}

export function useRemoveFromCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId }: { productId: string }) => {
      const { fetchWithAuth } = await import('@/lib/fetchWithAuth');
      const res = await fetchWithAuth('/api/cart/remove', { method: 'POST', body: JSON.stringify({ productId }) });
      if (!res.ok) throw new Error('Failed to remove from cart');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/cart'] }),
  });
}

export function useCheckout() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ paymentMethod = 'paystack' }: { paymentMethod?: 'wallet' | 'paystack' }) => {
      const { fetchWithAuth } = await import('@/lib/fetchWithAuth');
      const res = await fetchWithAuth('/api/cart/checkout', { method: 'POST', body: JSON.stringify({ paymentMethod }) });
      if (!res.ok) {
        const err = await res.json();
        // eslint-disable-next-line no-console
        console.error('[checkout] HTTP error:', res.status, err);
        throw new Error(err.message || 'Checkout failed');
      }
      const data = await res.json();
      // eslint-disable-next-line no-console
      console.log('[checkout] success response:', data);
      return data;
    },
    onSuccess: (data) => {
      // Helpful debug logging
      // eslint-disable-next-line no-console
      console.log('[useCheckout] onSuccess data:', data);
      qc.invalidateQueries({ queryKey: ['/api/cart'] });
      qc.invalidateQueries({ queryKey: [api.orders.listMyOrders.path] });
      qc.invalidateQueries({ queryKey: ['/api/user'] });
      qc.refetchQueries({ queryKey: ['/api/user'] });
      if (data.data?.authorization_url) {
        const url = data.data.authorization_url;
        toast({ title: 'Redirecting', description: 'Redirecting to Paystack...', variant: 'default' });
        setTimeout(() => {
          try {
            // Try navigate in current tab first
            window.location.assign(url);
          } catch (e) {
            // Fallback to opening new tab
            window.open(url, '_blank');
          }
        }, 200);
      } else if (data.authorization_url) {
        const url = data.authorization_url;
        toast({ title: 'Redirecting', description: 'Redirecting to Paystack...', variant: 'default' });
        setTimeout(() => {
          try {
            window.location.assign(url);
          } catch (e) {
            window.open(url, '_blank');
          }
        }, 200);
      } else if (data.status === 'ok') {
        toast({ title: 'Success', description: 'Order completed successfully' });
      } else {
        // eslint-disable-next-line no-console
        console.warn('[useCheckout] response has no authorization_url or status ok:', data);
        toast({ title: 'Checkout', description: 'Proceeding with payment', variant: 'default' });
      }
    },
    onError: (err: any) => {
      // eslint-disable-next-line no-console
      console.error('[useCheckout] error:', err);
      toast({ title: 'Error', description: err?.message || 'Checkout failed', variant: 'destructive' });
    }
  });
}

export default useCart;
