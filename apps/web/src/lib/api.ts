export class ApiError extends Error {
  constructor(
    message: string,
    readonly code = "invalid_request",
    readonly status = 400,
  ) {
    super(message);
  }
}

export function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window === "undefined" ? null : localStorage.getItem("karaoke.token");
  const response = await fetch(`${apiBase()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.message === "string" ? data.message : "Yêu cầu thất bại.";
    throw new ApiError(message, data.code ?? "invalid_request", response.status);
  }
  return data as T;
}
