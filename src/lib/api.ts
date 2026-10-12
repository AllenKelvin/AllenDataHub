export function getApiBase(): string {
  const envBase =
    (typeof import.meta !== "undefined" && (import.meta.env?.VITE_API_URL || import.meta.env?.VITE_BACKEND_URL)) ||
    (typeof window !== "undefined" && (window as typeof window & { __APP_API_BASE__?: string }).__APP_API_BASE__) ||
    "https://allendatahub.onrender.com";

  return String(envBase).replace(/\/$/, "");
}

export function authHeaders(userId?: string | null, extra: Record<string, string> = {}): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  if (userId) headers["x-user-id"] = userId;
  return headers;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { userId?: string | null } = {}
): Promise<T> {
  const { userId, headers, ...rest } = options;
  const response = await fetch(`${getApiBase()}${path}`, {
    ...rest,
    headers: {
      ...authHeaders(userId, headers as Record<string, string>),
      ...(headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || "Request failed.");
  }
  return data as T;
}
