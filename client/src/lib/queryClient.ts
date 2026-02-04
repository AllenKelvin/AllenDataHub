import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { setAccessToken } from "@/hooks/use-auth";

const BACKEND_URL = "https://allen-data-hub-backend.onrender.com";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Import getAccessToken from auth hook
let getAccessTokenFn: (() => string | null) | null = null;

export function setGetAccessTokenFn(fn: () => string | null) {
  getAccessTokenFn = fn;
}

function getAuthHeaders(): HeadersInit {
  const token = getAccessTokenFn?.() || null;
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/**
 * Custom apiRequest that uses explicit BACKEND_URL with JWT auth
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Direct URL to backend (needed since Vercel doesn't proxy without vercel.json)
  const fullUrl = url.startsWith("/api") ? `${BACKEND_URL}${url}` : url;

  const res = await fetch(fullUrl, {
    method,
    headers: {
      ...getAuthHeaders(),
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    // Required to send cookies to a different domain (Render) - for refresh token
    credentials: "include", 
  });

  // If unauthorized, try refreshing the access token using the refresh cookie and retry once
  if (res.status === 401) {
    try {
      const refreshRes = await fetch(`${BACKEND_URL}/api/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (refreshRes.ok) {
        const { accessToken: newToken } = await refreshRes.json();
        if (newToken) setAccessToken(newToken);
        const retryRes = await fetch(fullUrl, {
          method,
          headers: {
            ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
            ...(data ? { "Content-Type": "application/json" } : {}),
          },
          body: data ? JSON.stringify(data) : undefined,
          credentials: "include",
        });
        await throwIfResNotOk(retryRes);
        return retryRes;
      }
    } catch (e) {
      // fall through to throwing original error
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * Custom getQueryFn that prepends the BACKEND_URL for data fetching with JWT auth
 */
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Construct the path with explicit BACKEND_URL
    const path = queryKey.join("/");
    const fullUrl = `${BACKEND_URL}/${path.startsWith("/") ? path.slice(1) : path}`;

    let res = await fetch(fullUrl, {
      // Add JWT Authorization header
      headers: getAuthHeaders(),
      // Required for refresh token cookie across domains
      credentials: "include",
    });

    // If unauthorized, try refresh once
    if (res.status === 401) {
      try {
        const refreshRes = await fetch(`${BACKEND_URL}/api/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (refreshRes.ok) {
          const { accessToken: newToken } = await refreshRes.json();
          if (newToken) setAccessToken(newToken);
          res = await fetch(fullUrl, {
            headers: {
              ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
              "Content-Type": "application/json",
            },
            credentials: "include",
          });
        }
      } catch (e) {
        // ignore and continue to handle res below
      }
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});