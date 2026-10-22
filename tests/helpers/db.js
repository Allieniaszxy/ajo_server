import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { beforeAll, afterAll, afterEach } from "vitest";

/** Call once at the top of any test file that needs the database. */
export function useTestDb() {
  let replSet;

  beforeAll(async () => {
    // Fallback: a dedicated test database on Atlas (see below)
    let uri = process.env.TEST_MONGO_URI;
    if (!uri) {
      replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
      uri = replSet.getUri();
    }
    await mongoose.connect(uri);

    // These tests delete every document, so never let them near real data
    if (
      process.env.TEST_MONGO_URI &&
      !mongoose.connection.name.endsWith("_test")
    ) {
      throw new Error(
        "Refusing to run tests against a database not named *_test",
      );
    }

    // Build unique indexes and collections up front (transactions can't create collections)
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  }, 300_000); // generous: the first run downloads the MongoDB binary

  afterEach(async () => {
    for (const c of Object.values(mongoose.connection.collections))
      await c.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replSet?.stop(); // optional chaining: safe if startup failed
  });
}
