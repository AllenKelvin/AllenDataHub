import { getAccessToken, setAccessToken } from "@/hooks/use-auth";

const BACKEND_URL = "https://allen-data-hub-backend.onrender.com";

async function tryRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.accessToken) {
      setAccessToken(data.accessToken);
      return data.accessToken;
    }
    return null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[fetchWithAuth] tryRefresh failed', e);
    return null;
  }
}

export async function fetchWithAuth(input: RequestInfo, init: RequestInit = {}) {
  const token = getAccessToken();
  const mergedHeaders: Record<string, string> = {
    ...(init.headers as Record<string, string> || {}),
    "Content-Type": (init.headers as Record<string,string>)?.["Content-Type"] || "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // eslint-disable-next-line no-console
  console.log('[fetchWithAuth] request to', typeof input === "string" && input.startsWith("/api") ? `${BACKEND_URL}${input}` : input, 'with token?', !!token);
  const res = await fetch(typeof input === "string" && input.startsWith("/api") ? `${BACKEND_URL}${input}` : input, {
    ...init,
    headers: mergedHeaders,
    credentials: "include",
  });

  if (res.status === 401) {
    // eslint-disable-next-line no-console
    console.warn('[fetchWithAuth] received 401, attempting refresh');
    const newToken = await tryRefresh();
    if (newToken) {
      const retryHeaders = {
        ...(init.headers as Record<string, string> || {}),
        "Content-Type": (init.headers as Record<string,string>)?.["Content-Type"] || "application/json",
        Authorization: `Bearer ${newToken}`,
      };
      // eslint-disable-next-line no-console
      console.log('[fetchWithAuth] retrying request with new token');
      return fetch(typeof input === "string" && input.startsWith("/api") ? `${BACKEND_URL}${input}` : input, {
        ...init,
        headers: retryHeaders,
        credentials: "include",
      });
    }
  }

  return res;
}

export default fetchWithAuth;
