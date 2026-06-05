import "./routes/index.js";

import { serve } from "bun";
import { AppRouteHandlers } from "./routes/index.js";
import { loadConfig } from "./config.js";
import { getDatabaseManagerClass } from "./database/index.js";
import { Logger, printLogHeader } from "./logger.js";

const StartupLogger = new Logger("STARTUP");

printLogHeader();

// Load configuration
export const config = loadConfig();

// The DB manager instance
export const dbManager = getDatabaseManagerClass(config);

function getDatabaseConnectionSummary(): string {
  if (config.DATABASE_TYPE === "embedded")
    return `type=${config.DATABASE_PLATFORM} file=${config.DATABASE_NAME ?? "<unknown>"}`;

  const host = config.DATABASE_HOST ?? "localhost";
  const port = config.DATABASE_PORT ? `:${config.DATABASE_PORT}` : "";
  return `type=${config.DATABASE_PLATFORM} url=${config.DATABASE_PLATFORM}://${host}${port}`;
}

(async () => {
  try {
    StartupLogger.info("Connecting to database");

    // Connect to the database
    await dbManager.connect();
    StartupLogger.info(
      `Database connected (${getDatabaseConnectionSummary()})`
    );

    // The server instance
    const server = serve({
      hostname: config.HOST ?? "0.0.0.0",
      port: config.PORT,
      routes: {
        ...AppRouteHandlers
      },
      maxRequestBodySize: config.MAX_REQUEST_BODY_SIZE ?? 10 * 1024 * 1024, // 10 MB
      idleTimeout: config.IDLE_TIMEOUT ?? 15, // 15 seconds
      tls: config.TLS_ENABLED
        ? {
            cert: Bun.file(config.TLS_CERT_PATH!),
            key: Bun.file(config.TLS_KEY_PATH!)
          }
        : {}
    });

    StartupLogger.info(`Server running at ${server.url}`);
  } catch (error) {
    StartupLogger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
})();
