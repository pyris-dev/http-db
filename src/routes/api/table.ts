import { dbManager } from "../../index.js";
import { Logger } from "../../logger.js";
import { checkAuth, jsonResponse, textResponse } from "../../util.js";
import { RouteHandler, RouteType } from "../index.js";

const ApiTableLogger = new Logger("API_TABLE");

/**
 * Table API Route Handler
 * This handler manages API requests related to a database table.
 */
class TableApiRouteHandler extends RouteHandler {
  static override type = RouteType.METHOD;

  static override onGet(req: Request): Promise<Response> | Response {
    if (checkAuth(req) === false) return textResponse("Unauthorized", 401);

    if (!dbManager.isConnected())
      return textResponse("Database not connected", 500);

    const params = (req as any).params || {};
    const tableName = params.table as string;
    const table = dbManager.getTable(tableName);
    if (!table) {
      ApiTableLogger.warn(`GET /api/db/tables/${tableName} table not found`);
      return textResponse("Table not found", 404);
    }

    return jsonResponse(table.getFullData());
  }

  static override async onDelete(req: Request): Promise<Response> {
    if (checkAuth(req) === false) return textResponse("Unauthorized", 401);

    if (!dbManager.isConnected())
      return textResponse("Database not connected", 500);

    const params = (req as any).params || {};
    const tableName = params.table as string;
    const table = dbManager.getTable(tableName);
    if (!table) {
      ApiTableLogger.warn(`DELETE /api/db/tables/${tableName} table not found`);
      return textResponse("Table not found", 404);
    }

    dbManager.deleteTable(tableName);
    return jsonResponse({ message: "Table deleted", tableName });
  }
}

export { TableApiRouteHandler };
