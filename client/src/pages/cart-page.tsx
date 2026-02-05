import { useCart, useRemoveFromCart, useCheckout, useAddToCart } from '@/hooks/use-cart';
import { useUser } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useCartContext } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';

export default function CartPage() {
  const { data: cart, isLoading } = useCart();
  const { data: user } = useUser();
  const [, setLocation] = useLocation();
  const remove = useRemoveFromCart();
  const addToServer = useAddToCart();
  const checkout = useCheckout();
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'paystack'>('paystack');
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const { cartItems: localItems, removeFromCart: removeLocal, clearCart } = useCartContext();

  if (isLoading) return <div className="h-48 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary"/></div>;

  // Map local context items into the same shape as server cart entries so we can render them together
  const localMapped = (localItems || []).map((it: any) => ({
    product: { id: it.productId, dataAmount: it.dataAmount, name: it.name, network: it.network, agentPrice: it.price, userPrice: it.price },
    quantity: it.quantity || 1,
    __local: true,
    phoneNumber: it.phoneNumber,
    cartId: it.id,
  }));

  const merged = [...localMapped, ...(cart || [])];

  const priceFor = (p: any) => {
    if (!p) return 0;
    if (user?.role === 'agent' && (p.agentPrice != null)) return p.agentPrice;
    if (user?.role === 'user' && (p.userPrice != null)) return p.userPrice;
    return 0;
  };
  const total = merged.reduce((s: number, it: any) => s + (priceFor(it.product) * (it.quantity || 1)), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">My Cart</h1>
      <div className="bg-white rounded-xl p-6 border border-border">
        {merged && merged.length > 0 ? (
          <div className="space-y-4">
            {merged.map((it: any) => (
              <div key={it.__local ? it.cartId : it.product.id} className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{it.product?.dataAmount} - {it.product?.name}{it.product?.network ? ` (${it.product.network})` : ''}</div>
                  <div className="text-sm text-muted-foreground">GHS {Number(priceFor(it.product)).toFixed(2)} x {it.quantity}{it.phoneNumber ? ` • To: ${it.phoneNumber}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                    {it.__local ? (
                      <Button variant="ghost" onClick={() => removeLocal(it.cartId)}>Remove</Button>
                    ) : (
                      <Button variant="ghost" onClick={() => remove.mutate({ productId: it.product.id })}>Remove</Button>
                    )}
                </div>
              </div>
            ))}

            <div className="border-t pt-4 flex items-center justify-between">
              <div className="font-bold">Total</div>
              <div className="font-bold">GHS {Number(total).toFixed(2)}</div>
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                {user?.role === 'agent' && (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="payment" value="wallet" checked={paymentMethod === 'wallet'} onChange={() => setPaymentMethod('wallet')} />
                      <span className="text-sm">Pay with Wallet</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="payment" value="paystack" checked={paymentMethod === 'paystack'} onChange={() => setPaymentMethod('paystack')} />
                      <span className="text-sm">Pay with Paystack</span>
                    </label>
                  </div>
                )}
                {user?.role !== 'agent' && (
                  <span className="text-sm text-muted-foreground">Payment Method: Paystack</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  onClick={async () => {
                    // Clear server cart for authenticated users, always clear local cart
                    try {
                      if (user) {
                        const { fetchWithAuth } = await import('@/lib/fetchWithAuth');
                        const resp = await fetchWithAuth('/api/cart/clear', { method: 'POST' });
                        if (!resp.ok) {
                          // ignore server clear failure but notify
                          // eslint-disable-next-line no-console
                          console.warn('Server clear cart failed');
                        }
                        // Invalidate server cart query
                      }
                    } catch (e) {
                      console.error('Failed to clear server cart', e);
                    }
                    clearCart();
                  }}
                  disabled={merged.length === 0}
                >
                  Clear Cart
                </Button>
                <Button 
                  onClick={async () => {
                    // Require authentication before checkout
                    if (!user) {
                      toast({ title: 'Login required', description: 'Please log in to checkout', variant: 'default' });
                      setLocation('/auth');
                      return;
                    }

                    // Sync local items to server silently before checkout
                    if (localItems.length > 0) {
                      setIsSyncing(true);
                      try {
                        const { fetchWithAuth } = await import('@/lib/fetchWithAuth');
                        for (const item of localItems) {
                          const res = await fetchWithAuth('/api/cart/add', { 
                            method: 'POST', 
                            body: JSON.stringify({ productId: item.productId, quantity: item.quantity || 1, phoneNumber: item.phoneNumber }) 
                          });
                          if (!res.ok) throw new Error('Failed to sync cart item');
                        }
                        // Clear local cart after syncing
                        clearCart();
                        // Wait a moment for server to persist items
                        await new Promise(r => setTimeout(r, 500));
                      } catch (err) {
                        toast({ title: 'Sync Error', description: 'Failed to sync cart items to server', variant: 'destructive' });
                        setIsSyncing(false);
                        return;
                      }
                      setIsSyncing(false);
                    }

                    checkout.mutate({ paymentMethod });
                  }}
                  disabled={isSyncing || checkout.isLoading || merged.length === 0}
                >
                  {isSyncing || checkout.isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : (user?.role === 'agent' ? `Pay with ${paymentMethod === 'wallet' ? 'Wallet' : 'Paystack'}` : 'Pay with Paystack')}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground">Your cart is empty.</div>
        )}
      </div>
    </div>
  );
}
