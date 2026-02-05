import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertUser } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const BACKEND_URL = "https://allen-data-hub-backend.onrender.com";

// Access token stored in memory and sessionStorage (survives reloads during a session)
let accessToken: string | null = null;

try {
  if (typeof window !== "undefined") {
    accessToken = sessionStorage.getItem("access_token");
  }
} catch (e) {
  accessToken = null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  try {
    if (typeof window !== "undefined") {
      if (token) sessionStorage.setItem("access_token", token);
      else sessionStorage.removeItem("access_token");
    }
  } catch (e) {
    // ignore storage errors
  }
}

// Helper for type-safe logging
function logError(label: string, error: unknown) {
  console.error(`[Auth Hook] ${label} error:`, error);
}

// Helper to get auth headers
function getAuthHeaders(): HeadersInit {
  const token = getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

// Fetch current user (using JWT from Authorization header)
export function useUser() {
  return useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      let token = getAccessToken();

      // If no access token in memory/session, attempt refresh using cookie
      if (!token) {
        try {
          const refreshRes = await fetch(`${BACKEND_URL}/api/refresh`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });
          if (refreshRes.ok) {
            const { accessToken: newToken } = await refreshRes.json();
            setAccessToken(newToken);
            token = newToken;
          }
        } catch (e) {
          console.error("Token refresh failed", e);
        }
      }

      if (!token) return null;

      const res = await fetch(`${BACKEND_URL}${api.auth.me.path}`, {
        credentials: "include", // for refresh token cookie
        headers: getAuthHeaders(),
      });

      if (res.status === 401) {
        // Try to refresh token and retry once
        try {
          const refreshRes = await fetch(`${BACKEND_URL}/api/refresh`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });
          if (refreshRes.ok) {
            const { accessToken: newToken } = await refreshRes.json();
            setAccessToken(newToken);
            const retryRes = await fetch(`${BACKEND_URL}${api.auth.me.path}`, {
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${newToken}`,
              },
            });
            if (!retryRes.ok) return null;
            const data = await retryRes.json();
            const users = Array.isArray(data) ? data : [data];
            return users[0] || null;
          }
        } catch (e) {
          console.error("Token refresh failed", e);
        }
        return null;
      }

      if (!res.ok) throw new Error("Failed to fetch user");
      const data = await res.json();
      const users = Array.isArray(data) ? data : [data];
      return users[0] || null;
    },
    retry: false,
    staleTime: 0,
  });
}

// Login Mutation
export function useLogin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async (credentials: { identifier: string; password: string }) => {
      const res = await fetch(`${BACKEND_URL}${api.auth.login.path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Invalid username or password");
        throw new Error("Login failed");
      }

      const response = await res.json();
      // Extract accessToken from response and store it in memory
      if (response.accessToken) {
        setAccessToken(response.accessToken);
      }
      // Parse and return the response object which has { user, accessToken }
      const parsed = api.auth.login.responses[200].parse(response);
      return parsed;
    },
    onSuccess: (data: any) => {
      const user = data.user;
      const userId = (user as any).id || (user as any)._id?.toString();
      queryClient.setQueryData([api.auth.me.path], user);
      toast({ title: "Welcome back!", description: `Logged in as ${user.username}` });
      
      // Clear old local cart for this user to prevent old items from reappearing
      try {
        const cartKey = userId ? `cart_${userId}` : 'cart_guest';
        localStorage.removeItem(cartKey);
      } catch (e) {
        // ignore cleanup errors
      }
      
      // If there was a pending cart saved before login, push it to server
      (async () => {
        try {
          const pending = localStorage.getItem("pendingCart");
          if (pending) {
            const items = JSON.parse(pending) as Array<{ productId: string; quantity?: number; phoneNumber?: string }>;
            for (const it of items) {
              await fetch(`${BACKEND_URL}/api/cart/add`, {
                method: "POST",
                credentials: "include",
                headers: getAuthHeaders(),
                body: JSON.stringify(it),
              });
            }
            localStorage.removeItem("pendingCart");
            queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
          }
        } catch (e) {
          console.error("Failed to push pending cart after login", e);
        }
      })();
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    },
  });
}

// Register Mutation
export function useRegister() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async (data: InsertUser) => {
      const res = await fetch(`${BACKEND_URL}${api.auth.register.path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = await res.json();
          throw new Error(error.message || "Registration failed");
        }
        throw new Error("Registration failed");
      }

      const response = await res.json();
      // Extract accessToken from response and store it in memory
      if (response.accessToken) {
        setAccessToken(response.accessToken);
      }
      // Parse and return the response object which has { user, accessToken }
      const parsed = api.auth.register.responses[201].parse(response);
      return parsed;
    },
    onSuccess: (data: any) => {
      const user = data.user;
      queryClient.setQueryData([api.auth.me.path], user);
      toast({ title: "Account created", description: "Welcome to AllenDataHub!" });
      setLocation("/");
    },
    onError: (error: Error) => {
      logError("Register", error);
      toast({ title: "Registration Failed", description: error.message, variant: "destructive" });
    },
  });
}

// Logout Mutation
export function useLogout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BACKEND_URL}${api.auth.logout.path}`, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Logout failed");
      // Clear access token
      setAccessToken(null);
    },
    onSuccess: () => {
      setAccessToken(null);
      queryClient.setQueryData([api.auth.me.path], null);
      queryClient.removeQueries({ queryKey: ["/api/cart"] });
      queryClient.removeQueries({ queryKey: [api.orders.listMyOrders.path] });
      toast({ title: "Logged out", description: "See you next time!" });
      setLocation("/auth");
    },
  });
}
