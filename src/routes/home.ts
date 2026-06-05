import { RouteHandler, RouteType, type RouteHandlerMap } from "./base.js";

export enum WebRoutes {
  HOME = "/",
  REQUESTOR = "/requestor"
}

class HomeRouteHandler extends RouteHandler {
  static override type = RouteType.REQUEST;

  static override onRequest(): Promise<Response> | Response {
    return new Response(
      Bun.file(new URL("../../requestor.html", import.meta.url)),
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );
  }
}

export const WebRouteHandlers: RouteHandlerMap<WebRoutes> = {
  [WebRoutes.HOME]: HomeRouteHandler.toRoute(),
  [WebRoutes.REQUESTOR]: HomeRouteHandler.toRoute()
};
