import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  FileWarning,
  ExternalLink,
  Calendar,
  BookOpen,
  AlertTriangle,
  ShoppingCart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import {
  getMedicationBySlug,
  getMedicationReferences,
  getMedicationReviewer,
  type CompareMedicationRow,
  type MedicationReferenceRow,
} from "@/lib/actions/medications";
import { SOURCE_LABEL, type SourceType } from "@/lib/references/category-source-map";

interface PageProps {
  params: Promise<{
    locale: string;
    "category-slug": string;
    "medication-slug": string;
  }>;
}

/**
 * `/compare/[category-slug]/[medication-slug]` — individual product page.
 *
 * Implements section 6.3 of docs/compare-feature.md. Shows the full
 * compare-feature data (pros/cons/verdict/ingredient analysis) when
 * available, and falls back to FDA label data + "not yet reviewed"
 * state when the record is FDA-only.
 */
export default async function MedicationDetailPage({ params }: PageProps) {
  const { "category-slug": categorySlug, "medication-slug": medicationSlug } =
    await params;

  const medication = await getMedicationBySlug(medicationSlug);
  if (!medication) notFound();

  // Verify the category matches. This prevents link-squatting like
  // `/compare/allergy/tylenol` landing on the tylenol page under the
  // wrong category header.
  const supabase = await createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("id, name, slug, description")
    .eq("slug", categorySlug)
    .maybeSingle();

  if (!category) notFound();

  // If the medication has a category_id and it doesn't match, 404.
  // Medications with null category remain viewable under any slug.
  if (
    medication.category_id !== null &&
    medication.category_id !== category.id
  ) {
    notFound();
  }

  const [references, reviewer] = await Promise.all([
    getMedicationReferences(medication.id),
    getMedicationReviewer(medication.reviewed_by),
  ]);

  const isReviewed =
    medication.source === "manual" || medication.reviewed_at !== null;

  const activeIngredients = normalizeActiveIngredients(
    medication.active_ingredients
  );
  const pros = normalizeStringList(medication.pros);
  const cons = normalizeStringList(medication.cons);
  const recommendedFor = medication.recommended_for ?? [];
  const ingredientAnalysis = normalizeIngredientAnalysis(
    medication.ingredient_analysis
  );
  const purchaseLinks = normalizePurchaseLinks(medication.purchase_links);

  // Group references by tier for the References section.
  const tier1Refs = references.filter((r) => r.tier_level === 1);
  const tier2Refs = references.filter((r) => r.tier_level === 2);
  const tier3Refs = references.filter((r) => r.tier_level === 3);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href={`/compare/${categorySlug}`} />}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to {category.name}
      </Button>

      {/* Product hero */}
      <section className="mb-6">
        <p className="text-sm font-medium uppercase text-primary">
          {category.name}
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {medication.name}
            </h1>
            {medication.generic_name && (
              <p className="mt-1 text-lg text-muted-foreground">
                Generic: <span className="font-medium">{medication.generic_name}</span>
              </p>
            )}
            {medication.brand_names && medication.brand_names.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                Also sold as: {medication.brand_names.join(", ")}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            {medication.comparison_score !== null && (
              <Badge className="bg-primary text-lg text-primary-foreground">
                Score {medication.comparison_score}
              </Badge>
            )}
            {isReviewed ? (
              <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                <ShieldCheck className="h-3 w-3" />
                Pharmacist-reviewed
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <FileWarning className="h-3 w-3" />
                FDA label data
              </Badge>
            )}
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="mb-8 rounded-md border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          {reviewer && medication.reviewed_at && (
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Last reviewed by{" "}
              <Link
                href={`/pharmacists/${reviewer.slug}`}
                className="font-medium hover:underline"
              >
                {reviewer.display_name}
                {reviewer.title ? `, ${reviewer.title}` : ""}
              </Link>
              <span className="text-muted-foreground">
                · {formatDate(medication.reviewed_at)}
              </span>
            </span>
          )}
          {references.length > 0 && (
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">{references.length} sources</span>
              <span className="text-muted-foreground">
                ·{" "}
                {Array.from(new Set(references.map((r) => r.source_type)))
                  .slice(0, 4)
                  .map((st) => SOURCE_LABEL[st as SourceType] ?? st)
                  .join(", ")}
              </span>
            </span>
          )}
          <span className="text-muted-foreground">
            💰 No paid placements · <Link href="/methodology" className="underline">How we stay independent</Link>
          </span>
        </div>
      </section>

      {/* FDA-only warning banner */}
      {!isReviewed && (
        <div className="mb-6 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              This product hasn&apos;t been curated by one of our pharmacists yet.
            </p>
            <p className="mt-0.5 text-amber-900/90 dark:text-amber-200/90">
              The information below comes from the FDA drug label. A pharmacist
              review with pros/cons and comparison scoring is coming soon.
            </p>
          </div>
        </div>
      )}

      {/* At a Glance */}
      {(recommendedFor.length > 0 ||
        medication.dosage_forms?.length ||
        activeIngredients.length > 0) && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">At a glance</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            {recommendedFor.length > 0 && (
              <InfoCell label="Best for" items={recommendedFor} />
            )}
            {medication.dosage_forms && medication.dosage_forms.length > 0 && (
              <InfoCell label="Forms" items={medication.dosage_forms} />
            )}
            {activeIngredients.length > 0 && (
              <InfoCell label="Active ingredients" items={activeIngredients} />
            )}
            {medication.price_range && (
              <InfoCell
                label="Price range"
                items={[medication.price_range]}
              />
            )}
          </dl>
        </section>
      )}

      {/* Pharmacist's Take (verdict) */}
      {medication.verdict && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Pharmacist&apos;s take</h2>
          <blockquote className="rounded-md border-l-4 border-primary bg-muted/30 p-4 text-base italic">
            &ldquo;{medication.verdict}&rdquo;
            {reviewer && (
              <footer className="mt-2 text-sm not-italic text-muted-foreground">
                — {reviewer.display_name}
                {reviewer.title ? `, ${reviewer.title}` : ""}
              </footer>
            )}
          </blockquote>
        </section>
      )}

      {/* Pros / Cons */}
      {(pros.length > 0 || cons.length > 0) && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">What to know</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {pros.length > 0 && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                <h3 className="mb-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  ✓ What&apos;s great
                </h3>
                <ul className="space-y-1.5 text-sm text-emerald-900/90 dark:text-emerald-100/90">
                  {pros.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-0.5 text-emerald-600">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {cons.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                <h3 className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                  ⚠ What to watch out for
                </h3>
                <ul className="space-y-1.5 text-sm text-amber-900/90 dark:text-amber-100/90">
                  {cons.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-0.5 text-amber-600">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Description (fallback for FDA-only records) */}
      {!isReviewed && medication.description && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">What it&apos;s for</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {medication.description}
          </p>
        </section>
      )}

      {/* Ingredient analysis */}
      {ingredientAnalysis.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">How it works</h2>
          <div className="space-y-4">
            {ingredientAnalysis.map((ing, i) => (
              <IngredientCard key={i} ingredient={ing} />
            ))}
          </div>
        </section>
      )}

      {/* Safety Info */}
      {(medication.warnings || medication.side_effects) && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Safety information</h2>
          {medication.warnings && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20">
              <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-red-900 dark:text-red-200">
                <AlertTriangle className="h-4 w-4" />
                Warnings
              </h3>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-red-900/90 dark:text-red-100/90">
                {medication.warnings}
              </p>
            </div>
          )}
          {medication.side_effects && (
            <div className="rounded-md border bg-muted/30 p-4">
              <h3 className="mb-1.5 text-sm font-semibold">Side effects</h3>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {medication.side_effects}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Where to Buy */}
      {purchaseLinks.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <ShoppingCart className="h-5 w-5" />
            Where to buy
          </h2>
          <div className="space-y-2">
            {purchaseLinks.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-md border bg-card p-3 text-sm transition-colors hover:bg-accent"
              >
                <span className="font-medium">
                  {link.retailer}
                  {link.isAffiliate && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (affiliate link)
                    </span>
                  )}
                </span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* References */}
      {references.length > 0 && (
        <section className="mb-8 border-t pt-8">
          <h2 className="mb-1 text-lg font-semibold">Sources</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Everything on this page is based on information from authoritative
            institutions. Here&apos;s where each claim comes from.
          </p>

          {tier1Refs.length > 0 && (
            <RefGroup
              title="Primary sources (FDA, PubMed, Cochrane, NIH, CDC, WHO)"
              tierColor="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20"
              refs={tier1Refs}
            />
          )}
          {tier2Refs.length > 0 && (
            <RefGroup
              title="Expert authorities"
              tierColor="border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/20"
              refs={tier2Refs}
            />
          )}
          {tier3Refs.length > 0 && (
            <RefGroup
              title="Supporting references"
              tierColor="border-muted-foreground/20 bg-muted/30"
              refs={tier3Refs}
            />
          )}
        </section>
      )}

      {/* DailyMed link for FDA-only records */}
      {medication.fda_spl_id && (
        <div className="mt-6 border-t pt-6">
          <a
            href={`https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${medication.fda_spl_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            View full FDA label on DailyMed
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Utilities
// ============================================================

function normalizeActiveIngredients(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): string | null => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "name" in item) {
        const name = (item as { name?: unknown }).name;
        return typeof name === "string" ? name : null;
      }
      return null;
    })
    .filter((s): s is string => s !== null && s.length > 0);
}

/**
 * Pros/cons are stored as jsonb. They can be either a plain
 * `string[]` (legacy) or `Array<{ text: string, sourceIds: number[] }>`
 * (current). Normalize to a simple string list for rendering.
 */
function normalizeStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): string | null => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "text" in item) {
        const text = (item as { text?: unknown }).text;
        return typeof text === "string" ? text : null;
      }
      return null;
    })
    .filter((s): s is string => s !== null && s.length > 0);
}

interface IngredientAnalysisItem {
  name: string;
  amount?: string | null;
  consumer?: {
    whatItDoes?: string | { text?: string };
    howFast?: string | { text?: string };
    whoItsFor?: string | { text?: string };
    whenToAvoid?: Array<string | { text?: string }>;
    maxPerDay?: string | { text?: string };
  };
  professional?: {
    role?: string;
    mechanism?: string | { text?: string };
    clinicalNotes?: string | { text?: string };
    contraindications?: string[];
    maxDailyDose?: string | { text?: string };
  };
}

function normalizeIngredientAnalysis(raw: unknown): IngredientAnalysisItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is IngredientAnalysisItem =>
      !!item && typeof item === "object" && "name" in item
  );
}

interface NormalizedPurchaseLink {
  retailer: string;
  url: string;
  isAffiliate: boolean;
}

function normalizePurchaseLinks(raw: unknown): NormalizedPurchaseLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): NormalizedPurchaseLink | null => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const url = typeof obj.url === "string" ? obj.url : null;
      if (!url) return null;
      return {
        retailer:
          typeof obj.retailer === "string" ? obj.retailer : "Retailer",
        url,
        isAffiliate: obj.is_affiliate === true || obj.isAffiliate === true,
      };
    })
    .filter((x): x is NormalizedPurchaseLink => x !== null);
}

function textOrStringToString(
  value: string | { text?: string } | undefined | null
): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.text ?? "";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ============================================================
// Sub-components
// ============================================================

function InfoCell({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <dt className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm">
        {items.slice(0, 4).join(" · ")}
        {items.length > 4 && (
          <span className="text-muted-foreground"> +{items.length - 4}</span>
        )}
      </dd>
    </div>
  );
}

function IngredientCard({ ingredient }: { ingredient: IngredientAnalysisItem }) {
  const consumer = ingredient.consumer ?? {};
  const professional = ingredient.professional ?? {};

  const whatItDoes = textOrStringToString(consumer.whatItDoes);
  const howFast = textOrStringToString(consumer.howFast);
  const whoItsFor = textOrStringToString(consumer.whoItsFor);
  const maxPerDay = textOrStringToString(consumer.maxPerDay);
  const whenToAvoid = Array.isArray(consumer.whenToAvoid)
    ? consumer.whenToAvoid.map(textOrStringToString).filter(Boolean)
    : [];

  const hasConsumerData =
    whatItDoes || howFast || whoItsFor || maxPerDay || whenToAvoid.length > 0;
  const hasProfessionalData =
    professional.role ||
    professional.mechanism ||
    professional.clinicalNotes ||
    (professional.contraindications ?? []).length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {ingredient.name}
          {ingredient.amount && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {ingredient.amount}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 text-sm">
        {whatItDoes && (
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              What it does
            </p>
            <p className="mt-0.5">{whatItDoes}</p>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {howFast && (
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                How fast
              </p>
              <p className="mt-0.5">{howFast}</p>
            </div>
          )}
          {whoItsFor && (
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Who it&apos;s for
              </p>
              <p className="mt-0.5">{whoItsFor}</p>
            </div>
          )}
        </div>
        {whenToAvoid.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              When to avoid
            </p>
            <ul className="mt-1 space-y-0.5">
              {whenToAvoid.map((w, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {maxPerDay && (
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Max per day
            </p>
            <p className="mt-0.5">{maxPerDay}</p>
          </div>
        )}

        {hasProfessionalData && (
          <details className="rounded-md border bg-muted/30 p-3 text-xs">
            <summary className="cursor-pointer font-semibold text-muted-foreground">
              For healthcare professionals
            </summary>
            <div className="mt-2 space-y-2">
              <p className="italic text-muted-foreground">
                The following section is intended for healthcare professionals.
              </p>
              {professional.role && (
                <p>
                  <span className="font-semibold">Role:</span> {professional.role}
                </p>
              )}
              {textOrStringToString(professional.mechanism) && (
                <p>
                  <span className="font-semibold">Mechanism:</span>{" "}
                  {textOrStringToString(professional.mechanism)}
                </p>
              )}
              {textOrStringToString(professional.clinicalNotes) && (
                <p>
                  <span className="font-semibold">Clinical notes:</span>{" "}
                  {textOrStringToString(professional.clinicalNotes)}
                </p>
              )}
              {textOrStringToString(professional.maxDailyDose) && (
                <p>
                  <span className="font-semibold">Max daily dose:</span>{" "}
                  {textOrStringToString(professional.maxDailyDose)}
                </p>
              )}
              {(professional.contraindications ?? []).length > 0 && (
                <div>
                  <p className="font-semibold">Contraindications:</p>
                  <ul className="ml-4 mt-0.5 list-disc">
                    {professional.contraindications!.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        )}

        {!hasConsumerData && !hasProfessionalData && (
          <p className="text-muted-foreground italic">
            Detailed analysis coming soon.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RefGroup({
  title,
  tierColor,
  refs,
}: {
  title: string;
  tierColor: string;
  refs: MedicationReferenceRow[];
}) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2">
        {refs.map((ref) => (
          <div
            key={ref.id}
            className={`rounded-md border p-3 ${tierColor}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {SOURCE_LABEL[ref.source_type as SourceType] ??
                      ref.source_type}
                  </Badge>
                  {ref.published_at && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(ref.published_at).getFullYear()}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-sm font-medium">{ref.title}</p>
                {ref.authors && (
                  <p className="text-xs text-muted-foreground">{ref.authors}</p>
                )}
              </div>
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-primary hover:text-primary/80"
                aria-label="Open source in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
