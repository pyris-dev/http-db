import "./routes/index.js";

import { serve } from "bun";
import { AppRouteHandlers } from "./routes/index.js";
import { loadConfig } from "./config.js";
import { getDatabaseManagerClass } from "./database/index.js";
import { Logger, printLogHeader } from "./logger.js";

const StartupLogger = new Logger("STARTUP");

printLogHeader();

// Initialized during startup in main IIFE.
export let config: ReturnType<typeof loadConfig>;
export let dbManager: ReturnType<typeof getDatabaseManagerClass>;

function getDatabaseConnectionSummary(): string {
  if (config.DATABASE_TYPE === "embedded")
    return `type=${config.DATABASE_PLATFORM} file=${config.DATABASE_NAME ?? "<unknown>"}`;

  const host = config.DATABASE_HOST ?? "localhost";
  const port = config.DATABASE_PORT ? `:${config.DATABASE_PORT}` : "";
  return `type=${config.DATABASE_PLATFORM} url=${config.DATABASE_PLATFORM}://${host}${port}`;
}

async function keepProcessOpenOnFatalError(): Promise<never> {
  StartupLogger.error("Fatal startup error. Press Ctrl+C to exit.");
  if (process.stdin.isTTY) process.stdin.resume();

  setInterval(
    () => {
      // Keep the process alive so startup errors remain visible in standalone execution.
    },
    60 * 60 * 1000
  );

  return await new Promise<never>(() => {});
}

(async () => {
  try {
    config = loadConfig();
    dbManager = getDatabaseManagerClass(config);

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
    await keepProcessOpenOnFatalError();
  }
})();
