import { Database } from "bun:sqlite";
import { BaseRow, BaseTable, BaseDatabaseManager, type ShortTableData, type FullTableData, type QueryParams, type QueryResult } from "./base.js";

type RowConstructor<RowType extends BaseRow> = new (id: string, data?: any) => RowType;

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
        data: pagedItems,
    };
}

class SqliteTable<RowType extends BaseRow> extends BaseTable<RowType> {
    public db: Database;
    public tableName: string;
    private RowClass: RowConstructor<RowType>;

    constructor(db: Database, tableName: string, RowClass: RowConstructor<RowType>) {
        super();
        validateTableName(tableName);

        this.db = db;
        this.tableName = tableName;
        this.RowClass = RowClass;

        // Ensure table exists (use prepared statement for consistency)
        this.db.prepare(
            `CREATE TABLE IF NOT EXISTS "${tableName}" (id TEXT PRIMARY KEY, data TEXT)`
        ).run();


    }

    async fetchExistingRows(): Promise<void> {
        this.rows.clear();
        const rows = this.db.prepare(`SELECT id, data FROM "${this.tableName}" ORDER BY rowid DESC`).all() as { id: string; data: string }[];
        for (const row of rows) {
            this.rows.set(row.id, new this.RowClass(row.id, deserializeData(row.data)));
        }
    }

    createRow(data?: Partial<RowType>): RowType {
        return new this.RowClass(data?.id || crypto.randomUUID(), data);
    }

    async insertRow(row: RowType): Promise<void> {
        this.db.prepare(
            `INSERT INTO "${this.tableName}" (id, data) VALUES (?1, ?2)`
        ).run(row.id, serializeData(row.data));
        this.rows.set(row.id, row);
    }

    async getRow(id: string): Promise<RowType | undefined> {
        const result = this.db.prepare(
            `SELECT data FROM "${this.tableName}" WHERE id = ?1`
        ).get(id) as { data: string } | undefined;

        if (!result) return undefined;
        return new this.RowClass(id, deserializeData(result.data));
    }

    async updateRow(row: RowType): Promise<void> {
        this.db.prepare(
            `UPDATE "${this.tableName}" SET data = ?1 WHERE id = ?2`
        ).run(serializeData(row.data), row.id);
        this.rows.set(row.id, row);
    }

    async deleteRow(id: string): Promise<void> {
        this.db.prepare(`DELETE FROM "${this.tableName}" WHERE id = ?1`).run(id);
        this.rows.delete(id);
    }

    async listRows(query: QueryParams = {}): Promise<QueryResult<RowType>> {
        const totalItemsRow = this.db.prepare(`SELECT COUNT(*) as count FROM "${this.tableName}"`).get() as { count: number };
        const totalItems = totalItemsRow.count;

        const page = query.page && query.page > 0 ? query.page : 1;
        const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 10;
        const limit = query.limit && query.limit > 0 ? query.limit : pageSize;
        const offset = (page - 1) * pageSize;

        const rows = this.db.prepare(`SELECT id, data FROM "${this.tableName}" ORDER BY rowid DESC LIMIT ? OFFSET ?`).all(limit, offset) as { id: string; data: string }[];
        const data = rows.map(r => new this.RowClass(r.id, deserializeData(r.data)));

        return { ...paginate(data, query), totalItems };
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
            rows: Array.from(this.rows.values()).map(r => r.toJSON())
        };
    }
}

class SqliteDatabaseManager<RowType extends BaseRow> extends BaseDatabaseManager<RowType, SqliteTable<RowType>> {
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
        // exclude internal sqlite tables
        const tableNames = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all() as { name: string }[];
        for (const tableInfo of tableNames) {
            const table = new SqliteTable<RowType>(this.db, tableInfo.name, this.RowClass);
            // populate in-memory rows cache for this table
            await table.fetchExistingRows();
            this.tables.set(tableInfo.name, table);
        }
    }

    createTable(name: string): SqliteTable<RowType> {
        if (!this.db) throw new Error("Database not connected");
        const table = new SqliteTable<RowType>(this.db, name, this.RowClass);
        this.tables.set(name, table);
        return table;
    }

    getTable(name: string): SqliteTable<RowType> | undefined {
        return this.tables.get(name);
    }

    deleteTable(name: string): void {
        if (!this.db) throw new Error("Database not connected");
        this.db.prepare(`DROP TABLE IF EXISTS "${name}"`).run();
        this.tables.delete(name);
    }

    listTables(query: QueryParams = {}): QueryResult<ShortTableData> {
        const allTables = Array.from(this.tables.values()).map(t => t.getShortData());
        return paginate(allTables, query);
    }
}

export { SqliteDatabaseManager, SqliteTable };
