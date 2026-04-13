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
  analysisSections: { title: string; content: string }[] | null;
  mentionedProducts: { name: string; slug?: string; reason: string }[] | null;
  status: string;
  publishedAt: string | null;
  createdAt: string | null;
};

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
  return (data ?? []) as ExpertPickRow[];
}

/**
 * Get a single expert pick by slug.
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
  return data as ExpertPickRow;
}

/**
 * List all expert picks for admin (any status).
 */
export async function listAllExpertPicks(): Promise<ExpertPickRow[]> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("expert_picks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[expert-picks] list all error:", error.message);
    return [];
  }
  return (data ?? []) as ExpertPickRow[];
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

  // 4. Generate slug & thumbnail
  const slug = slugifyTitle(analysis.title);
  const thumbnailUrl = getYoutubeThumbnail(videoId);

  // 5. Save to DB
  const supabase = await createAdminClient();
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
      summary: analysis.summary,
      key_takeaways: analysis.keyTakeaways,
      analysis_sections: analysis.analysisSections,
      mentioned_products: analysis.mentionedProducts,
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
