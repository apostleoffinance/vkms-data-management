import { clearAccessToken, getAccessToken } from "@/lib/auth-token";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function buildAuthHeaders(includeJson = true): HeadersInit {
  const headers: Record<string, string> = {};
  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      clearAccessToken();
    }
    const data = await response.json().catch(() => ({ detail: "Request failed" }));
    const message = typeof data.detail === "string" ? data.detail : "Request failed";
    if (response.status === 403 && message.includes("Password change required")) {
      if (typeof window !== "undefined" && window.location.pathname !== "/change-password") {
        window.location.href = "/change-password";
      }
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return {} as T;
  return response.json();
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: buildAuthHeaders(),
  });
  return handleResponse<T>(response);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: buildAuthHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(response);
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    credentials: "include",
    headers: buildAuthHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    credentials: "include",
    headers: buildAuthHeaders(),
  });
  return handleResponse<T>(response);
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: buildAuthHeaders(false),
    body: formData,
  });
  return handleResponse<T>(response);
}

export async function apiDownload(path: string, filename: string): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: buildAuthHeaders(false),
  });
  if (!response.ok) {
    await handleResponse(response);
    return;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function getExportUrl(params: Record<string, string>): string {
  const search = new URLSearchParams(params).toString();
  return `${API_BASE}/api/v1/reports/export?${search}`;
}
