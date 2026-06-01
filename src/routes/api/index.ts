import type { RouteHandlerMap } from "../index.js";
import { HealthApiRouteHandler } from "./health.js";
import { FallbackApiRouteHandler } from "./fallback.js";
import { TablesApiRouteHandler } from "./tables.js";
import { TableApiRouteHandler } from "./table.js";
import { RowsApiRouteHandler } from "./rows.js";
import { RowApiRouteHandler } from "./row.js";
import { SyncApiRouteHandler } from "./sync.js";

export enum ApiRoutes {
  FALLBACK = "/api/*",
  HEALTH = "/api/health",

  TABLES = "/api/db/tables",
  TABLE = "/api/db/tables/:table",

  ROWS = "/api/db/tables/:table/rows",
  ROW = "/api/db/tables/:table/rows/:row",

  SYNC = "/api/db/tables/:table/sync"
}

export const ApiRouteHandlers: RouteHandlerMap<ApiRoutes> = {
  [ApiRoutes.FALLBACK]: FallbackApiRouteHandler.toRoute(),
  [ApiRoutes.HEALTH]: HealthApiRouteHandler.toRoute(),

  [ApiRoutes.TABLES]: TablesApiRouteHandler.toRoute(),
  [ApiRoutes.TABLE]: TableApiRouteHandler.toRoute(),

  [ApiRoutes.ROWS]: RowsApiRouteHandler.toRoute(),
  [ApiRoutes.ROW]: RowApiRouteHandler.toRoute(),

  [ApiRoutes.SYNC]: SyncApiRouteHandler.toRoute()
};
