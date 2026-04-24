import Link from "next/link";
import type { Metadata } from "next";
import { ShoppingCart, ShieldCheck, FileText } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { SITE_AUTHOR } from "@/lib/author";

export const metadata: Metadata = {
  title: "Affiliate Disclosure",
  description:
    "How AI PharmCare earns commissions on product recommendations and why that never influences our editorial analysis.",
  alternates: { canonical: "/disclosure" },
};

const LAST_UPDATED = "April 24, 2026";

export default function AffiliateDisclosurePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Affiliate Disclosure
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <div className="space-y-8 text-base leading-relaxed">
        {/* Plain-English top-line */}
        <section className="rounded-lg border-l-4 border-primary bg-muted/30 p-5">
          <p className="text-lg font-medium">
            {BRAND.legalName} participates in affiliate programs. When you
            buy a product through one of our Buy buttons, we may earn a
            commission at <strong>no additional cost to you</strong>. That
            commission keeps the lights on — it does not influence which
            products we analyze, score, or recommend.
          </p>
        </section>

        <Section title="FTC compliance">
          <p>
            Per the United States Federal Trade Commission&rsquo;s{" "}
            <a
              href="https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Endorsement Guides
            </a>
            , we disclose material connections between our content and the
            brands we mention. This page is that disclosure.
          </p>
        </Section>

        <Section title="Programs we participate in">
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Amazon Associates</strong> — {BRAND.legalName} is a
              participant in the Amazon Services LLC Associates Program, an
              affiliate advertising program designed to provide a means for
              sites to earn commissions by linking to Amazon.com.
            </li>
            <li>
              <strong>Impact.com</strong> — we partner with brands whose
              programs run on the Impact.com network (iHerb, selected
              supplement and skincare brands).
            </li>
            <li>
              <strong>Commission Junction (CJ Affiliate)</strong> — we
              partner with retailers whose programs run on CJ (Walgreens,
              Target, and other mainstream retailers).
            </li>
            <li>
              <strong>Other networks</strong> — as we expand, we may add
              programs from ShareASale, Rakuten, and direct brand
              partnerships. This list is updated when new partners are added.
            </li>
          </ul>
        </Section>

        <Section
          title="How this works when you click a Buy button"
          icon={ShoppingCart}
        >
          <ol className="mt-2 list-decimal space-y-2 pl-6">
            <li>You read an article and tap the Buy button on a product.</li>
            <li>
              Our link includes a tracking parameter so the retailer knows
              you came from us.
            </li>
            <li>
              You land on the retailer&rsquo;s site (Amazon, iHerb, etc.) and
              check out there — at the same price you&rsquo;d pay otherwise.
            </li>
            <li>
              If you purchase within the retailer&rsquo;s cookie window
              (typically 24 hours to 30 days), they credit us with a small
              percentage of the sale.
            </li>
          </ol>
        </Section>

        <Section
          title="Editorial independence"
          icon={ShieldCheck}
        >
          <p>
            Our product rankings and pharmacist reviews are written
            independently of affiliate revenue. Specifically:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              We score products using a consistent rubric regardless of
              commission rate.
            </li>
            <li>
              {SITE_AUTHOR.displayName} reviews analyses for accuracy against
              FDA labels and peer-reviewed evidence. She has no financial
              incentive tied to any specific brand.
            </li>
            <li>
              We do <strong>not</strong> accept paid placements, sponsored
              rankings, or pay-to-play inclusion in articles. When a product
              is advertised, it will be clearly labeled &ldquo;Sponsored&rdquo;
              or &ldquo;Paid partnership.&rdquo;
            </li>
            <li>
              If a brand asks us to remove a critical review, we decline.
            </li>
          </ul>
        </Section>

        <Section title="AI-assisted content" icon={FileText}>
          <p>
            Many of our analyses are drafted by AI and reviewed by our
            pharmacist. We disclose AI involvement with an &ldquo;AI
            draft&rdquo; or &ldquo;AI-reviewed&rdquo; badge on relevant
            articles. See our{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{" "}
            for details on how AI drafts are reviewed before publication.
          </p>
        </Section>

        <Section title="No medical advice">
          <p>
            The products we link are over-the-counter medications,
            supplements, and cosmetics. Our editorial coverage is educational
            and does not constitute medical advice. Always consult your
            pharmacist or healthcare provider before starting a new
            product — especially if you&rsquo;re pregnant, nursing, taking
            prescription medications, or managing a chronic condition.
          </p>
        </Section>

        <Section title="Questions or concerns">
          <p>
            Spot a review that looks biased? Notice a product we should
            cover? Want to report a broken affiliate link? Email{" "}
            <a
              href={`mailto:${SITE_AUTHOR.email}`}
              className="text-primary hover:underline"
            >
              {SITE_AUTHOR.email}
            </a>
            . We take editorial integrity seriously and investigate every
            report.
          </p>
        </Section>

        <nav className="mt-12 border-t pt-6 text-sm text-muted-foreground">
          See also:{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          {" · "}
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>
          {" · "}
          <Link href="/about" className="text-primary hover:underline">
            About {BRAND.name}
          </Link>
        </nav>
      </div>
    </article>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof ShoppingCart;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        {title}
      </h2>
      <div className="mt-2 text-muted-foreground">{children}</div>
    </section>
  );
}
