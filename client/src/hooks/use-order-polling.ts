import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@/hooks/use-auth";

const BACKEND_URL = "https://allen-data-hub-backend.onrender.com";

/**
 * Polls an order's status from the server every 5 seconds.
 * Useful for syncing order status when vendor updates orders via webhook.
 */
export function useOrderPolling(orderId: string | null | undefined, enabled = true) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!orderId || !enabled) return;

    const token = getAccessToken();
    if (!token) return; // No polling without auth

    const poll = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/orders/${orderId}`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
        });

        if (!res.ok) return;
        const order = await res.json();

        // Update query cache so the order details/list reflect the new status
        qc.setQueryData(["/api/orders", orderId], order);
        qc.invalidateQueries({ queryKey: ["/api/orders/mine"] });
      } catch (err) {
        console.error("Order polling error:", err);
      }
    };

    // Poll immediately, then every 5 seconds
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [orderId, enabled, qc]);
}
