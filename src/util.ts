import { config } from "./index.js";
import type { QueryParams } from "./database/base.js";
import { Logger } from "./logger.js";

const AuthRequestLogger = new Logger("AUTH_REQ");

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
  const authorized = provided === `Bearer ${authKey}`;
  if (!authorized)
    AuthRequestLogger.warn(
      `${req.method} ${new URL(req.url).pathname} unauthorized`
    );

  return authorized;
}

export function parseJsonBody<T>(
  req: Request,
  expectedJsonKeys?: string[]
): Promise<{ successful: boolean; data?: T; error?: string }> {
  return req
    .json()
    .then((body: unknown) => {
      // Ensure the parsed body is a plain object
      if (!isPlainObject(body))
        return {
          successful: false,
          error: "Malformed body: expected a JSON object"
        };

      // If no specific keys are expected, just return the parsed body
      if (!expectedJsonKeys) return { successful: true, data: body as T };

      // If specific keys are expected, check for their presence
      for (const key of expectedJsonKeys) {
        if (key in body) continue;
        return {
          successful: false,
          error: `Malformed Body: Missing expected JSON key: ${key}`
        };
      }

      // All expected keys are present, return the parsed body
      return { successful: true, data: body as T };
    })
    .catch((error) => {
      return {
        successful: false,
        error: error.message || "Failed to parse JSON"
      };
    });
}

/**
 * Parses URL parameters from the request and returns them as an object.
 * @param req - The incoming request
 * @returns An object containing the URL parameters as key-value pairs
 */
export function parseUrlParams(req: Request): Record<string, string> {
  const url = new URL(req.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => (params[key] = value));
  return params;
}

/**
 * Creates a JSON response with the given data and status code.
 * @param data - The data to include in the response body
 * @param status - The HTTP status code for the response (default: 200)
 * @returns A Response object with the specified data and status
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

/**
 * Creates a plain text response with the given message and status code.
 * @param message - The message to include in the response body
 * @param status - The HTTP status code for the response (default: 200)
 * @returns A Response object with the specified message and status
 */
export function textResponse(message: string, status = 200): Response {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

/**
 * Parses query parameters from the request URL and returns an object with typed values.
 * Currently supports 'page', 'pageSize', and 'limit' as numeric query parameters.
 * @param req - The incoming request
 * @returns An object containing the parsed query parameters with appropriate types
 */
export function parseQueryParams(req: Request): QueryParams {
  const params = new URL(req.url).searchParams;
  const query: QueryParams = {};

  for (const key of ["page", "pageSize", "limit"] as const) {
    const rawValue = params.get(key);
    if (!rawValue) continue;

    const parsedValue = Number.parseInt(rawValue, 10);
    if (Number.isFinite(parsedValue) && parsedValue > 0)
      query[key] = parsedValue;
  }

  return query;
}

/**
 * Normalizes the request body for row creation or update.
 * Extracts the optional 'id' field and separates it from the rest of the data.
 * @param body - The raw request body as an object
 * @return An object containing the optional 'id' and the 'data' for the row
 */
export function normalizeRowBody(body: Record<string, unknown>): {
  id?: string;
  data: Record<string, unknown>;
} {
  const { id, ...data } = body;
  if (valueIsDefined(id) && typeof id !== "string")
    throw new Error("Row ID must be a string if provided");

  return {
    id,
    data
  };
}

/**
 * Type guard to check if a value is defined (not undefined or null)
 * @param value - The value to check
 * @returns True if the value is defined, false otherwise
 */
export function valueIsDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

/**
 * Checks if a value is a plain object (i.e., an object that is not null, not an array, and has the type "object").
 * @param value The value to check.
 * @returns True if the value is a plain object, false otherwise.
 */
export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
