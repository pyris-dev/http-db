import { RouteHandler, RouteType } from "../index.js";

/** 
 * Health API Route Handler
 * This handler responds with a 200 OK message for health check requests.
*/
class HealthApiRouteHandler extends RouteHandler {
    static type = RouteType.REQUEST;

    static onRequest(_req: Request): Promise<Response> | Response {
        return new Response('OK', { status: 200 });
    }
}

export { HealthApiRouteHandler };