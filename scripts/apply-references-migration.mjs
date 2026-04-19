// Apply migration 013_medication_references via direct postgres connection.
import postgres from "postgres";
import { readFileSync } from "node:fs";

const envText = readFileSync(".env.local", "utf8");
const pick = (k) => {
  const m = envText.match(new RegExp(`^${k}=(.+)$`, "m"));
  if (!m) throw new Error(`Missing ${k}`);
  return m[1].trim();
};

const dbUrl = pick("DATABASE_URL");
const sql = postgres(dbUrl, { ssl: "require" });

try {
  await sql`
    alter table public.medications
      add column if not exists references_jsonb jsonb
  `;
  await sql`
    comment on column public.medications.references_jsonb is
      'Array<ArticleReference> — FDA DailyMed + PubMed citations rendered in Research & References section on /analysis/[slug].'
  `;
  console.log("ok — references_jsonb column added to medications");
} catch (e) {
  console.error("migration failed:", e.message);
  process.exit(1);
} finally {
  await sql.end();
}
