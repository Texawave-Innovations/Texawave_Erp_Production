import type { ApiEnvelope, ApiErrorBody } from "@texawave-erp/api-types";
import { ApiError } from "./api-error";

export interface ApiClientConfig {
  baseUrl: string;
  /** Read fresh on every request — never cache the token in the client
   * itself, since the UI may rotate it between calls (refresh, logout). */
  getAccessToken: () => string | null;
  /** Called once per request that comes back 401. What happens next (retry
   * after a silent refresh, redirect to login, ...) is a UI concern — this
   * layer stays framework-agnostic and just reports the fact
   * (Docs/CODING_STANDARDS.md "Frontend API/state/error standard"). */
  onUnauthorized?: () => void;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  // A plain `object` rather than `Record<string, ...>` on purpose — the
  // latter requires an explicit index signature to structurally match,
  // which would force every feature's query-filter DTO (from
  // packages/api-types) to redundantly declare one just to be passable
  // here. Values are stringified at the point of use below regardless.
  query?: object;
  body?: unknown;
  signal?: AbortSignal;
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: RequestOptions["query"],
): string {
  const url = new URL(
    path.replace(/^\//, ""),
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
  );
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * The single place that knows how to talk to the API: builds the request,
 * attaches the bearer token, and normalizes every outcome — success,
 * business error, or network failure — into one shape. Every feature's
 * `api.ts` calls this instead of `fetch` directly
 * (Docs/CODING_STANDARDS.md "Frontend API/state/error standard").
 */
export class ApiClient {
  constructor(private readonly config: ApiClientConfig) {}

  /** Returns the full envelope — including `meta` for paginated endpoints.
   * Callers decide whether they need `.data` alone or the pagination info
   * too; this layer never silently drops it. */
  async request<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<ApiEnvelope<T>> {
    const url = buildUrl(this.config.baseUrl, path, options.query);
    const token = this.config.getAccessToken();

    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(options.body !== undefined
          ? { body: JSON.stringify(options.body) }
          : {}),
        ...(options.signal ? { signal: options.signal } : {}),
      });
    } catch (cause) {
      throw ApiError.networkError(cause);
    }

    if (response.status === 401) {
      this.config.onUnauthorized?.();
    }

    if (response.status === 204) {
      return { data: undefined as T };
    }

    const json: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const body = (json ?? {
        statusCode: response.status,
        message: response.statusText,
        error: "UNKNOWN_ERROR",
        path,
        timestamp: new Date().toISOString(),
      }) as ApiErrorBody;
      throw new ApiError(body);
    }

    return json as ApiEnvelope<T>;
  }

  async get<T>(
    path: string,
    options?: Omit<RequestOptions, "method" | "body">,
  ): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  async post<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method" | "body">,
  ): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, { ...options, method: "POST", body });
  }

  async patch<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method" | "body">,
  ): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, { ...options, method: "PATCH", body });
  }

  /** For a full-replace endpoint (e.g. "set this role's granted permission
   * set to exactly this list") — distinct from `patch`, which is a partial
   * update. */
  async put<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method" | "body">,
  ): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, { ...options, method: "PUT", body });
  }

  async delete<T>(
    path: string,
    options?: Omit<RequestOptions, "method" | "body">,
  ): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}
