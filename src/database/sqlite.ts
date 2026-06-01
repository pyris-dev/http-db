import { Database } from "bun:sqlite";
import {
  BaseRow,
  BaseTable,
  BaseDatabaseManager,
  type ShortTableData,
  type FullTableData,
  type QueryParams,
  type QueryResult
} from "./base.js";

type RowConstructor<RowType extends BaseRow> = new (
  id: string,
  data?: any
) => RowType;

function isDebugModeEnabled(): boolean {
  return (process.env.DEBUG_MODE ?? "").toLowerCase() === "true";
}

function logDbOperation(message: string): void {
  if (isDebugModeEnabled()) {
    console.log(`[DB][OP] ${message}`);
  }
}

function validateTableName(name: string) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(`Invalid table name: ${name}`);
  }
}

function serializeData(data: any): string {
  return JSON.stringify(data);
}

function deserializeData(dataStr: string): any {
  try {
    return JSON.parse(dataStr);
  } catch {
    // If parsing fails, return raw string to avoid throwing for corrupted data
    return dataStr;
  }
}

function paginate<T>(items: T[], query: QueryParams): QueryResult<T> {
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 10;
  const limit = query.limit && query.limit > 0 ? query.limit : pageSize;
  const offset = (page - 1) * pageSize;
  const pagedItems = items.slice(offset, offset + limit);
  return {
    page,
    pageSize,
    totalItems: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
    data: pagedItems
  };
}

class SqliteTable<RowType extends BaseRow> extends BaseTable<RowType> {
  public db: Database;
  public tableName: string;
  private RowClass: RowConstructor<RowType>;

  constructor(
    db: Database,
    tableName: string,
    RowClass: RowConstructor<RowType>
  ) {
    super();
    validateTableName(tableName);

    this.db = db;
    this.tableName = tableName;
    this.RowClass = RowClass;

    // Ensure table exists (use prepared statement for consistency)
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS "${tableName}" (id TEXT PRIMARY KEY, data TEXT)`
      )
      .run();
  }

  async fetchExistingRows(): Promise<void> {
    this.rows.clear();
    const rows = this.db
      .prepare(`SELECT id, data FROM "${this.tableName}" ORDER BY rowid DESC`)
      .all() as { id: string; data: string }[];
    for (const row of rows) {
      this.rows.set(
        row.id,
        new this.RowClass(row.id, deserializeData(row.data))
      );
    }
  }

  createRow(data?: Partial<RowType>): RowType {
    const input = { ...(data as Record<string, unknown> | undefined) };
    const id =
      typeof input?.id === "string" && input.id.trim()
        ? input.id
        : crypto.randomUUID();

    if (input) {
      delete input.id;
    }

    return new this.RowClass(id, input);
  }

  async insertRow(row: RowType): Promise<void> {
    this.db
      .prepare(`INSERT INTO "${this.tableName}" (id, data) VALUES (?1, ?2)`)
      .run(row.id, serializeData(row.data));
    this.rows.set(row.id, row);
    logDbOperation(`insert row table=${this.tableName} id=${row.id}`);
  }

  async getRow(id: string): Promise<RowType | undefined> {
    const result = this.db
      .prepare(`SELECT data FROM "${this.tableName}" WHERE id = ?1`)
      .get(id) as { data: string } | undefined;

    if (!result) return undefined;
    return new this.RowClass(id, deserializeData(result.data));
  }

  async updateRow(row: RowType): Promise<void> {
    this.db
      .prepare(`UPDATE "${this.tableName}" SET data = ?1 WHERE id = ?2`)
      .run(serializeData(row.data), row.id);
    this.rows.set(row.id, row);
    logDbOperation(`update row table=${this.tableName} id=${row.id}`);
  }

  async deleteRow(id: string): Promise<void> {
    this.db.prepare(`DELETE FROM "${this.tableName}" WHERE id = ?1`).run(id);
    this.rows.delete(id);
    logDbOperation(`delete row table=${this.tableName} id=${id}`);
  }

  async listRows(query: QueryParams = {}): Promise<QueryResult<RowType>> {
    const totalItemsRow = this.db
      .prepare(`SELECT COUNT(*) as count FROM "${this.tableName}"`)
      .get() as { count: number };
    const totalItems = totalItemsRow.count;

    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 10;
    const limit = query.limit && query.limit > 0 ? query.limit : pageSize;
    const offset = (page - 1) * pageSize;

    const rows = this.db
      .prepare(
        `SELECT id, data FROM "${this.tableName}" ORDER BY rowid DESC LIMIT ? OFFSET ?`
      )
      .all(limit, offset) as { id: string; data: string }[];
    const data = rows.map(
      (r) => new this.RowClass(r.id, deserializeData(r.data))
    );

    return {
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      data
    };
  }

  syncKeyValueState<ValueType = unknown>(payload: {
    memory?: Record<string, ValueType>;
    ops?: Array<
      | { op: "set"; key: string; value: ValueType }
      | { op: "delete"; key: string }
      | { op: "clear" }
    >;
    baseVersion?: number;
    mode?: "incremental" | "overwrite" | "reconcile";
  }): {
    version: number;
    previousVersion: number;
    totalKeys: number;
    state: Record<string, ValueType>;
  } {
    const db = this.db;
    const metadataTable = "__http_db_sync_meta";

    db.prepare(
      `CREATE TABLE IF NOT EXISTS "${metadataTable}" (table_name TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`
    ).run();

    db.exec("BEGIN IMMEDIATE TRANSACTION");

    try {
      const currentVersionRow = db
        .prepare(
          `SELECT version FROM "${metadataTable}" WHERE table_name = ?1 LIMIT 1`
        )
        .get(this.tableName) as { version: number } | undefined;
      const currentVersion = currentVersionRow?.version ?? 0;

      if (
        Number.isFinite(payload.baseVersion) &&
        payload.baseVersion !== currentVersion
      ) {
        throw new Error(
          `Version conflict: expected ${payload.baseVersion}, current ${currentVersion}`
        );
      }

      const ops = payload.ops ?? [];
      const hasMemory = payload.memory !== undefined;
      const mode =
        payload.mode ?? (ops.length > 0 ? "incremental" : "overwrite");

      const rows = db
        .prepare(`SELECT id, data FROM "${this.tableName}" ORDER BY rowid ASC`)
        .all() as { id: string; data: string }[];

      const state = new Map<string, ValueType>();
      for (const row of rows) {
        const parsed = deserializeData(row.data);
        if (parsed && typeof parsed === "object" && "value" in parsed) {
          state.set(row.id, (parsed as { value: ValueType }).value);
        } else {
          state.set(row.id, parsed as ValueType);
        }
      }

      if (mode === "overwrite") {
        state.clear();
        if (hasMemory) {
          for (const [key, value] of Object.entries(payload.memory!)) {
            state.set(key, value as ValueType);
          }
        }
      } else {
        for (const operation of ops) {
          if (operation.op === "clear") {
            state.clear();
            continue;
          }

          if (operation.op === "delete") {
            state.delete(operation.key);
            continue;
          }

          state.set(operation.key, operation.value);
        }

        if (mode === "reconcile" && hasMemory) {
          state.clear();
          for (const [key, value] of Object.entries(payload.memory!)) {
            state.set(key, value as ValueType);
          }
        }
      }

      db.prepare(`DELETE FROM "${this.tableName}"`).run();
      const insertStmt = db.prepare(
        `INSERT INTO "${this.tableName}" (id, data) VALUES (?1, ?2)`
      );
      for (const [key, value] of state.entries()) {
        insertStmt.run(key, serializeData({ value }));
      }

      const nextVersion = currentVersion + 1;
      db.prepare(
        `INSERT INTO "${metadataTable}" (table_name, version, updated_at)
         VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(table_name) DO UPDATE SET
           version = excluded.version,
           updated_at = excluded.updated_at`
      ).run(this.tableName, nextVersion);

      this.rows.clear();
      for (const [key, value] of state.entries()) {
        this.rows.set(
          key,
          new this.RowClass(key, { value } as unknown as Record<
            string,
            unknown
          >)
        );
      }

      db.exec("COMMIT");

      logDbOperation(
        `sync table=${this.tableName} mode=${mode} previousVersion=${currentVersion} version=${nextVersion} ops=${ops.length} keys=${state.size}`
      );

      return {
        version: nextVersion,
        previousVersion: currentVersion,
        totalKeys: state.size,
        state: Object.fromEntries(state.entries())
      };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  getSyncVersion(): number {
    const db = this.db;
    const metadataTable = "__http_db_sync_meta";
    db.prepare(
      `CREATE TABLE IF NOT EXISTS "${metadataTable}" (table_name TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`
    ).run();

    const row = db
      .prepare(
        `SELECT version FROM "${metadataTable}" WHERE table_name = ?1 LIMIT 1`
      )
      .get(this.tableName) as { version: number } | undefined;

    return row?.version ?? 0;
  }

  getShortData(): ShortTableData {
    return {
      tableName: this.tableName,
      rowCount: this.rows.size,
      rowNames: Array.from(this.rows.keys())
    };
  }

  getFullData(): FullTableData {
    return {
      tableName: this.tableName,
      rows: Array.from(this.rows.values()).map((r) => r.toJSON())
    };
  }
}

class SqliteDatabaseManager<
  RowType extends BaseRow
> extends BaseDatabaseManager<RowType, SqliteTable<RowType>> {
  private db: Database | undefined;
  private fileName: string;
  private RowClass: RowConstructor<RowType>;

  constructor(fileName: string, RowClass: RowConstructor<RowType>) {
    super();
    this.fileName = fileName;
    this.RowClass = RowClass;
  }

  async connect(): Promise<void> {
    this.db = new Database(this.fileName);
    await this.fetchExistingTables();
  }

  async disconnect(): Promise<void> {
    this.db?.close();
    this.db = undefined;
  }

  isConnected(): boolean {
    return !!this.db;
  }

  async fetchExistingTables(): Promise<void> {
    if (!this.db) throw new Error("Database not connected");
    this.tables.clear();
    // Exclude sqlite internals and http-db internal metadata tables.
    const tableNames = this.db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__http_db_%'`
      )
      .all() as { name: string }[];

    for (const tableInfo of tableNames) {
      const columns = this.db
        .prepare(`PRAGMA table_info("${tableInfo.name}")`)
        .all() as { name: string }[];
      const columnNames = new Set(columns.map((column) => column.name));

      // Only load tables that match the row storage shape used by this server.
      if (!columnNames.has("id") || !columnNames.has("data")) {
        continue;
      }

      const table = new SqliteTable<RowType>(
        this.db,
        tableInfo.name,
        this.RowClass
      );
      // populate in-memory rows cache for this table
      await table.fetchExistingRows();
      this.tables.set(tableInfo.name, table);
      logDbOperation(
        `load table table=${tableInfo.name} rows=${table.rows.size}`
      );
    }
  }

  createTable(name: string): SqliteTable<RowType> {
    if (!this.db) throw new Error("Database not connected");
    const table = new SqliteTable<RowType>(this.db, name, this.RowClass);
    this.tables.set(name, table);
    logDbOperation(`create table table=${name}`);
    return table;
  }

  getTable(name: string): SqliteTable<RowType> | undefined {
    return this.tables.get(name);
  }

  deleteTable(name: string): void {
    if (!this.db) throw new Error("Database not connected");
    this.db.prepare(`DROP TABLE IF EXISTS "${name}"`).run();
    this.tables.delete(name);
    logDbOperation(`delete table table=${name}`);
  }

  listTables(query: QueryParams = {}): QueryResult<ShortTableData> {
    const allTables = Array.from(this.tables.values()).map((t) =>
      t.getShortData()
    );
    return paginate(allTables, query);
  }
}

export { SqliteDatabaseManager, SqliteTable };
