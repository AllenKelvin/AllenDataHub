import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertUser } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const BACKEND_URL = "https://allen-data-hub-backend.onrender.com";

// Helper for type-safe logging
function logError(label: string, error: unknown) {
  console.error(`[Auth Hook] ${label} error:`, error);
}

// Fetch current user (session persists on refresh; credentials: include sends cookie)
export function useUser() {
  return useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}${api.auth.me.path}`, { credentials: 'include' });
      if (res.status === 401) return null;
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
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Invalid username or password");
        throw new Error("Login failed");
      }
      return api.auth.login.responses[200].parse(await res.json());
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
      toast({ title: "Welcome back!", description: `Logged in as ${user.username}` });
      // If there was a pending cart saved before login, push it to server
      (async () => {
        try {
          const pending = localStorage.getItem('pendingCart');
          if (pending) {
            const items = JSON.parse(pending) as Array<{ productId: string; quantity?: number }>;
            for (const it of items) {
              await fetch('/api/cart/add', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(it) });
            }
            localStorage.removeItem('pendingCart');
            queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
          }
        } catch (e) {
          console.error('Failed to push pending cart after login', e);
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
        credentials: 'include',
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
      return api.auth.register.responses[201].parse(await res.json());
    },
    onSuccess: (user) => {
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
      const res = await fetch(api.auth.logout.path, { method: "POST", credentials: 'include' });
      if (!res.ok) throw new Error("Logout failed");
    },
    onSuccess: () => {
      queryClient.setQueryData([api.auth.me.path], null);
      queryClient.removeQueries({ queryKey: ['/api/cart'] });
      queryClient.removeQueries({ queryKey: [api.orders.listMyOrders.path] });
      toast({ title: "Logged out", description: "See you next time!" });
      setLocation("/auth");
    },
  });
}
