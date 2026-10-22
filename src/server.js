import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDB, disconnectDB } from "./config/db.js";

let server;
let shuttingDown = false;

async function start() {
  await connectDB(); // no point listening without a database
  server = app.listen(env.PORT, () => {
    logger.info(`Ajo API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
  // Must exceed the load balancer's idle timeout (Nginx default is 60s),
  // or you get sporadic 502s from reused connections being closed.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
}

async function shutdown(reason, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ reason }, "Shutting down");

  // Safety net: never hang forever
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();

  try {
    if (server) {
      // Stop accepting new requests, let in-flight ones finish
      await new Promise((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
    }
    await disconnectDB();
    process.exit(exitCode);
  } catch (err) {
    logger.error({ err }, "Error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (err) => {
  logger.fatal({ err }, "Unhandled promise rejection");
  shutdown("unhandledRejection", 1);
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  shutdown("uncaughtException", 1);
});

start().catch((err) => {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
});
