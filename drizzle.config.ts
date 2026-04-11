import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./supabase/migrations",
  schema: "./src/lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    host: "db.rlemyrdivdwibooxbugq.supabase.co",
    port: 5432,
    user: "postgres",
    password: process.env.DB_PASSWORD!,
    database: "postgres",
    ssl: "require",
  },
});
