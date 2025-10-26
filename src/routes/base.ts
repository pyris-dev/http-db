import { config } from "../index.js";

export type RouteHandlerCallable = (req: Request) => Promise<Response> | Response;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type HttpMethodHandlers = Partial<Record<HttpMethod, RouteHandlerCallable>>;

export type RouteHandlerMap<T extends string> =
    Record<T, RouteHandlerCallable | HttpMethodHandlers>;

export enum RouteType {
    REQUEST = 'request',
    METHOD = 'method',
}

/**
 * Base Route Handler Class
 * Extend this class to create custom route handlers.
 */
export class RouteHandler {
    static type: RouteType = RouteType.REQUEST;

    static onRequest?: RouteHandlerCallable;
    static onPost?: RouteHandlerCallable;
    static onGet?: RouteHandlerCallable;
    static onPut?: RouteHandlerCallable;
    static onDelete?: RouteHandlerCallable;

    static toRoute(): HttpMethodHandlers | RouteHandlerCallable {
        if (this.type === RouteType.REQUEST) {
            if (!this.onRequest) throw new Error('RouteHandler of type "request" must implement static onRequest method');
            return (res) => this.routeInterceptor(res, this.onRequest!);
        } else {
            const result: HttpMethodHandlers = {};
            if (this.onPost) result.POST = (req) => this.routeInterceptor(req, this.onPost!);
            if (this.onGet) result.GET = (req) => this.routeInterceptor(req, this.onGet!);
            if (this.onPut) result.PUT = (req) => this.routeInterceptor(req, this.onPut!);
            if (this.onDelete) result.DELETE = (req) => this.routeInterceptor(req, this.onDelete!);
            return result;
        }
    }

    static routeInterceptor(req: Request, route: RouteHandlerCallable): Response | Promise<Response> {
        if (config.DEBUG_MODE)
            console.log(`Intercepting route: ${req.method} ${new URL(req.url).pathname}`);
        return route(req);
    }
}