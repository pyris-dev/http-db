import { config } from "./index.js";
import type { QueryParams } from "./database/base.js";

/**
 * Checks if the request is authorized based on the provided auth key.
 * @param req - The incoming request
 * @param authKey - The expected authentication key
 * @returns True if authorized, false otherwise
 */
export function checkAuth(req: Request): boolean {
  // If auth is disabled, always allow
  if (config.AUTH_ENABLED == false) return true;

  const authKey = config.AUTH_KEY;
  if (!authKey)
    throw new Error(
      "Failed to check authentication: no auth key configured when authentication is enabled"
    );
  const provided = req.headers.get("authorization") || "";
  return provided === `Bearer ${authKey}`;
}

export function parseJsonBody<T>(
  req: Request,
  expectedJsonKeys?: string[]
): Promise<{ successful: boolean; data?: T; error?: string }> {
  return req
    .json()
    .then((body: T) => {
      if (expectedJsonKeys) {
        for (const key of expectedJsonKeys) {
          if (!(key in (body as any))) {
            return {
              successful: false,
              error: `Malformed Body: Missing expected JSON key: ${key}`
            };
          }
        }
      }
      return { successful: true, data: body };
    })
    .catch((error) => {
      return {
        successful: false,
        error: error.message || "Failed to parse JSON"
      };
    });
}

export function parseUrlParams(req: Request): Record<string, string> {
  const url = new URL(req.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export function textResponse(message: string, status = 200): Response {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export function parseQueryParams(req: Request): QueryParams {
  const params = new URL(req.url).searchParams;
  const query: QueryParams = {};

  for (const key of ["page", "pageSize", "limit"] as const) {
    const rawValue = params.get(key);
    if (!rawValue) {
      continue;
    }

    const parsedValue = Number.parseInt(rawValue, 10);
    if (Number.isFinite(parsedValue) && parsedValue > 0) {
      query[key] = parsedValue;
    }
  }

  return query;
}

export function normalizeRowBody(body: Record<string, unknown>): {
  id?: string;
  data: Record<string, unknown>;
} {
  const { id, ...data } = body;
  return {
    id: typeof id === "string" && id.trim() ? id.trim() : undefined,
    data
  };
}
