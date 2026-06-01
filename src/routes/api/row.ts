import { dbManager } from "../../index.js";
import {
  checkAuth,
  jsonResponse,
  normalizeRowBody,
  parseJsonBody,
  textResponse
} from "../../util.js";
import { RouteHandler, RouteType } from "../index.js";

class RowApiRouteHandler extends RouteHandler {
  static type = RouteType.METHOD;

  static async onGet(req: Request): Promise<Response> {
    if (checkAuth(req) === false) return textResponse("Unauthorized", 401);

    if (!dbManager.isConnected())
      return textResponse("Database not connected", 500);

    const params = (req as any).params || {};
    const tableName = params.table as string;
    const rowId = params.row as string;
    const table = dbManager.getTable(tableName);
    if (!table) return textResponse("Table not found", 404);

    const row = await table.getRow(rowId);
    if (!row) return textResponse("Row not found", 404);

    return jsonResponse(row.toJSON());
  }

  static async onPut(req: Request): Promise<Response> {
    if (checkAuth(req) === false) return textResponse("Unauthorized", 401);

    if (!dbManager.isConnected())
      return textResponse("Database not connected", 500);

    const params = (req as any).params || {};
    const tableName = params.table as string;
    const rowId = params.row as string;
    const table = dbManager.getTable(tableName);
    if (!table) return textResponse("Table not found", 404);

    const existingRow = await table.getRow(rowId);
    if (!existingRow) return textResponse("Row not found", 404);

    const parsedBody = await parseJsonBody<Record<string, unknown>>(req);
    if (!parsedBody.successful || !parsedBody.data)
      return textResponse(parsedBody.error || "Malformed JSON body", 400);

    const { data } = normalizeRowBody(parsedBody.data);
    const updatedRow = table.createRow({
      id: existingRow.id,
      ...existingRow.data,
      ...data
    } as never);
    await table.updateRow(updatedRow);

    return jsonResponse(updatedRow.toJSON());
  }

  static async onDelete(req: Request): Promise<Response> {
    if (checkAuth(req) === false) return textResponse("Unauthorized", 401);

    if (!dbManager.isConnected())
      return textResponse("Database not connected", 500);

    const params = (req as any).params || {};
    const tableName = params.table as string;
    const rowId = params.row as string;
    const table = dbManager.getTable(tableName);
    if (!table) return textResponse("Table not found", 404);

    const row = await table.getRow(rowId);
    if (!row) return textResponse("Row not found", 404);

    await table.deleteRow(rowId);
    return jsonResponse({ message: "Row deleted", id: rowId, tableName });
  }
}

export { RowApiRouteHandler };
