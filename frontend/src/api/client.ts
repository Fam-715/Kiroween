import { getOrCreateListenerId } from "./listenerId";

export interface RuleViolation {
  rule: string;
  side: "A" | "B" | null;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  /** The `{rule, side, message}` list of a 422 response, or an empty list. */
  get violations(): RuleViolation[] {
    if (this.status !== 422 || typeof this.body !== "object" || this.body === null) return [];
    const detail = (this.body as { detail?: unknown }).detail;
    const list: unknown = Array.isArray(this.body) ? this.body : detail;
    if (!Array.isArray(list)) return [];
    return list.filter(
      (v): v is RuleViolation =>
        typeof v === "object" && v !== null && "rule" in v && "message" in v,
    );
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export function apiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";
  return raw.replace(/\/+$/, "");
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** Typed fetch helper. Sends `X-Listener-Id` on every call; throws `ApiError` on non-2xx. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "X-Listener-Id": getOrCreateListenerId(),
    Accept: "application/json",
  };
  const init: RequestInit = { method: options.method ?? "GET", headers, signal: options.signal };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(`${apiBaseUrl()}${path}`, init);
  const body = await parseBody(response);
  if (!response.ok) throw new ApiError(response.status, body);
  return body as T;
}
