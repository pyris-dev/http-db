import { RouteHandler, RouteType } from "../index.js";

/** 
 * Test Web Route Handler
 * This handler responds with a 200 OK message for health check requests.
*/
class TestWebRouteHandler extends RouteHandler {
    static type = RouteType.REQUEST;

    static onRequest(_req: Request): Promise<Response> | Response {
        return new Response(Bun.file("./requestor.html"), {
            status: 200,
            headers: {
                'Content-Type': 'text/html',
            },
        });
    }
}

export { TestWebRouteHandler };