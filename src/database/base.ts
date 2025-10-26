export class BaseRow {
    public readonly id: string;
    public readonly data: Record<string, unknown>;

    constructor(id: string, data?: Record<string, unknown>) {
        this.id = id;
        this.data = data || {};
    }

    public toJSON(): Record<string, unknown> {
        return { id: this.id, ...this.data };
    }
}

export type QueryParams = {
    // What page number to retrieve (1-based)
    'page'?: number;
    // Number of items per page
    'pageSize'?: number;
    // Maximum number of items to return
    'limit'?: number;
}

export type QueryResult<T> = {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
    data: T[];
};

export abstract class BaseTable<RowType extends BaseRow> {
    public readonly rows: Map<string, RowType> = new Map();
    abstract tableName: string;

    abstract fetchExistingRows(): Promise<void>;

    abstract createRow(data?: Partial<RowType>): RowType;
    abstract insertRow(row: RowType): Promise<void>;
    abstract getRow(id: string): Promise<RowType | undefined>;
    abstract updateRow(row: RowType): Promise<void>;
    abstract deleteRow(id: string): Promise<void>;

    abstract listRows(query: QueryParams): Promise<QueryResult<RowType>>;

    abstract getShortData(): ShortTableData;
    abstract getFullData(): FullTableData;
}

export type ShortTableData = {
    tableName: string;
    rowCount: number;
    rowNames: string[];
};

export type FullTableData = {
    tableName: string;
    rows: Record<string, unknown>[];
};

export abstract class BaseDatabaseManager<
    RowType extends BaseRow,
    TableType extends BaseTable<RowType>
> {
    readonly tables: Map<string, TableType> = new Map();

    abstract connect(): Promise<void>;
    abstract disconnect(): Promise<void>;
    abstract isConnected(): boolean;
    abstract fetchExistingTables(): Promise<void>;

    abstract createTable(name: string): TableType;
    abstract getTable(name: string): TableType | undefined;
    abstract deleteTable(name: string): void;

    abstract listTables(query: QueryParams): QueryResult<ShortTableData>;

}