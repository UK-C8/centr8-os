import { defineConfig } from "drizzle-kit";

// Migrations run against the direct (non-pooled) connection.
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.NEON_DIRECT_URL!,
  },
});
