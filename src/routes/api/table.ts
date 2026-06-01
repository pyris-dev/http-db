import { dbManager } from "../../index.js";
import { checkAuth, jsonResponse, textResponse } from "../../util.js";
import { RouteHandler, RouteType } from "../index.js";

/**
 * Table API Route Handler
 * This handler manages API requests related to a database table.
 */
class TableApiRouteHandler extends RouteHandler {
  static type = RouteType.METHOD;

  static onGet(req: Request): Promise<Response> | Response {
    if (checkAuth(req) === false) return textResponse("Unauthorized", 401);

    if (!dbManager.isConnected())
      return textResponse("Database not connected", 500);

    const params = (req as any).params || {};
    const tableName = params.table as string;
    const table = dbManager.getTable(tableName);
    if (!table) return textResponse("Table not found", 404);

    return jsonResponse(table.getFullData());
  }

  static async onDelete(req: Request): Promise<Response> {
    if (checkAuth(req) === false) return textResponse("Unauthorized", 401);

    if (!dbManager.isConnected())
      return textResponse("Database not connected", 500);

    const params = (req as any).params || {};
    const tableName = params.table as string;
    const table = dbManager.getTable(tableName);
    if (!table) return textResponse("Table not found", 404);

    dbManager.deleteTable(tableName);
    return jsonResponse({ message: "Table deleted", tableName });
  }
}

export { TableApiRouteHandler };
