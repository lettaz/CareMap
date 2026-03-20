const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = { ...init?.headers as Record<string, string> };
  if (init?.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...init, headers });

  if (res.status === 204) return undefined as T;

  const body = await res.json();

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error ?? "UNKNOWN",
      body?.message ?? res.statusText,
    );
  }

  return body as T;
}

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
