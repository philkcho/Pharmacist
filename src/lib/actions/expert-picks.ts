"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { submitToIndexNow } from "@/lib/seo/indexnow";
import {
  extractYoutubeId,
  fetchTranscript,
  getYoutubeThumbnail,
  slugifyTitle,
} from "@/lib/youtube/transcript";
import { analyzeExpertVideo } from "@/lib/ai/analyze-expert-video";
import type { ArticleReference } from "@/lib/references/fetch-references";
import {
  generateExpertComparison,
  type ExpertComparison,
  type ExpertComparisonProduct,
} from "@/lib/ai/generate-expert-comparison";

export type ExpertPickRow = {
  id: number;
  slug: string;
  youtubeUrl: string;
  youtubeId: string;
  title: string;
  expertName: string;
  expertCredential: string | null;
  thumbnailUrl: string | null;
  duration: string | null;
  category: string;
  summary: string | null;
  keyTakeaways: string[] | null;
  cleanTranscript?: string | null;
  properNotes?: { heading: string; bullets: string[] }[] | null;
  analysisSections: { title: string; content: string }[] | null;
  mentionedProducts:
    | {
        name: string;
        slug?: string;
        reason: string;
        shopKeyword?: string;
        imageUrl?: string | null;
      }[]
    | null;
  references?: ArticleReference[] | null;
  comparison?: ExpertComparison | null;
  status: string;
  publishedAt: string | null;
  createdAt: string | null;
};

/**
 * Map DB snake_case row to ExpertPickRow camelCase shape.
 */
function mapRow(row: Record<string, unknown>): ExpertPickRow {
  return {
    id: row.id as number,
    slug: row.slug as string,
    youtubeUrl: row.youtube_url as string,
    youtubeId: row.youtube_id as string,
    title: row.title as string,
    expertName: row.expert_name as string,
    expertCredential: (row.expert_credential as string | null) ?? null,
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    duration: (row.duration as string | null) ?? null,
    category: row.category as string,
    summary: (row.summary as string | null) ?? null,
    keyTakeaways: (row.key_takeaways as string[] | null) ?? null,
    cleanTranscript: (row.clean_transcript as string | null) ?? null,
    properNotes:
      (row.proper_notes as { heading: string; bullets: string[] }[] | null) ??
      null,
    analysisSections:
      (row.analysis_sections as
        | { title: string; content: string }[]
        | null) ?? null,
    mentionedProducts:
      (row.mentioned_products as
        | {
            name: string;
            slug?: string;
            reason: string;
            shopKeyword?: string;
            imageUrl?: string | null;
          }[]
        | null) ?? null,
    references: Array.isArray(row.references_jsonb)
      ? (row.references_jsonb as ArticleReference[])
      : null,
    comparison:
      (row.comparison_jsonb as ExpertComparison | null) ?? null,
    status: row.status as string,
    publishedAt: (row.published_at as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
  };
}

/**
 * List published expert picks for public pages.
 */
export async function listPublishedExpertPicks(
  limit = 3
): Promise<ExpertPickRow[]> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("expert_picks")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[expert-picks] list error:", error.message);
    return [];
  }
  return (data ?? []).map(mapRow);
}

/**
 * Get a single expert pick by slug, with mentionedProducts' imageUrl
 * refreshed from the medications table (the source of truth).
 * The JSON-stored imageUrl is kept as a fallback if the lookup fails.
 */
export async function getExpertPickBySlug(
  slug: string
): Promise<ExpertPickRow | null> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("expert_picks")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    console.error("[expert-picks] get error:", error.message);
    return null;
  }
  const pick = mapRow(data);

  // Pull latest image_url from medications for each mentioned product.
  // Keeps the detail page in sync with admin image refreshes without
  // rewriting the expert_picks JSON.
  if (pick.mentionedProducts && pick.mentionedProducts.length > 0) {
    const slugs = pick.mentionedProducts
      .map((p) => p.slug)
      .filter((s): s is string => !!s);

    if (slugs.length > 0) {
      const { data: meds } = await supabase
        .from("medications")
        .select("slug, image_url")
        .in("slug", slugs);

      if (meds && meds.length > 0) {
        const imageBySlug = new Map<string, string | null>();
        for (const m of meds) {
          imageBySlug.set(m.slug as string, (m.image_url as string | null) ?? null);
        }
        pick.mentionedProducts = pick.mentionedProducts.map((p) => ({
          ...p,
          imageUrl: p.slug
            ? imageBySlug.get(p.slug) ?? p.imageUrl ?? null
            : p.imageUrl ?? null,
        }));
      }
    }
  }

  return pick;
}

/**
 * List all expert picks for admin (any status).
 */
export async function listAllExpertPicks(): Promise<ExpertPickRow[]> {
  const supabase = await createAdminClient();
  // 최근 발행한 것을 맨 앞으로. published_at 이 없는 draft는 뒤에,
  // 그 안에서는 created_at 최신순.
  const { data, error } = await supabase
    .from("expert_picks")
    .select("*")
    .order("published_at", { ascending: false });

  if (error) {
    console.error("[expert-picks] list all error:", error.message);
    return [];
  }
  return (data ?? []).map(mapRow);
}

/**
 * Create an expert pick from a YouTube URL.
 * Fetches transcript, runs AI analysis, saves as draft.
 */
export async function createExpertPick(youtubeUrl: string): Promise<{
  success: boolean;
  id?: number;
  error?: string;
}> {
  // 1. Extract video ID
  const videoId = extractYoutubeId(youtubeUrl);
  if (!videoId) {
    return { success: false, error: "Invalid YouTube URL" };
  }

  // 2. Fetch transcript
  let transcript: string;
  try {
    transcript = await fetchTranscript(videoId);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("[expert-picks] transcript error:", errMsg);
    return {
      success: false,
      error: `Could not fetch transcript: ${errMsg}`,
    };
  }

  if (!transcript || transcript.length < 100) {
    return { success: false, error: "Transcript too short or empty." };
  }

  // 3. AI analysis
  let analysis;
  try {
    analysis = await analyzeExpertVideo(transcript);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("[expert-picks] AI analysis error:", errMsg);
    return { success: false, error: `AI analysis failed: ${errMsg}` };
  }

  // 4. Generate slug & cover image
  const slug = slugifyTitle(analysis.title);

  // Try AI-generated cover image first (article style).
  // Fall back to YouTube thumbnail if generation fails.
  let sourceThumbnailUrl: string;
  try {
    const { generateTrendImageUrl } = await import(
      "@/lib/ai/generate-trend-image"
    );
    sourceThumbnailUrl = await generateTrendImageUrl(
      analysis.title,
      analysis.category,
      analysis.title
    );
  } catch {
    sourceThumbnailUrl = getYoutubeThumbnail(videoId);
  }

  // Persist to Supabase Storage so subsequent renders hit our CDN instead
  // of Pollinations (slow, uncached) — this is the hero image and drives
  // LCP on /expert/[slug]. Falls back to the source URL on any failure.
  const { persistThumbnailToStorage } = await import(
    "@/lib/images/persist-thumbnail"
  );
  const { url: thumbnailUrl } = await persistThumbnailToStorage(
    sourceThumbnailUrl,
    slug
  );

  // 4.5. Ensure every mentioned product exists in DB with image + analysis
  // so the /expert/[slug] page never shows blank product cards.
  const enrichedProducts: {
    name: string;
    slug?: string;
    reason: string;
    shopKeyword?: string;
    imageUrl?: string | null;
  }[] = [];
  const supabase = await createAdminClient();
  for (const product of analysis.mentionedProducts) {
    try {
      const { ensureProductComplete } = await import("@/lib/actions/ensure-product-complete");
      const ensured = await ensureProductComplete({
        name: product.name,
        categorySlug: analysis.category,
      });

      if (!ensured) {
        console.log(`[expert-picks] Skipping "${product.name}" — ensureProductComplete returned null`);
        continue;
      }

      // Only include products that have purchase links (Amazon/iHerb)
      const { data: links } = await supabase
        .from("product_purchase_links")
        .select("id")
        .eq("medication_id", ensured.id)
        .eq("is_active", true)
        .limit(1);

      if (!links || links.length === 0) {
        console.log(`[expert-picks] Skipping "${product.name}" — no purchase links (not on Amazon/iHerb)`);
        continue;
      }

      enrichedProducts.push({
        name: product.name,
        slug: ensured.slug,
        reason: product.reason,
        shopKeyword: product.shopKeyword,
        imageUrl: ensured.imageUrl ?? null,
      });
    } catch (err) {
      console.warn(
        "[expert-picks] ensureProductComplete failed for",
        product.name,
        err instanceof Error ? err.message : err
      );
      // Skip products that fail enrichment — no purchase link = no display
    }
  }

  console.log(
    `[expert-picks] ${analysis.mentionedProducts.length} products extracted → ${enrichedProducts.length} with purchase links`
  );

  // 4.9. Fetch FDA + PubMed references using the branded products as
  // drug terms and the article title as the PubMed primary term.
  // Independent-research voice rule still applies — no link back to
  // the original video; these are public regulator/peer-review sources.
  let references: ArticleReference[] = [];
  try {
    const { fetchArticleReferences, extractLikelyIngredient } = await import(
      "@/lib/references/fetch-references"
    );
    const drugTerms = Array.from(
      new Set(enrichedProducts.map((p) => p.name).filter(Boolean))
    );
    const primaryTerm =
      extractLikelyIngredient(analysis.title) ??
      extractLikelyIngredient(analysis.summary ?? "") ??
      analysis.title;
    references = await fetchArticleReferences({
      primaryTerm,
      fallbackTerms: [analysis.title, analysis.category],
      drugTerms,
      limit: 6,
    });
  } catch (err) {
    console.warn(
      "[expert-picks] references fetch failed:",
      err instanceof Error ? err.message : err
    );
  }

  // 4.95. Pre-generate "Products at a Glance" comparison so draft
  // reviewers see it immediately in admin. Failures fall through —
  // the public page will lazy-generate on first view.
  let comparison: ExpertComparison | null = null;
  const enrichedSlugs = enrichedProducts
    .map((p) => p.slug)
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .slice(0, 5);
  if (enrichedSlugs.length >= 2) {
    try {
      const comparisonProducts = await fetchComparisonProducts(enrichedSlugs);
      if (comparisonProducts.length >= 2) {
        comparison = await generateExpertComparison({
          articleTitle: analysis.title,
          articleCategory: analysis.category,
          products: comparisonProducts.map(stripImageUrl),
        });
      }
    } catch (err) {
      console.warn(
        "[expert-picks] comparison pre-gen failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  // 5. Save to DB
  const { data, error } = await supabase
    .from("expert_picks")
    .insert({
      slug,
      youtube_url: youtubeUrl,
      youtube_id: videoId,
      title: analysis.title,
      expert_name: analysis.expertName,
      expert_credential: analysis.expertCredential,
      thumbnail_url: thumbnailUrl,
      category: analysis.category,
      transcript,
      clean_transcript: analysis.cleanTranscript,
      summary: analysis.summary,
      key_takeaways: analysis.keyTakeaways,
      proper_notes: analysis.properNotes,
      analysis_sections: analysis.analysisSections,
      mentioned_products: enrichedProducts,
      references_jsonb: references,
      comparison_jsonb: comparison,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[expert-picks] insert error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/expert");
  return { success: true, id: data.id };
}

/**
 * Publish a draft expert pick.
 */
export async function publishExpertPick(id: number): Promise<boolean> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("expert_picks")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("slug")
    .maybeSingle();

  if (error) {
    console.error("[expert-picks] publish error:", error.message);
    return false;
  }

  revalidatePath("/");
  revalidatePath("/expert");
  if (data?.slug) {
    revalidatePath(`/expert/${data.slug}`);
    void submitToIndexNow([`/expert/${data.slug}`]);
  }
  return true;
}

/**
 * Unpublish (revert to draft).
 */
export async function unpublishExpertPick(id: number): Promise<boolean> {
  const supabase = await createAdminClient();
  const { error } = await supabase
    .from("expert_picks")
    .update({ status: "draft", published_at: null })
    .eq("id", id);

  if (error) return false;

  revalidatePath("/");
  revalidatePath("/expert");
  return true;
}

/**
 * Delete an expert pick.
 */
export async function deleteExpertPick(id: number): Promise<boolean> {
  const supabase = await createAdminClient();
  const { error } = await supabase
    .from("expert_picks")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[expert-picks] delete error:", error.message);
    return false;
  }

  revalidatePath("/");
  revalidatePath("/expert");
  return true;
}

/**
 * Regenerate AI cover image for all expert picks based on title/category.
 * Uses Pollinations.ai — free, no API key required.
 */
export async function regenerateExpertPickImages(): Promise<{
  success: boolean;
  updated: number;
  errors: number;
  message: string;
}> {
  const { generateTrendImageUrl } = await import(
    "@/lib/ai/generate-trend-image"
  );
  const supabase = await createAdminClient();

  const { data: picks, error: fetchError } = await supabase
    .from("expert_picks")
    .select("id, title, category");

  if (fetchError) {
    return {
      success: false,
      updated: 0,
      errors: 0,
      message: fetchError.message,
    };
  }

  if (!picks || picks.length === 0) {
    return {
      success: true,
      updated: 0,
      errors: 0,
      message: "No expert picks found.",
    };
  }

  let updated = 0;
  let errors = 0;

  for (const pick of picks) {
    try {
      const imageUrl = await generateTrendImageUrl(
        pick.title as string,
        pick.category as string,
        pick.title as string
      );

      const { error: updateError } = await supabase
        .from("expert_picks")
        .update({ thumbnail_url: imageUrl })
        .eq("id", pick.id as number);

      if (updateError) {
        console.error(
          `[expert-picks] image update failed for ${pick.id}:`,
          updateError.message
        );
        errors++;
      } else {
        updated++;
      }
    } catch (e) {
      console.error(
        `[expert-picks] image generation failed for ${pick.id}:`,
        e instanceof Error ? e.message : e
      );
      errors++;
    }
  }

  revalidatePath("/");
  revalidatePath("/expert");
  revalidatePath("/expert-picks");

  return {
    success: true,
    updated,
    errors,
    message: `Regenerated ${updated} images${errors > 0 ? ` (${errors} errors)` : ""}`,
  };
}

// ─── Products at a Glance — N-product comparison ──────────────────

/**
 * Product data shape needed by the <ProductsAtAGlance> UI component.
 * Superset of ExpertComparisonProduct — adds imageUrl for the thumbnail row.
 */
export type ComparisonProductCard = ExpertComparisonProduct & {
  imageUrl: string | null;
};

/** Drop imageUrl to match ExpertComparisonProduct shape expected by the AI generator. */
function stripImageUrl(p: ComparisonProductCard): ExpertComparisonProduct {
  return {
    slug: p.slug,
    name: p.name,
    genericName: p.genericName,
    productType: p.productType,
    ingredients: p.ingredients,
    pros: p.pros,
    cons: p.cons,
    verdict: p.verdict,
    priceRange: p.priceRange,
  };
}

/**
 * Pull enriched medications rows for a list of slugs. Preserves slug order.
 * Used by /expert/[slug] page to render the comparison UI and by the
 * AI generator to build its input.
 */
export async function fetchComparisonProducts(
  slugs: string[]
): Promise<ComparisonProductCard[]> {
  if (slugs.length === 0) return [];
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from("medications")
    .select(
      "slug, name, generic_name, product_type, ingredient_analysis, pros, cons, verdict, price_range, image_url, approval_status"
    )
    .in("slug", slugs);

  if (error) {
    console.error("[expert-picks] fetchComparisonProducts error:", error.message);
    return [];
  }

  const bySlug = new Map<string, Record<string, unknown>>();
  for (const row of data ?? []) {
    bySlug.set(row.slug as string, row);
  }

  // Preserve input order; silently drop slugs that aren't in the DB.
  const results: ComparisonProductCard[] = [];
  for (const slug of slugs) {
    const row = bySlug.get(slug);
    if (!row) continue;
    results.push(mapMedRowToComparisonCard(row));
  }
  return results;
}

function mapMedRowToComparisonCard(
  row: Record<string, unknown>
): ComparisonProductCard {
  const rawIngredients = row.ingredient_analysis;
  const ingredients: Array<{ name: string; purpose?: string }> = [];
  if (Array.isArray(rawIngredients)) {
    for (const entry of rawIngredients as Array<Record<string, unknown>>) {
      const name = typeof entry.name === "string" ? entry.name : null;
      if (!name) continue;
      const purpose =
        typeof entry.purpose === "string" ? entry.purpose : undefined;
      ingredients.push(purpose ? { name, purpose } : { name });
    }
  }

  const prosRaw = row.pros;
  const consRaw = row.cons;
  const pros: string[] = Array.isArray(prosRaw)
    ? (prosRaw as Array<unknown>)
        .map((p) =>
          typeof p === "string"
            ? p
            : typeof p === "object" &&
                p !== null &&
                "text" in p &&
                typeof (p as { text: unknown }).text === "string"
              ? (p as { text: string }).text
              : null
        )
        .filter((v): v is string => !!v)
    : [];
  const cons: string[] = Array.isArray(consRaw)
    ? (consRaw as Array<unknown>)
        .map((c) =>
          typeof c === "string"
            ? c
            : typeof c === "object" &&
                c !== null &&
                "text" in c &&
                typeof (c as { text: unknown }).text === "string"
              ? (c as { text: string }).text
              : null
        )
        .filter((v): v is string => !!v)
    : [];

  return {
    slug: row.slug as string,
    name: row.name as string,
    genericName: (row.generic_name as string | null) ?? null,
    productType: (row.product_type as string) ?? "supplement",
    ingredients,
    pros,
    cons,
    verdict: (row.verdict as string | null) ?? null,
    priceRange: (row.price_range as string | null) ?? null,
    imageUrl: (row.image_url as string | null) ?? null,
  };
}

/**
 * Lazy lookup + generation. Returns cached comparison if present, otherwise
 * calls Gemini and writes the result back to expert_picks.comparison_jsonb.
 *
 * Returns null (section hidden) when:
 *   - the pick has < 2 mentioned products, or
 *   - the DB lookup fails, or
 *   - the AI call fails (logs a warning, does not throw)
 */
export async function getOrGenerateExpertComparison(
  pickSlug: string
): Promise<ExpertComparison | null> {
  const supabase = await createAdminClient();

  const { data: pickRow, error: pickErr } = await supabase
    .from("expert_picks")
    .select("id, title, category, mentioned_products, comparison_jsonb, status")
    .eq("slug", pickSlug)
    .single();

  if (pickErr || !pickRow) {
    return null;
  }

  // Cache hit — return as-is.
  if (pickRow.comparison_jsonb) {
    return pickRow.comparison_jsonb as ExpertComparison;
  }

  const mentioned = Array.isArray(pickRow.mentioned_products)
    ? (pickRow.mentioned_products as Array<{ slug?: string; name: string }>)
    : [];
  const slugs = mentioned
    .map((m) => m.slug)
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .slice(0, 5);

  if (slugs.length < 2) return null;

  const products = await fetchComparisonProducts(slugs);
  if (products.length < 2) return null;

  let comparison: ExpertComparison;
  try {
    comparison = await generateExpertComparison({
      articleTitle: pickRow.title as string,
      articleCategory: pickRow.category as string,
      products: products.map(stripImageUrl),
    });
  } catch (err) {
    console.warn(
      "[expert-picks] comparison generation failed:",
      err instanceof Error ? err.message : err
    );
    return null;
  }

  // Persist — best effort, ignore write errors.
  const { error: updateErr } = await supabase
    .from("expert_picks")
    .update({ comparison_jsonb: comparison })
    .eq("id", pickRow.id as number);

  if (updateErr) {
    console.warn(
      "[expert-picks] comparison cache write failed:",
      updateErr.message
    );
  }

  return comparison;
}

/**
 * Force-regenerate comparison for a single expert pick (admin trigger).
 * Ignores existing cache.
 */
export async function regenerateExpertComparison(
  pickId: number
): Promise<boolean> {
  const supabase = await createAdminClient();

  const { data: pickRow, error: pickErr } = await supabase
    .from("expert_picks")
    .select("slug, title, category, mentioned_products")
    .eq("id", pickId)
    .single();

  if (pickErr || !pickRow) {
    console.error(
      "[expert-picks] regenerate lookup failed:",
      pickErr?.message ?? "not found"
    );
    return false;
  }

  const mentioned = Array.isArray(pickRow.mentioned_products)
    ? (pickRow.mentioned_products as Array<{ slug?: string; name: string }>)
    : [];
  const slugs = mentioned
    .map((m) => m.slug)
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .slice(0, 5);

  if (slugs.length < 2) return false;

  const products = await fetchComparisonProducts(slugs);
  if (products.length < 2) return false;

  let comparison: ExpertComparison;
  try {
    comparison = await generateExpertComparison({
      articleTitle: pickRow.title as string,
      articleCategory: pickRow.category as string,
      products: products.map(stripImageUrl),
    });
  } catch (err) {
    console.error(
      "[expert-picks] regenerate AI failed:",
      err instanceof Error ? err.message : err
    );
    return false;
  }

  const { error: updateErr } = await supabase
    .from("expert_picks")
    .update({ comparison_jsonb: comparison })
    .eq("id", pickId);

  if (updateErr) {
    console.error(
      "[expert-picks] regenerate write failed:",
      updateErr.message
    );
    return false;
  }

  revalidatePath(`/expert/${pickRow.slug}`);
  return true;
}
