import { dbManager } from "../../index.js";
import { Logger } from "../../logger.js";
import { isSyncCapableTable, type SyncPayload } from "../../database/base.js";
import {
  checkAuth,
  jsonResponse,
  parseJsonBody,
  textResponse,
  valueIsDefined
} from "../../util.js";
import { RouteHandler, RouteType } from "../index.js";

const ApiSyncLogger = new Logger("API_SYNC");

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSyncPayload(payload: unknown): {
  successful: boolean;
  error?: string;
  data?: SyncPayload;
} {
  if (!isObject(payload))
    return {
      successful: false,
      error: "Malformed body: expected a JSON object"
    };

  const { memory, ops, baseVersion, mode } = payload;

  if (!valueIsDefined(memory) || !isObject(memory))
    return {
      successful: false,
      error: "Malformed body: memory must be an object"
    };

  if (!valueIsDefined(ops) || !Array.isArray(ops))
    return {
      successful: false,
      error: "Malformed body: ops must be an array"
    };

  if (
    !valueIsDefined(baseVersion) ||
    !Number.isInteger(baseVersion) ||
    baseVersion < 0
  )
    return {
      successful: false,
      error: "Malformed body: baseVersion must be a non-negative integer"
    };

  if (
    valueIsDefined(mode) &&
    mode !== "incremental" &&
    mode !== "overwrite" &&
    mode !== "reconcile"
  )
    return {
      successful: false,
      error: "Malformed body: mode must be incremental, overwrite, or reconcile"
    };

  if (ops) for (let index = 0; index < ops.length; index += 1) {
      const op = ops[index];
      if (!isObject(op) || typeof op.op !== "string")
        return {
          successful: false,
          error: `Malformed body: ops[${index}] must be an operation object`
        };

      if (op.op === "set") {
        if (typeof op.key !== "string" || !op.key.trim())
          return {
            successful: false,
            error: `Malformed body: ops[${index}].key must be a non-empty string`
          };
        if (!("value" in op))
          return {
            successful: false,
            error: `Malformed body: ops[${index}].value is required for set`
          };

        continue;
      }

      if (op.op === "delete") {
        if (typeof op.key !== "string" || !op.key.trim())
          return {
            successful: false,
            error: `Malformed body: ops[${index}].key must be a non-empty string`
          };

        continue;
      }

      if (op.op === "clear") continue;

      return {
        successful: false,
        error: `Malformed body: unsupported op '${op.op}' at ops[${index}]`
      };
    }

  return {
    successful: true,
    data: {
      memory: memory,
      ops: ops,
      baseVersion: baseVersion,
      mode: mode
    }
  };
}

class SyncApiRouteHandler extends RouteHandler {
  static override type = RouteType.METHOD;

  static override onGet(req: Request): Promise<Response> | Response {
    if (checkAuth(req) === false) return textResponse("Unauthorized", 401);

    if (!dbManager.isConnected())
      return textResponse("Database not connected", 500);

    const params = (req as any).params || {};
    const tableName = params.table as string;
    const table = dbManager.getTable(tableName);
    if (!table) {
      ApiSyncLogger.warn(
        `GET /api/db/tables/${tableName}/sync table not found`
      );
      return textResponse("Table not found", 404);
    }

    if (!isSyncCapableTable(table))
      return textResponse(
        "Sync is not supported for this database table implementation",
        501
      );

    return jsonResponse({
      tableName,
      version: table.getSyncVersion()
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
      ApiSyncLogger.warn(
        `POST /api/db/tables/${tableName}/sync table not found`
      );
      return textResponse("Table not found", 404);
    }

    if (!isSyncCapableTable(table))
      return textResponse(
        "Sync is not supported for this database table implementation",
        501
      );

    const parsedBody = await parseJsonBody<unknown>(req);
    if (!parsedBody.successful)
      return textResponse(parsedBody.error || "Malformed JSON body", 400);

    const syncPayload = parseSyncPayload(parsedBody.data);
    if (!syncPayload.successful || !syncPayload.data)
      return textResponse(syncPayload.error || "Malformed sync payload", 400);

    try {
      const result = table.syncKeyValueState(syncPayload.data);
      return jsonResponse({
        tableName,
        mode:
          syncPayload.data.mode ??
          (syncPayload.data.ops?.length ? "incremental" : "overwrite"),
        appliedOps: syncPayload.data.ops?.length ?? 0,
        ...result
      });
    } catch (error) {
      const message = (error as Error).message;
      if (message.startsWith("Version conflict:"))
        return textResponse(message, 409);

      return textResponse(message, 400);
    }
  }
}

export { SyncApiRouteHandler };
