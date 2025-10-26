import { config } from "./index.js";

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
    if (!authKey) throw new Error('Failed to check authentication: no auth key configured when authentication is enabled');
    const provided = req.headers.get('authorization') || '';
    return provided === `Bearer ${authKey}`;
}

export function parseJsonBody<T>(req: Request, expectedJsonKeys?: string[]): Promise<{ successful: boolean, data?: T, error?: string }> {
    return req.json().then((body: T) => {
        if (expectedJsonKeys) {
            for (const key of expectedJsonKeys) {
                if (!(key in (body as any))) {
                    return { successful: false, error: `Malformed Body: Missing expected JSON key: ${key}` };
                }
            }
        }
        return { successful: true, data: body };
    }).catch((error) => {
        return { successful: false, error: error.message || 'Failed to parse JSON' };
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

