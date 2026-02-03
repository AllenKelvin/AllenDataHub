import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useUser } from '@/hooks/use-auth';

export interface CartItem {
  id: string;
  productId: string;
  dataAmount: string;
  name: string;
  network: string;
  price: number;
  phoneNumber: string;
  quantity: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, 'id'>) => string;
  removeFromCart: (productId: string) => void;
  removeLocalById: (id: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { data: user } = useUser();
  const isFirstSaveRef = useRef(true);
  const prevUserIdRef = useRef<string | null>(null);

  // Determine current user ID and cart key
  const userId = user ? ((user as any).id || (user as any)._id?.toString()) : null;
  const cartKey = userId ? `cart_${userId}` : 'cart_guest';

  // Rule 1: LAZY INITIALIZATION — read from localStorage in the initializer function
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(cartKey);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch (e) {
      console.warn('Failed to load cart from localStorage', e);
      return [];
    }
  });

  // Rule 4: SYNC WITH AUTH — reload cart when user changes
  useEffect(() => {
    const prev = prevUserIdRef.current;
    const currentUserId = userId || 'guest';
    
    // Only reload if user has actually changed
    if (prev === currentUserId) return;
    
    try {
      // Always clear cart first to prevent data leakage
      setCartItems([]);
      isFirstSaveRef.current = true;
      
      // Load the cart for the current user/guest
      const raw = localStorage.getItem(cartKey);
      setCartItems(raw ? (JSON.parse(raw) as CartItem[]) : []);

      // If transitioning from guest to authenticated user, clean up guest cart to prevent leakage
      if (prev === 'guest' && userId) {
        try {
          localStorage.removeItem('cart_guest');
        } catch (e) {
          // ignore
        }
      }
      
      // If transitioning from one user to another, clean up their cart from localStorage
      if (prev && prev !== 'guest' && userId && prev !== userId) {
        try {
          localStorage.removeItem(`cart_${prev}`);
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      console.warn('Failed to reload cart on user change', e);
      setCartItems([]);
    }

    prevUserIdRef.current = currentUserId;
    // After loading cart for this user, allow persistence on next save
    isFirstSaveRef.current = false;
  }, [cartKey, userId]);

  // Rule 3: PREVENT OVERWRITES — guard against saving empty state on first load
  useEffect(() => {
    if (isFirstSaveRef.current) return;
    
    try {
      localStorage.setItem(cartKey, JSON.stringify(cartItems));
    } catch (e) {
      console.warn('Failed to persist cart to localStorage', e);
    }
  }, [cartItems, cartKey]);

  // Functional update pattern: setCart(prev => [...prev, newItem])
  const addToCart = useCallback((item: Omit<CartItem, 'id'>) => {
    const id = `${item.productId}-${item.phoneNumber}-${Date.now()}`;
    
    setCartItems((prevItems) => {
      // Check if item with same productId and phoneNumber already exists
      const existingIndex = prevItems.findIndex(
        (i) => i.productId === item.productId && i.phoneNumber === item.phoneNumber
      );

      if (existingIndex > -1) {
        // Update quantity if exists
        const updated = [...prevItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: (updated[existingIndex].quantity || 1) + (item.quantity || 1),
        };
        return updated;
      }

      // Add new item
      return [
        ...prevItems,
        {
          ...item,
          id,
        } as CartItem,
      ];
    });

    return id;
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.productId !== productId));
  }, []);

  const removeLocalById = useCallback((id: string) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        removeLocalById,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCartContext() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCartContext must be used within CartProvider');
  }
  return context;
}
