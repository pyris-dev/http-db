import { dbManager } from "../../index.js";
import {
  checkAuth,
  jsonResponse,
  parseJsonBody,
  textResponse
} from "../../util.js";
import { RouteHandler, RouteType } from "../index.js";

type SyncOperation<ValueType = unknown> =
  | { op: "set"; key: string; value: ValueType }
  | { op: "delete"; key: string }
  | { op: "clear" };

type SyncPayload<ValueType = unknown> = {
  memory?: Record<string, ValueType>;
  ops?: SyncOperation<ValueType>[];
  baseVersion?: number;
  mode?: "incremental" | "overwrite" | "reconcile";
};

type SyncCapableTable = {
  syncKeyValueState<ValueType = unknown>(
    payload: SyncPayload<ValueType>
  ): {
    version: number;
    previousVersion: number;
    totalKeys: number;
    state: Record<string, ValueType>;
  };
  getSyncVersion(): number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSyncPayload(payload: unknown): {
  successful: boolean;
  error?: string;
  data?: SyncPayload;
} {
  if (!isObject(payload)) {
    return {
      successful: false,
      error: "Malformed body: expected a JSON object"
    };
  }

  const { memory, ops, baseVersion, mode } = payload;

  if (memory !== undefined && !isObject(memory)) {
    return {
      successful: false,
      error: "Malformed body: memory must be an object"
    };
  }

  if (ops !== undefined && !Array.isArray(ops)) {
    return { successful: false, error: "Malformed body: ops must be an array" };
  }

  if (
    baseVersion !== undefined &&
    (!Number.isInteger(baseVersion) || baseVersion < 0)
  ) {
    return {
      successful: false,
      error: "Malformed body: baseVersion must be a non-negative integer"
    };
  }

  if (
    mode !== undefined &&
    mode !== "incremental" &&
    mode !== "overwrite" &&
    mode !== "reconcile"
  ) {
    return {
      successful: false,
      error: "Malformed body: mode must be incremental, overwrite, or reconcile"
    };
  }

  if (ops) {
    for (let index = 0; index < ops.length; index += 1) {
      const op = ops[index];
      if (!isObject(op) || typeof op.op !== "string") {
        return {
          successful: false,
          error: `Malformed body: ops[${index}] must be an operation object`
        };
      }

      if (op.op === "set") {
        if (typeof op.key !== "string" || !op.key.trim()) {
          return {
            successful: false,
            error: `Malformed body: ops[${index}].key must be a non-empty string`
          };
        }
        if (!("value" in op)) {
          return {
            successful: false,
            error: `Malformed body: ops[${index}].value is required for set`
          };
        }
        continue;
      }

      if (op.op === "delete") {
        if (typeof op.key !== "string" || !op.key.trim()) {
          return {
            successful: false,
            error: `Malformed body: ops[${index}].key must be a non-empty string`
          };
        }
        continue;
      }

      if (op.op === "clear") {
        continue;
      }

      return {
        successful: false,
        error: `Malformed body: unsupported op '${op.op}' at ops[${index}]`
      };
    }
  }

  return {
    successful: true,
    data: {
      memory: memory as Record<string, unknown> | undefined,
      ops: ops as SyncOperation[] | undefined,
      baseVersion: baseVersion as number | undefined,
      mode: mode as "incremental" | "overwrite" | "reconcile" | undefined
    }
  };
}

function asSyncCapableTable(table: unknown): SyncCapableTable | undefined {
  if (!isObject(table)) return undefined;

  const syncKeyValueState = (table as Record<string, unknown>)
    .syncKeyValueState;
  const getSyncVersion = (table as Record<string, unknown>).getSyncVersion;

  if (
    typeof syncKeyValueState !== "function" ||
    typeof getSyncVersion !== "function"
  ) {
    return undefined;
  }

  return table as SyncCapableTable;
}

class SyncApiRouteHandler extends RouteHandler {
  static type = RouteType.METHOD;

  static onGet(req: Request): Promise<Response> | Response {
    if (checkAuth(req) === false) return textResponse("Unauthorized", 401);

    if (!dbManager.isConnected())
      return textResponse("Database not connected", 500);

    const params = (req as any).params || {};
    const tableName = params.table as string;
    const table = dbManager.getTable(tableName);
    if (!table) return textResponse("Table not found", 404);

    const syncTable = asSyncCapableTable(table);
    if (!syncTable) {
      return textResponse(
        "Sync is not supported for this database table implementation",
        501
      );
    }

    return jsonResponse({
      tableName,
      version: syncTable.getSyncVersion()
    });
  }

  static async onPost(req: Request): Promise<Response> {
    if (checkAuth(req) === false) return textResponse("Unauthorized", 401);

    if (!dbManager.isConnected())
      return textResponse("Database not connected", 500);

    const params = (req as any).params || {};
    const tableName = params.table as string;
    const table = dbManager.getTable(tableName);
    if (!table) return textResponse("Table not found", 404);

    const syncTable = asSyncCapableTable(table);
    if (!syncTable) {
      return textResponse(
        "Sync is not supported for this database table implementation",
        501
      );
    }

    const parsedBody = await parseJsonBody<unknown>(req);
    if (!parsedBody.successful)
      return textResponse(parsedBody.error || "Malformed JSON body", 400);

    const syncPayload = parseSyncPayload(parsedBody.data);
    if (!syncPayload.successful || !syncPayload.data) {
      return textResponse(syncPayload.error || "Malformed sync payload", 400);
    }

    try {
      const result = syncTable.syncKeyValueState(syncPayload.data);
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
      if (message.startsWith("Version conflict:")) {
        return textResponse(message, 409);
      }
      return textResponse(message, 400);
    }
  }
}

export { SyncApiRouteHandler };
