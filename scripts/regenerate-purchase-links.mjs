/**
 * Regenerate Amazon purchase links with improved accuracy.
 * Uses quoted exact-match + i=hpc (Health & Household category).
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://rlemyrdivdwibooxbugq.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsZW15cmRpdmR3aWJvb3hidWdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTgxMjk2MCwiZXhwIjoyMDkxMzg4OTYwfQ.CKh85hitF_gYVHrEBy--NGlkbwsBJQL9y8Eh-yzfHOk";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function exactMatchQuery(name) {
  return (
    '"' +
    name
      .replace(/\b(the|extra strength|maximum|ultra|original)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim() +
    '"'
  );
}

async function main() {
  // Get Amazon retailer id
  const { data: retailer } = await supabase
    .from("retailers")
    .select("id, slug")
    .eq("slug", "amazon")
    .single();

  if (!retailer) {
    console.error("Amazon retailer not found");
    return;
  }

  // Get all Amazon purchase links with their product names
  const { data: links } = await supabase
    .from("product_purchase_links")
    .select("id, medication_id, url, medications(name)")
    .eq("retailer_id", retailer.id);

  console.log(`Updating ${links.length} Amazon links...`);

  let updated = 0;
  for (const link of links) {
    const name = link.medications?.name;
    if (!name) continue;

    const newUrl = `https://www.amazon.com/s?k=${encodeURIComponent(exactMatchQuery(name))}&i=hpc`;

    if (link.url !== newUrl) {
      const { error } = await supabase
        .from("product_purchase_links")
        .update({ url: newUrl })
        .eq("id", link.id);

      if (!error) updated++;
    }
  }

  console.log(`Done. Updated ${updated} Amazon links.`);
}

main();
