import type { Config } from "../config.js";
import type { BaseDatabaseManager, BaseRow, BaseTable } from "./base.js";
import { BaseRow } from "./base.js";
import { SqliteDatabaseManager } from "./sqlite.js";

export function getDatabaseManagerClass(
  config: Config
): BaseDatabaseManager<BaseRow, BaseTable<BaseRow>> {
  switch (config.DATABASE_PLATFORM) {
    case "mongodb":
      // return new MongoDatabaseManager();
      throw new Error(`MongoDB support not yet implemented`);
    case "mysql":
      // return new MySQLDatabaseManager();
      throw new Error(`MySQL support not yet implemented`);
    case "sqlite":
      return new SqliteDatabaseManager(config.DATABASE_NAME!, BaseRow);
    default:
      throw new Error(`Unsupported database platform: ${config.DATABASE_TYPE}`);
  }
}
