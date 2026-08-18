export function getApiBase(): string {
  return (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://127.0.0.1:4000";
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
