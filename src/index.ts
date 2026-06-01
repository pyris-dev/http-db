import "./routes/index.js";

import { serve } from "bun";
import { AppRouteHandlers } from "./routes/index.js";
import { loadConfig } from "./config.js";
import { getDatabaseManagerClass } from "./database/index.js";

// Load configuration
export const config = loadConfig();

// The DB manager instance
export const dbManager = getDatabaseManagerClass(config);

(async () => {
  console.log("Connecting to database...");

  // Connect to the database
  await dbManager.connect();

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

  console.log(`Server running at ${server.url}`);
})();
