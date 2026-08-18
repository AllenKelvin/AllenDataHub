import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "./types";
import { apiFetch, authHeaders, getApiBase } from "./api";

interface AuthContextType {
  user: User | null;
  users: User[];
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string; userRole?: "user" | "agent" | "admin" }>;
  register: (payload: {
    fullName: string;
    email: string;
    username?: string;
    phone: string;
    password: string;
    role: "user" | "agent" | "admin";
    referredBy?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  verifyEmail: (token: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => Promise<void>;
  updateUserById: (id: string, patch: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
  debitWallet: (amount: number) => boolean;
  creditWallet: (amount: number) => boolean;
  applyReferralCommission: (referrerCode: string, amount: number) => void;
  getAllUsers: () => User[];
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEY = "allendatahub-auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const commitUser = (nextUser: User | null) => {
    setUser(nextUser);
    if (nextUser) {
      localStorage.setItem(STORAGE_KEY, nextUser.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const refreshUser = async () => {
    const savedUserId = localStorage.getItem(STORAGE_KEY);
    if (!savedUserId) return;
    try {
      const data = await apiFetch<{ user: User }>("/api/users/me", { userId: savedUserId });
      if (data.user) {
        commitUser(data.user);
        if (data.user.role === "admin") {
          const allUsers = await apiFetch<{ users: User[] }>("/api/users", { userId: data.user.id });
          setUsers(allUsers.users ?? [data.user]);
        } else {
          setUsers((existing) =>
            existing.some((u) => u.id === data.user.id)
              ? existing.map((u) => (u.id === data.user.id ? data.user : u))
              : [...existing, data.user]
          );
        }
      }
    } catch {
      commitUser(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      const savedUserId = localStorage.getItem(STORAGE_KEY);
      if (savedUserId) {
        try {
          const data = await apiFetch<{ user: User }>("/api/users/me", { userId: savedUserId });
          if (mounted && data.user) {
            commitUser(data.user);
            if (data.user.role === "admin") {
              const allUsers = await apiFetch<{ users: User[] }>("/api/users", { userId: data.user.id });
              setUsers(allUsers.users ?? [data.user]);
            } else {
              setUsers([data.user]);
            }
          }
        } catch {
          if (mounted) commitUser(null);
        }
      }
      if (mounted) setIsLoading(false);
    }

    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      users,
      isLoading,
      isAuthenticated: !!user,
      refreshUser,
      login: async (identifier, password) => {
        if (!identifier || !password) {
          return { ok: false, error: "Email/username and password are required." };
        }

        try {
          const response = await fetch(`${getApiBase()}/api/auth/login`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ identifier, password }),
          });

          if (response.ok) {
            const data = await response.json();
            const userRecord = data.user as User;
            commitUser(userRecord);
            if (userRecord.role === "admin") {
              try {
                const allUsers = await apiFetch<{ users: User[] }>("/api/users", { userId: userRecord.id });
                setUsers(allUsers.users ?? [userRecord]);
              } catch {
                setUsers([userRecord]);
              }
            } else {
              setUsers([userRecord]);
            }
            return { ok: true, userRole: userRecord.role };
          }

          try {
            const errorData = await response.json();
            return { ok: false, error: errorData?.error || "Unable to log in right now." };
          } catch {
            return { ok: false, error: "Unable to log in right now." };
          }
        } catch (error) {
          return {
            ok: false,
            error:
              error instanceof Error && error.message
                ? `Server unavailable: ${error.message}`
                : "Server unavailable. Please check the MongoDB connection and try again.",
          };
        }
      },
      register: async ({ fullName, email, username, phone, password, role, referredBy }) => {
        if (!fullName || !email || !phone || !password) {
          return { ok: false, error: "Please complete all required fields." };
        }
        if (password.length < 4) {
          return { ok: false, error: "Password must be at least 4 characters." };
        }

        try {
          const response = await fetch(`${getApiBase()}/api/auth/register`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ fullName, email, username, phone, password, role, referredBy }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.user) {
              commitUser(data.user);
              setUsers([data.user]);
            }
            return { ok: true };
          }

          try {
            const errorData = await response.json();
            return { ok: false, error: errorData?.error || "Unable to register right now." };
          } catch {
            return { ok: false, error: "Unable to register right now." };
          }
        } catch (error) {
          return {
            ok: false,
            error:
              error instanceof Error && error.message
                ? `Server unavailable: ${error.message}`
                : "Server unavailable. Please check the MongoDB connection and try again.",
          };
        }
      },
      verifyEmail: async (token) => {
        if (!token) return { ok: false, error: "Verification token is missing." };
        try {
          await apiFetch("/api/auth/verify-email", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ token }),
          });
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : "Verification failed." };
        }
      },
      logout: () => {
        commitUser(null);
        setUsers([]);
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith("cart_")) localStorage.removeItem(key);
        });
      },
      updateUser: async (patch) => {
        if (!user) return;
        try {
          const data = await apiFetch<{ user: User }>(`/api/users/${user.id}`, {
            method: "PUT",
            userId: user.id,
            body: JSON.stringify(patch),
          });
          commitUser(data.user);
          setUsers((existing) => existing.map((item) => (item.id === user.id ? data.user : item)));
        } catch {
          const next = { ...user, ...patch };
          commitUser(next);
        }
      },
      updateUserById: async (id, patch) => {
        if (!user) return;
        try {
          const data = await apiFetch<{ user: User }>(`/api/users/${id}`, {
            method: "PUT",
            userId: user.id,
            body: JSON.stringify(patch),
          });
          setUsers((existing) => existing.map((item) => (item.id === id ? data.user : item)));
          if (user.id === id) commitUser(data.user);
        } catch {
          setUsers((existing) => existing.map((item) => (item.id === id ? { ...item, ...patch } : item)));
          if (user.id === id) commitUser({ ...user, ...patch });
        }
      },
      debitWallet: (amount) => {
        if (!user || user.walletBalance < amount) return false;
        const next = { ...user, walletBalance: Number((user.walletBalance - amount).toFixed(2)) };
        commitUser(next);
        return true;
      },
      creditWallet: (amount) => {
        if (!user) return false;
        const next = { ...user, walletBalance: Number((user.walletBalance + amount).toFixed(2)) };
        commitUser(next);
        return true;
      },
      applyReferralCommission: () => {},
      getAllUsers: () => users,
    }),
    [user, users, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
