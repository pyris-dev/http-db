import { Logger } from "../logger.js";

const RouteInterceptorLogger = new Logger("ROUTE_INT");

export type RouteHandlerCallable = (
  req: Request
) => Promise<Response> | Response;

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type HttpMethodHandlers = Partial<
  Record<HttpMethod, RouteHandlerCallable>
>;

export type RouteHandlerMap<T extends string> = Record<
  T,
  RouteHandlerCallable | HttpMethodHandlers
>;

export enum RouteType {
  REQUEST = "request",
  METHOD = "method"
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
      if (!this.onRequest)
        throw new Error(
          'RouteHandler of type "request" must implement static onRequest method'
        );
      return (res) => this.routeInterceptor(res, this.onRequest!);
    } else {
      const result: HttpMethodHandlers = {};
      if (this.onPost)
        result.POST = (req) => this.routeInterceptor(req, this.onPost!);
      if (this.onGet)
        result.GET = (req) => this.routeInterceptor(req, this.onGet!);
      if (this.onPut)
        result.PUT = (req) => this.routeInterceptor(req, this.onPut!);
      if (this.onDelete)
        result.DELETE = (req) => this.routeInterceptor(req, this.onDelete!);
      return result;
    }
  }

  static routeInterceptor(
    req: Request,
    route: RouteHandlerCallable
  ): Response | Promise<Response> {
    if ((process.env.DEBUG_MODE ?? "").toLowerCase() !== "true")
      return route(req);

    const startedAt = performance.now();
    const { pathname, search } = new URL(req.url);
    const routeTarget = `${pathname}${search}`;

    RouteInterceptorLogger.debug(`IN ${req.method} ${routeTarget}`);

    try {
      const result = route(req);

      if (result instanceof Promise)
        return result
          .then((response) => {
            const durationMs = Math.round(performance.now() - startedAt);
            RouteInterceptorLogger.debug(
              `OUT ${req.method} ${routeTarget} -> ${response.status} (${durationMs}ms)`
            );
            return response;
          })
          .catch((error) => {
            const durationMs = Math.round(performance.now() - startedAt);
            const message =
              error instanceof Error ? error.message : String(error);
            RouteInterceptorLogger.debug(
              `ERR ${req.method} ${routeTarget} (${durationMs}ms): ${message}`
            );
            throw error;
          });

      const durationMs = Math.round(performance.now() - startedAt);
      RouteInterceptorLogger.debug(
        `OUT ${req.method} ${routeTarget} -> ${result.status} (${durationMs}ms)`
      );
      return result;
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt);
      const message = error instanceof Error ? error.message : String(error);
      RouteInterceptorLogger.debug(
        `ERR ${req.method} ${routeTarget} (${durationMs}ms): ${message}`
      );
      throw error;
    }
  }
}
