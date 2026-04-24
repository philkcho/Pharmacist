import Link from "next/link";
import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { SITE_AUTHOR } from "@/lib/author";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How AI PharmCare collects, uses, and protects your information. Details on analytics, cookies, affiliate tracking, and your rights.",
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "April 24, 2026";

export default function PrivacyPolicyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <div className="space-y-8 text-base leading-relaxed">
        <section>
          <p>
            {BRAND.legalName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or
            &ldquo;our&rdquo;) operates {BRAND.domain}. This Privacy Policy
            explains what information we collect, how we use it, and the
            choices you have. By using our site you agree to this policy.
          </p>
        </section>

        <Section title="Information we collect">
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Account data.</strong> If you sign in, we receive your
              email address and Google profile name from Google OAuth.
            </li>
            <li>
              <strong>Submitted content.</strong> Questions, photos, and
              product queries you send to our Personal Consult or Community
              Q&amp;A.
            </li>
            <li>
              <strong>Usage data.</strong> Anonymized page views and click
              events (what articles you read, which Buy buttons you tap),
              used to improve the site and attribute affiliate sales.
            </li>
            <li>
              <strong>Device + log data.</strong> IP address, browser, device
              type, and referrer URL, collected automatically by Vercel
              (our host) and our analytics tools.
            </li>
            <li>
              <strong>Cookies.</strong> Session cookies for login; analytics
              cookies to measure visits; affiliate cookies set by retailers
              (Amazon, iHerb, Impact.com partners) when you click a Buy
              button.
            </li>
          </ul>
        </Section>

        <Section title="How we use your information">
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              Provide the service: show analyses, deliver personal consult
              answers from our pharmacist, remember your account preferences.
            </li>
            <li>
              Improve content: identify which articles are helpful, surface
              better products, fix broken links.
            </li>
            <li>
              Attribute affiliate sales: if you buy a product via one of our
              links, the retailer tells us a sale occurred so we can report
              earnings and improve recommendations.
            </li>
            <li>
              Send transactional emails: consult answers, security alerts.
              We do <strong>not</strong> send marketing email without opt-in.
            </li>
            <li>
              Comply with legal obligations and detect abuse or fraud.
            </li>
          </ul>
        </Section>

        <Section title="Third parties we share with">
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Supabase</strong> — stores your account and consult
              data (EU/US data centers).
            </li>
            <li>
              <strong>Vercel</strong> — hosts the site and handles page
              delivery.
            </li>
            <li>
              <strong>Google</strong> — OAuth sign-in, Analytics, Search
              Console, and reCAPTCHA abuse protection.
            </li>
            <li>
              <strong>Affiliate networks</strong> — Amazon Associates,
              Impact.com, Commission Junction, and partner retailers (iHerb,
              Sephora, etc.) receive a click reference when you tap a Buy
              button, so commissions can be attributed.
            </li>
            <li>
              <strong>AI providers</strong> — we use Google Gemini to draft
              analyses. Submitted consult questions may be sent to the model
              for processing. No personally identifying information is
              attached to those requests.
            </li>
          </ul>
          <p className="mt-3">
            We do <strong>not</strong> sell your personal information.
          </p>
        </Section>

        <Section title="Your rights">
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>Access or download the data tied to your account.</li>
            <li>
              Correct inaccurate information (display name, email).
            </li>
            <li>
              Delete your account. This removes your login, consults, and
              saved items. Anonymized analytics and click logs may remain.
            </li>
            <li>
              Opt out of analytics cookies using your browser&rsquo;s Do Not
              Track setting or a standard ad-blocker.
            </li>
            <li>
              If you are in the EU/UK, you have the rights described in the
              GDPR (including the right to lodge a complaint with a data
              protection authority).
            </li>
            <li>
              If you are a California resident, you have the rights described
              in the CCPA.
            </li>
          </ul>
          <p className="mt-3">
            To exercise any of these, email{" "}
            <a
              href={`mailto:${SITE_AUTHOR.email}`}
              className="text-primary hover:underline"
            >
              {SITE_AUTHOR.email}
            </a>
            .
          </p>
        </Section>

        <Section title="Data retention">
          <p>
            We keep account data while your account is active. Consult
            records are retained for 3 years for continuity of care, then
            anonymized. Click events are retained for 24 months for affiliate
            attribution and fraud detection, then aggregated.
          </p>
        </Section>

        <Section title="Children's privacy">
          <p>
            {BRAND.legalName} is not directed to children under 13. We do not
            knowingly collect information from children under 13. If you
            believe a child has provided us information, contact us and we
            will delete it.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We may update this policy. Material changes will be announced via
            a banner on the site or an email to registered users. The
            &ldquo;Last updated&rdquo; date at the top reflects the current
            version.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy or our privacy practices? Email{" "}
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
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Service
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
