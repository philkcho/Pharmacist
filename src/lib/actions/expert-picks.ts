"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import {
  extractYoutubeId,
  fetchTranscript,
  getYoutubeThumbnail,
  slugifyTitle,
} from "@/lib/youtube/transcript";
import { analyzeExpertVideo } from "@/lib/ai/analyze-expert-video";

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
  const { error } = await supabase
    .from("expert_picks")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("[expert-picks] publish error:", error.message);
    return false;
  }

  revalidatePath("/");
  revalidatePath("/expert");
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
