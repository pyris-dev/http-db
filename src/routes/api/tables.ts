import { dbManager } from "../../index.js";
import {
  checkAuth,
  jsonResponse,
  parseJsonBody,
  parseQueryParams,
  textResponse
} from "../../util.js";
import { RouteHandler, RouteType } from "../index.js";

/**
 * Tables API Route Handler
 * This handler manages API requests related to database tables.
 */
class TablesApiRouteHandler extends RouteHandler {
  static type = RouteType.METHOD;

  static onGet(req: Request): Promise<Response> | Response {
    if (checkAuth(req) === false) return textResponse("Unauthorized", 401);

    if (!dbManager.isConnected())
      return textResponse("Database not connected", 500);

    const queryResult = dbManager.listTables(parseQueryParams(req));

    return jsonResponse(queryResult);
  }

  static async onPost(req: Request): Promise<Response> {
    if (checkAuth(req) === false) return textResponse("Unauthorized", 401);

    const parsedBody = await parseJsonBody<{ tableName: string }>(req, [
      "tableName"
    ]);
    if (!parsedBody.successful) return textResponse(parsedBody.error!, 400);

    const { tableName } = parsedBody.data!;

    if (!dbManager.isConnected())
      return textResponse("Database not connected", 500);

    if (dbManager.getTable(tableName))
      return textResponse("Table already exists", 400);

    try {
      const table = dbManager.createTable(tableName);
      return jsonResponse(table.getShortData(), 201);
    } catch (error) {
      return textResponse((error as Error).message, 400);
    }
  }
}

export { TablesApiRouteHandler };
