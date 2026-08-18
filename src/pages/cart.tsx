import { Link } from "wouter";
import { ShoppingCart, Trash2 } from "lucide-react";
import { EmptyState, PageHeader, WalletPill } from "@/components/ui-helpers";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { formatGHS } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";

export default function CartPage() {
  const { user, updateUser } = useAuth();
  const { items, removeItem, clear } = useCart();
  const { toast } = useToast();

  const total = items.reduce((sum, item) => sum + item.price, 0);

  const handleCheckout = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in before checking out.", variant: "destructive" });
      return;
    }

    try {
      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:4000";
      const response = await fetch(`${apiBase}/api/cart/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ items }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Checkout failed.");
      }

      clear();
      if (typeof payload.walletBalance === "number") {
        updateUser({ walletBalance: payload.walletBalance });
      }
      window.dispatchEvent(new CustomEvent("datahub:refresh"));
      toast({
        title: "Checkout complete",
        description: "Your cart has been cleared and the orders are now in your history.",
      });
    } catch (error) {
      toast({
        title: "Checkout failed",
        description: error instanceof Error ? error.message : "Unable to complete checkout.",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <PageHeader
        title="Shopping Cart"
        description="Review packages before checkout."
        icon={ShoppingCart}
        iconClassName="bg-violet-100 text-violet-600"
        actions={<WalletPill balance={user?.walletBalance ?? 0} />}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Browse MTN offers and add data packages to get started."
          action={
            <Link href="/user/mtn">
              <Button className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md hover:from-blue-700 hover:to-violet-700">
                Browse MTN Offers
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {item.network} · {item.packageName}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.size} → {item.recipient}
                  </p>
                  <p className="mt-2 text-lg font-bold text-violet-600">{formatGHS(item.price)}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove ${item.packageName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="h-fit rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-violet-700">Order Summary</h2>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <span>Items</span>
              <span className="font-semibold text-slate-800">{items.length}</span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="font-semibold text-slate-800">Total</span>
              <span className="text-2xl font-bold text-emerald-600">{formatGHS(total)}</span>
            </div>
            <Button
              type="button"
              onClick={handleCheckout}
              className="mt-5 h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md hover:from-blue-700 hover:to-violet-700"
            >
              Checkout
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="mt-2 w-full rounded-xl text-slate-500"
              onClick={() => clear()}
            >
              Clear cart
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
