import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem } from "./types";

interface CartContextType {
  items: CartItem[];
  count: number;
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId?: string;
}) {
  const storageKey = userId ? `cart_${userId}` : "cart_guest";
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setItems(raw ? (JSON.parse(raw) as CartItem[]) : []);
    } catch {
      setItems([]);
    }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, storageKey]);

  const value = useMemo<CartContextType>(
    () => ({
      items,
      count: items.length,
      addItem: (item) => {
        setItems((prev) => [
          ...prev,
          { ...item, id: `cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` },
        ]);
      },
      removeItem: (id) => setItems((prev) => prev.filter((i) => i.id !== id)),
      clear: () => setItems([]),
    }),
    [items]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
