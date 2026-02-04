import { QueryClient, QueryFunction } from "@tanstack/react-query";

// 1. Define your Render Backend URL here (No trailing slash)
const BACKEND_URL = "https://allen-data-hub-backend.onrender.com";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Enhanced apiRequest that prepends the Backend URL
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Ensure the URL points to Render if it starts with /api
  const fullUrl = url.startsWith("/") ? `${BACKEND_URL}${url}` : `${BACKEND_URL}/${url}`;

  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // Required to send/receive cookies across domains
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * Enhanced getQueryFn that prepends the Backend URL
 */
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Construct the path from the queryKey array
    const path = queryKey.join("/");
    const fullUrl = `${BACKEND_URL}/${path.startsWith("/") ? path.slice(1) : path}`;

    const res = await fetch(fullUrl, {
      credentials: "include", // Required for session persistence
    });

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