/**
 * Base classes and types for the database management system.
 */
export class BaseRow {
  /** The unique identifier for the row */
  public readonly id: string;
  /** The data contained in the row */
  public readonly data: Record<string, unknown>;

  constructor(id: string, data?: Record<string, unknown>) {
    this.id = id;
    this.data = data || {};
  }

  /** Converts the row to a JSON-serializable object */
  public toJSON(): Record<string, unknown> {
    return { id: this.id, ...this.data };
  }
}

export type QueryParams = {
  // What page number to retrieve (1-based)
  page?: number;
  // Number of items per page
  pageSize?: number;
  // Maximum number of items to return
  limit?: number;
};

export type QueryResult<T> = {
  /** The current page number */
  page: number;
  /** The number of items per page */
  pageSize: number;
  /** The total number of pages */
  totalPages: number;
  /** The total number of items */
  totalItems: number;
  /** The data items for the current page */
  data: T[];
};

export type SyncOperation<ValueType = unknown> =
  | { op: "set"; key: string; value: ValueType }
  | { op: "delete"; key: string }
  | { op: "clear" };

export type SyncPayload<ValueType = unknown> = {
  memory?: Record<string, ValueType>;
  ops?: SyncOperation<ValueType>[];
  baseVersion?: number;
  mode?: "incremental" | "overwrite" | "reconcile";
};

export type SyncResult<ValueType = unknown> = {
  version: number;
  previousVersion: number;
  totalKeys: number;
  state: Record<string, ValueType>;
};

export interface SyncCapableTable {
  syncKeyValueState<ValueType = unknown>(
    payload: SyncPayload<ValueType>
  ): SyncResult<ValueType>;
  getSyncVersion(): number;
}

export function isSyncCapableTable(table: unknown): table is SyncCapableTable {
  if (typeof table !== "object" || table === null) return false;

  const value = table as Record<string, unknown>;
  return (
    typeof value.syncKeyValueState === "function" &&
    typeof value.getSyncVersion === "function"
  );
}

export abstract class BaseTable<RowType extends BaseRow> {
  /** The rows contained in the table, indexed by their ID */
  public readonly rows: Map<string, RowType> = new Map();
  /** The name of the table */
  abstract tableName: string;

  /**
   * Fetches existing rows from the underlying storage and populates the `rows` map.
   * This method should be called during initialization to load existing data into memory.
   * Implementations should ensure that the `rows` map is fully populated with all existing rows after this method resolves.
   */
  abstract fetchExistingRows(): Promise<void>;
  /**
   * Creates a new row instance with the provided data. The ID can be auto-generated or specified in the data.
   * @param data - The data for the new row, which may include an optional 'id' field
   * @returns A new instance of RowType with the provided data
   */
  abstract createRow(data?: Partial<RowType>): RowType;
  /**
   * Inserts a new row into the table. The row must have a unique ID that does not already exist in the table.
   * @param row - The row to insert into the table
   * @returns A promise that resolves when the insertion is complete
   */
  abstract insertRow(row: RowType): Promise<void>;
  /**
   * Retrieves a row by its unique identifier. Returns undefined if the row does not exist.
   * @param id - The unique identifier of the row to retrieve
   * @returns A promise that resolves to the row if found, or undefined if not found
   */
  abstract getRow(id: string): Promise<RowType | undefined>;
  /**
   * Updates an existing row in the table. The row must already exist, and the ID cannot be changed.
   * @param row - The row with updated data. The ID must match an existing row.
   * @returns A promise that resolves when the update is complete
   */
  abstract updateRow(row: RowType): Promise<void>;
  /**
   * Deletes a row from the table by its ID. After deletion, the row should no longer be retrievable.
   * @param id - The unique identifier of the row to delete
   * @returns A promise that resolves when the deletion is complete
   */
  abstract deleteRow(id: string): Promise<void>;
  /**
   * Lists rows in the table based on the provided query parameters.
   * @param query - The query parameters for pagination and filtering
   * @returns A promise that resolves to a QueryResult containing the rows and pagination info
   */
  abstract listRows(query: QueryParams): Promise<QueryResult<RowType>>;

  /**
   * Returns a summary of the table data, including row count and names
   * @returns A ShortTableData object containing the table name, row count, and row names
   */
  abstract getShortData(): ShortTableData;
  /**
   * Returns the full data of the table, including all rows and their contents
   * @returns A FullTableData object containing the table name and all rows
   */
  abstract getFullData(): FullTableData;
}

/**
 * A simplified representation of a table, used for listing tables without full row data
 */
export type ShortTableData = {
  /** The name of the table */
  tableName: string;
  /** The total number of rows in the table */
  rowCount: number;
  /** An array of row names (IDs) in the table */
  rowNames: string[];
};

/**
 * A complete representation of a table, including all rows and their data. Used for syncing table data.
 */
export type FullTableData = {
  /** The name of the table */
  tableName: string;
  /** An array of all rows in the table, with their IDs and data */
  rows: Record<string, unknown>[];
};

/** A base class for managing database operations, including tables and rows */
export abstract class BaseDatabaseManager<
  RowType extends BaseRow,
  TableType extends BaseTable<RowType>
> {
  /** The tables managed by this database manager, indexed by their name */
  readonly tables: Map<string, TableType> = new Map();

  /**
   * Connects to the database and initializes any necessary resources.
   * After this method resolves, the database manager should be ready to perform operations.
   */
  abstract connect(): Promise<void>;
  /**
   * Disconnects from the database and cleans up any resources.
   * After this method resolves, the database manager should no longer be operational until `connect()` is called again.
   */
  abstract disconnect(): Promise<void>;
  /**
   * Checks if the database manager is currently connected to the database.
   * @returns A boolean indicating the connection status
   */
  abstract isConnected(): boolean;

  /**
   * Fetches the existing tables from the database and updates the internal state.
   */
  abstract fetchExistingTables(): Promise<void>;
  /**
   *  Creates a new table with the specified name. The table must have a unique name that does not already exist in the database.
   * @param name - The name of the new table to create
   * @returns An instance of TableType representing the newly created table
   */
  abstract createTable(name: string): TableType;
  /**
   * Retrieves a table by its name.
   * @param name - The name of the table to retrieve
   * @returns An instance of TableType if the table exists, otherwise undefined
   */
  abstract getTable(name: string): TableType | undefined;
  /**
   * Deletes a table by its name.
   * @param name - The name of the table to delete
   */
  abstract deleteTable(name: string): void;
  /**
   * Lists tables in the database based on the provided query parameters.
   * @param query - The query parameters for pagination and filtering
   * @returns A QueryResult containing ShortTableData for each table and pagination info
   */
  abstract listTables(query: QueryParams): QueryResult<ShortTableData>;
}
