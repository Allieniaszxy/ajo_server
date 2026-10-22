import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

mongoose.set("strictQuery", true);

let listenersAttached = false;

export async function connectDB() {
  if (!listenersAttached) {
    mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
    mongoose.connection.on("disconnected", () =>
      logger.warn("MongoDB disconnected"),
    );
    mongoose.connection.on("error", (err) =>
      logger.error({ err }, "MongoDB error"),
    );
    listenersAttached = true;
  }

  await mongoose.connect(env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000, // fail fast if the DB is unreachable
    // Each API instance has its own pool, so total connections =
    // instances x maxPoolSize. Keep this in mind when scaling out.
    maxPoolSize: 20,
    // Build indexes automatically in dev; manage them deliberately in production
    autoIndex: env.NODE_ENV !== "production",
  });
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
