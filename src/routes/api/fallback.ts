import { RouteHandler, RouteType } from "../index.js";

/** 
 * Fallback API Route Handler
 * This handler responds with a 404 Not Found message for any unmatched API routes.
*/
class FallbackApiRouteHandler extends RouteHandler {
  static type = RouteType.REQUEST;

  static onRequest(req: Request): Promise<Response> | Response {
    return new Response(`API Endpoint Not found, at "${new URL(req.url).pathname}" for method "${req.method}"`, { status: 404 });
  }
}

export { FallbackApiRouteHandler };