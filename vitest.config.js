import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false, // database tests share one instance
    env: {
      NODE_ENV: "test",
      CLIENT_URL: "http://localhost:5173",
      MONGO_URI:
        "mongodb+srv://alakaalamin_db_user:Prometheus40@cluster0.u1tehbo.mongodb.net/ajo_test?retryWrites=true&w=majority", // satisfies validation; tests connect elsewhere
      JWT_ACCESS_SECRET: "a".repeat(64),
      JWT_REFRESH_SECRET: "b".repeat(64),
    },
  },
});
