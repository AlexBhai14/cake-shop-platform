import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { cartApi } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { CartView } from '../lib/types';

interface CartState {
  cart: CartView | null;
  count: number;
  refresh: () => Promise<void>;
  setCart: (cart: CartView | null) => void;
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartView | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setCart(null);
      return;
    }
    try {
      setCart(await cartApi.get());
    } catch {
      /* the cart page shows its own error */
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ cart, count: cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0, refresh, setCart }),
    [cart, refresh],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
