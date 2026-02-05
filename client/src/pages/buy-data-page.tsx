import React, { useState } from "react";
import { useProducts } from "@/hooks/use-products";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useCartContext } from "@/context/CartContext";
import { NetworkCard } from "@/components/network-card";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BACKEND_URL = "https://allen-data-hub-backend.onrender.com";

export default function BuyDataPage() {
  const { data: products = [], isLoading } = useProducts();
  const { data: user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { addToCart: addToCartContext, removeLocalById } = useCartContext();

  // Helper function to get role-appropriate price
  const getPriceForUser = (product: any) => {
    if (!product) return 0;
    if (user?.role === 'agent' && product.agentPrice != null) return product.agentPrice;
    if (user?.role === 'user' && product.userPrice != null) return product.userPrice;
    return 0;
  };

  // Redirect unverified agents
  if (user && user.role === 'agent' && !user.isVerified) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Access Restricted</h1>
        <p className="text-muted-foreground">Your account is pending admin verification.</p>
        <p className="text-sm text-muted-foreground">You'll be able to browse and purchase data packages once verified.</p>
      </div>
    );
  }

  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  const networks = Array.from(new Set(products.map((p: any) => p.network))).filter(Boolean) as string[];
  const visibleNetworks = networks.filter((n) => n.toLowerCase() !== "vodafone");
  const filteredProducts = selectedNetwork
    ? products.filter((p: any) => p.network.toLowerCase() === selectedNetwork.toLowerCase())
    : [];

  // Returns true if added to server, false if saved as pending (unauthenticated)
  const addToCart = async (product: any, phoneNumber: string) => {
    try {
      const { fetchWithAuth } = await import('@/lib/fetchWithAuth');
      const res = await fetchWithAuth('/api/cart/add', { method: 'POST', body: JSON.stringify({ productId: product.id, quantity: 1, phoneNumber }) });
      if (res.status === 401) {
        const pending = JSON.parse(localStorage.getItem("pendingCart") || "[]");
        const existing = pending.find((p: any) => p.productId === product.id);
        if (existing) {
           existing.quantity = (existing.quantity || 1) + 1;
           existing.phoneNumber = phoneNumber;
        } else {
           pending.push({ productId: product.id, quantity: 1, phoneNumber });
        }
        localStorage.setItem("pendingCart", JSON.stringify(pending));
        return false;
      }
      if (!res.ok) throw new Error('Failed to add to cart');
      // Success - item is on server
      return true;
    } catch (err) {
      console.error("Add to cart failed", err);
      toast({ title: 'Error', description: 'Failed to add to cart', variant: 'destructive' });
      throw err;
    }
  };

  const handleConfirmAddToCart = async () => {
     if (!selectedProduct || phoneNumber.length !== 10 || !/^\d+$/.test(phoneNumber)) {
       toast({ title: 'Invalid Phone', description: 'Please enter exactly 10 digits', variant: 'destructive' });
       return;
     }

    setIsPaying(true);
    try {
      // First try to add to server
      const isAddedToServer = await addToCart(selectedProduct, phoneNumber);
      
      // Only add to local context for unauthenticated users
      // Authenticated users should see items from server cart via query
      if (!isAddedToServer) {
        const localId = addToCartContext({
          productId: selectedProduct.id,
          dataAmount: selectedProduct.dataAmount,
          name: selectedProduct.name,
          network: selectedNetwork || '',
          price: getPriceForUser(selectedProduct),
          phoneNumber: phoneNumber,
          quantity: 1,
        });
      } else {
        // Invalidate cart query so cart shows instantly (same key as useCart)
        qc.invalidateQueries({ queryKey: ['/api/cart'] });
      }

      // Close modal and show toast after successful add
      setSelectedProduct(null);
      setPhoneNumber("");
      toast({ title: 'Added to Cart', description: `${selectedProduct.dataAmount} added to cart` });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to add to cart', variant: 'destructive' });
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="text-center md:text-left">
        <h1 className="text-3xl font-display font-bold text-foreground">Purchase Data Bundle</h1>
        <p className="text-muted-foreground mt-2">Select a network to view available packages.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {visibleNetworks.map((network) => (
          <NetworkCard
            key={network}
            network={network}
            isSelected={selectedNetwork === network}
            onClick={() => {
              setSelectedNetwork(network);
              setSelectedProduct(null);
            }}
          />
        ))}
      </div>

      {selectedNetwork && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-xl font-bold font-display mb-4 flex items-center gap-2">
            Available {selectedNetwork} Bundles
            <span className="text-sm font-normal text-muted-foreground bg-gray-100 px-2 py-1 rounded-md">
              {filteredProducts.length} packages
            </span>
          </h2>

          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-xl border border-border p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => setSelectedProduct(product)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                        {product.dataAmount}
                      </h3>
                      <p className="text-sm text-muted-foreground">{product.name}</p>
                    </div>
                    <div className="bg-primary/5 text-primary font-bold px-3 py-1 rounded-full text-sm">GHS {Number(getPriceForUser(product)).toFixed(2)}</div>
                  </div>

                  <div className="text-xs text-muted-foreground line-clamp-2">{product.description}</div>

                  {/* Clicking the card opens the add-to-cart dialog — removed inline button */}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-12 bg-white rounded-xl border border-dashed border-gray-300">
              <p className="text-muted-foreground">No products available for this network yet.</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!selectedProduct} onOpenChange={(open) => {
        if (!open) {
          setSelectedProduct(null);
           setPhoneNumber("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Cart</DialogTitle>
            <DialogDescription>
               Enter your 10-digit phone number for <strong>{selectedProduct?.dataAmount}</strong> ({selectedNetwork})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center border border-border">
               <span className="text-sm font-medium">Price</span>
              <span className="text-xl font-bold text-primary">GHS {Number(getPriceForUser(selectedProduct)).toFixed(2)}</span>
            </div>

            <div className="space-y-2">
               <label className="text-sm font-medium">Phone Number (10 digits)</label>
               <input
                 type="text"
                 placeholder="0241234567"
                 value={phoneNumber}
                 onChange={(e) => {
                   const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                   setPhoneNumber(val);
                 }}
                 maxLength={10}
                 className="w-full px-4 py-2 border border-border rounded-lg text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
               />
               <p className="text-xs text-muted-foreground">Enter exactly 10 digits (e.g., 0241234567)</p>
            </div>

             <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
               <p className="text-xs text-blue-900">📞 Digits entered: <span className="font-bold">{phoneNumber.length}/10</span></p>
             </div>
            <div className="bg-primary/5 p-4 rounded-lg flex justify-between items-center border border-primary/20">
              <span className="text-sm font-medium">Total</span>
               <span className="text-xl font-bold text-primary">GHS {Number(getPriceForUser(selectedProduct)).toFixed(2)}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setSelectedProduct(null);
              setPhoneNumber("");
            }}>
              Cancel
            </Button>
            <Button onClick={handleConfirmAddToCart} disabled={isPaying || phoneNumber.length !== 10} className="bg-primary hover:bg-primary/90">
              {isPaying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
