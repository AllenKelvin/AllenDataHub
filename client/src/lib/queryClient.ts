 // queryClient.ts
import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Replace this with your actual Render Backend URL
const API_BASE_URL = "https://allen-data-hub-backend.onrender.com"; 

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Prepend the Render URL if it's an API call
  const fullUrl = url.startsWith("/api") ? `${API_BASE_URL}${url}` : url;

  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // CRITICAL: Sends the cookie to Render
  });

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  return res;
}

export const getQueryFn: <T>(options: { on401: "returnNull" | "throw" }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const path = queryKey.join("/");
    const fullUrl = path.startsWith("api") ? `${API_BASE_URL}/${path}` : `/${path}`;

    const res = await fetch(fullUrl, {
      credentials: "include", // CRITICAL
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
    return await res.json();
  };

export const queryClient = new QueryClient({ /* ... existing options ... */ });