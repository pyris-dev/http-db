import { dbManager } from "../../index.js";
import {
  checkAuth,
  jsonResponse,
  normalizeRowBody,
  parseJsonBody,
  parseQueryParams,
  textResponse
} from "../../util.js";
import { Logger } from "../../logger.js";
import { RouteHandler, RouteType } from "../index.js";

const ApiRowsLogger = new Logger("API_ROWS");

class RowsApiRouteHandler extends RouteHandler {
  static override type = RouteType.METHOD;

  static override async onGet(req: Request): Promise<Response> {
    if (checkAuth(req) === false) return textResponse("Unauthorized", 401);

    if (!dbManager.isConnected())
      return textResponse("Database not connected", 500);

    const params = (req as any).params || {};
    const tableName = params.table as string;
    const table = dbManager.getTable(tableName);
    if (!table) {
      ApiRowsLogger.warn(
        `GET /api/db/tables/${tableName}/rows table not found`
      );
      return textResponse("Table not found", 404);
    }

    const queryResult = await table.listRows(parseQueryParams(req));
    return jsonResponse({
      ...queryResult,
      data: queryResult.data.map((row) => row.toJSON())
    });
  }

  static override async onPost(req: Request): Promise<Response> {
    if (checkAuth(req) === false) return textResponse("Unauthorized", 401);

    if (!dbManager.isConnected())
      return textResponse("Database not connected", 500);

    const params = (req as any).params || {};
    const tableName = params.table as string;
    const table = dbManager.getTable(tableName);
    if (!table) {
      ApiRowsLogger.warn(
        `POST /api/db/tables/${tableName}/rows table not found`
      );
      return textResponse("Table not found", 404);
    }

    const parsedBody = await parseJsonBody<Record<string, unknown>>(req);
    if (!parsedBody.successful || !parsedBody.data)
      return textResponse(parsedBody.error || "Malformed JSON body", 400);

    const { id, data } = normalizeRowBody(parsedBody.data);
    const row = table.createRow(
      id ? ({ id, ...data } as never) : (data as never)
    );
    await table.insertRow(row);

    return jsonResponse(row.toJSON(), 201);
  }
}

export { RowsApiRouteHandler };
