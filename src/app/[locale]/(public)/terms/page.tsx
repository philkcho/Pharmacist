import Link from "next/link";
import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { SITE_AUTHOR } from "@/lib/author";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of use for AI PharmCare. Educational health content, not medical advice. Your responsibilities, our liability, and how our pharmacist-reviewed analysis works.",
  alternates: { canonical: "/terms" },
};

const LAST_UPDATED = "April 24, 2026";

export default function TermsOfServicePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <div className="space-y-8 text-base leading-relaxed">
        <section>
          <p>
            Welcome to {BRAND.legalName} ({BRAND.domain}). By using this
            site you agree to these Terms of Service (&ldquo;Terms&rdquo;).
            If you do not agree, please do not use the site.
          </p>
        </section>

        <Section title="Not medical advice">
          <p>
            Everything on {BRAND.legalName} is <strong>educational</strong>.
            Our content — including product analyses, ingredient breakdowns,
            pharmacist-reviewed articles, and personal consult answers — is
            intended to help you make informed decisions, not to diagnose,
            treat, cure, or prevent any disease.
          </p>
          <p className="mt-3">
            Always consult a licensed physician, pharmacist, or other
            qualified healthcare professional before starting, stopping, or
            changing any medication, supplement, or treatment. Never
            disregard professional medical advice or delay seeking it because
            of something you read here.
          </p>
          <p className="mt-3">
            In an emergency call 911 (US) or your local emergency number.
          </p>
        </Section>

        <Section title="AI-assisted content">
          <p>
            Articles and analyses on this site are drafted by AI (Google
            Gemini) and reviewed by {SITE_AUTHOR.displayName} against FDA
            labeling, peer-reviewed literature, and current pharmacy
            practice. Drafts that haven&rsquo;t yet been reviewed are clearly
            marked or kept out of public view. We strive for accuracy but
            cannot guarantee every detail is up to date. Report corrections
            to{" "}
            <a
              href={`mailto:${SITE_AUTHOR.email}`}
              className="text-primary hover:underline"
            >
              {SITE_AUTHOR.email}
            </a>
            .
          </p>
        </Section>

        <Section title="Accounts">
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              You&rsquo;re responsible for keeping your login credentials
              secure. Notify us immediately of unauthorized access.
            </li>
            <li>
              You must be 18 or older to create an account. If you&rsquo;re
              between 13 and 18, use the site only with a parent or guardian.
            </li>
            <li>
              Provide truthful information in consult submissions. Inaccurate
              medical or medication history can lead to unsafe
              recommendations.
            </li>
          </ul>
        </Section>

        <Section title="Acceptable use">
          <p>You agree not to:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              Scrape or redistribute our content without written permission.
            </li>
            <li>
              Use automated tools to submit consults or flood our endpoints.
            </li>
            <li>
              Impersonate a licensed healthcare provider.
            </li>
            <li>
              Upload content that is unlawful, defamatory, harassing, or
              infringes a third party&rsquo;s rights.
            </li>
            <li>
              Attempt to reverse-engineer, exploit, or circumvent any
              security measures.
            </li>
          </ul>
        </Section>

        <Section title="Affiliate links">
          <p>
            Product links on {BRAND.legalName} are often affiliate links. We
            may earn a commission on qualifying purchases, at no additional
            cost to you. Affiliate relationships do not influence which
            products we analyze, score, or recommend. See our{" "}
            <Link
              href="/disclosure"
              className="text-primary hover:underline"
            >
              Affiliate Disclosure
            </Link>{" "}
            for details.
          </p>
        </Section>

        <Section title="Intellectual property">
          <p>
            Site design, original articles, product analyses, and graphics
            are owned by {BRAND.legalName} or our licensors. You may share
            short excerpts with attribution and a link back, but may not
            republish entire articles or ingest our content into a commercial
            AI training dataset without written permission.
          </p>
          <p className="mt-3">
            Product names, brand marks, and retailer logos are trademarks of
            their respective owners and are used under fair-use for review
            and commentary.
          </p>
        </Section>

        <Section title="Disclaimers and limitation of liability">
          <p>
            The site is provided &ldquo;as is.&rdquo; To the fullest extent
            permitted by law, {BRAND.legalName} disclaims all warranties,
            express or implied, including merchantability, fitness for a
            particular purpose, and non-infringement.
          </p>
          <p className="mt-3">
            We are not liable for indirect, incidental, special,
            consequential, or exemplary damages arising from your use of the
            site, third-party retailer transactions, or reliance on the
            content. Our total liability, to the extent not prohibited by
            law, is limited to $100 USD.
          </p>
        </Section>

        <Section title="Third-party services">
          <p>
            Clicking an affiliate link takes you to a third-party retailer
            whose terms and privacy policy apply. We&rsquo;re not responsible
            for their product quality, fulfillment, or customer service.
          </p>
        </Section>

        <Section title="Changes to these Terms">
          <p>
            We may update these Terms. The &ldquo;Last updated&rdquo; date
            reflects the current version. Material changes will be announced
            on the site. Continued use after changes means you accept them.
          </p>
        </Section>

        <Section title="Governing law">
          <p>
            These Terms are governed by the laws of the State of California,
            USA, without regard to conflict-of-laws principles. Disputes will
            be resolved in courts located in San Francisco County,
            California, unless binding arbitration is required.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these Terms? Email{" "}
            <a
              href={`mailto:${SITE_AUTHOR.email}`}
              className="text-primary hover:underline"
            >
              {SITE_AUTHOR.email}
            </a>
            .
          </p>
        </Section>

        <nav className="mt-12 border-t pt-6 text-sm text-muted-foreground">
          See also:{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          {" · "}
          <Link href="/disclosure" className="text-primary hover:underline">
            Affiliate Disclosure
          </Link>
        </nav>
      </div>
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-2 text-muted-foreground">{children}</div>
    </section>
  );
}
