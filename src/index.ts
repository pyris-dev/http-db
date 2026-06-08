import { serve } from "bun";
import { AppRouteHandlers } from "./routes/index.js";
import { loadConfig, type Config } from "./config.js";
import { getDatabaseManagerClass } from "./database/index.js";
import { Logger, printLogHeader } from "./logger.js";

const StartupLogger = new Logger("STARTUP");

// Initialized during startup in main IIFE.
export let config: Config;
export let dbManager: ReturnType<typeof getDatabaseManagerClass>;

function getDatabaseConnectionSummary(): string {
  if (config.DATABASE_TYPE === "embedded")
    return `type=${config.DATABASE_PLATFORM} file=${config.DATABASE_NAME ?? "<unknown>"}`;

  const host = config.DATABASE_HOST ?? "localhost";
  const port = config.DATABASE_PORT ? `:${config.DATABASE_PORT}` : "";
  return `type=${config.DATABASE_PLATFORM} url=${config.DATABASE_PLATFORM}://${host}${port}`;
}

async function waitForInputBeforeExit(exitCode: number): Promise<never> {
  if (!process.stdin.isTTY) process.exit(exitCode);

  StartupLogger.error("Press Enter to exit.");
  process.stdin.resume();
  await new Promise<void>((resolve) =>
    process.stdin.once("data", () => resolve())
  );
  process.exit(exitCode);
}

(async () => {
  try {
    const loadedConfig = loadConfig();
    if (loadedConfig === null) return await waitForInputBeforeExit(1);

    config = loadedConfig;
    dbManager = getDatabaseManagerClass(config);

    printLogHeader();
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
    await waitForInputBeforeExit(1);
  }
})();
