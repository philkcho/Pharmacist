import { Pill, FlaskConical, ShieldCheck, BookOpen, Mail } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { SITE_AUTHOR, authorPersonSchema } from "@/lib/author";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com";

export const metadata: Metadata = {
  title: "About — AI PharmCare",
  description:
    "Learn about AI PharmCare — pharmacist-reviewed health & beauty analysis backed by FDA data, clinical research, and ingredient science.",
  alternates: { canonical: `${SITE_URL}/about` },
};

function AboutJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: `${SITE_URL}/about`,
    mainEntity: authorPersonSchema(),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <AboutJsonLd />
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <Pill className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            AI PharmCare
          </h1>
        </div>
        <p className="mt-4 text-lg text-muted-foreground">
          We read the science so you don&apos;t have to.
        </p>
      </div>

      {/* Mission */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold">Our Mission</h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Navigating the world of health supplements, skincare, and OTC
          medications can be overwhelming. Marketing claims are loud, ingredient
          lists are confusing, and it&apos;s hard to know what actually works.
        </p>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          AI PharmCare exists to cut through the noise. We combine{" "}
          <strong className="text-foreground">pharmacist expertise</strong>,{" "}
          <strong className="text-foreground">FDA data</strong>, and{" "}
          <strong className="text-foreground">peer-reviewed research</strong>{" "}
          to give you clear, trustworthy analysis of the products you&apos;re
          considering — in plain language, not jargon.
        </p>
      </section>

      {/* Meet the Reviewer — E-E-A-T anchor for health (YMYL) content */}
      <section className="mt-12 rounded-xl border bg-muted/20 p-6 sm:p-8">
        <h2 className="text-xl font-semibold">Meet Your Pharmacist Reviewer</h2>
        <div className="mt-5">
          <h3 className="text-lg font-semibold">{SITE_AUTHOR.name}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Every article and product analysis on AI PharmCare is reviewed for
            accuracy against FDA labeling, peer-reviewed literature, and current
            pharmacy practice. AI-assisted drafts are not published without this
            review step.
          </p>
          <a
            href={`mailto:${SITE_AUTHOR.email}`}
            aria-label={`Email ${SITE_AUTHOR.name}`}
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Mail className="h-3.5 w-3.5" />
            Email {SITE_AUTHOR.name.split(" ")[0]}
          </a>
        </div>
      </section>

      {/* What We Do */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold">What We Do</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <FeatureCard
            icon={<FlaskConical className="h-5 w-5 text-primary" />}
            title="Product Analysis"
            description="Every product is analyzed for ingredients, safety, efficacy, and value. We pull from FDA labels, clinical studies, and real-world data — not marketing copy."
          />
          <FeatureCard
            icon={<BookOpen className="h-5 w-5 text-primary" />}
            title="Dr.'s Analysis"
            description="In-depth articles breaking down health and beauty topics — ingredient science, product comparisons, and evidence-based recommendations."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5 text-primary" />}
            title="Safety First"
            description="We check FDA adverse event reports (FAERS), active recalls, and known drug interactions. Red flags are surfaced, not hidden."
          />
          <FeatureCard
            icon={<Pill className="h-5 w-5 text-primary" />}
            title="Trend Analysis"
            description="When a supplement or skincare ingredient goes viral, we investigate. Our 'Worth the Hype?' series separates science from hype."
          />
        </div>
      </section>

      {/* How It Works */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold">How It Works</h2>
        <div className="mt-6 space-y-4">
          <Step
            number={1}
            title="Research"
            description="We gather data from FDA databases, PubMed studies, ingredient safety databases, and regulatory sources."
          />
          <Step
            number={2}
            title="Analyze"
            description="AI-assisted analysis synthesizes the research into structured insights — ingredients, pros, cons, safety signals, and a pharmacist's verdict."
          />
          <Step
            number={3}
            title="Review"
            description="Content is reviewed for accuracy. AI-drafted analyses are clearly labeled for transparency."
          />
          <Step
            number={4}
            title="Shop Smart"
            description="When you're ready to buy, we link you to trusted retailers. We never let affiliate relationships influence our analysis."
          />
        </div>
      </section>

      {/* Transparency */}
      <section className="mt-12 rounded-lg border bg-muted/30 p-6">
        <h2 className="text-lg font-semibold">Transparency & Disclosures</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">AI-Assisted Content:</strong>{" "}
            Many of our analyses use AI to synthesize research. These are
            clearly marked with an &quot;AI&quot; badge and are subject to
            pharmacist review.
          </li>
          <li>
            <strong className="text-foreground">Affiliate Links:</strong>{" "}
            Some product links are affiliate links — we may earn a small
            commission if you purchase. This never affects our analysis or
            recommendations.
          </li>
          <li>
            <strong className="text-foreground">Not Medical Advice:</strong>{" "}
            Our content is for informational purposes only. Always consult
            your healthcare provider before starting any new supplement or
            medication.
          </li>
          <li>
            <strong className="text-foreground">Data Sources:</strong>{" "}
            We use openFDA, PubMed, FAERS, and other public databases.
            Product data is updated regularly but may not reflect real-time
            changes.
          </li>
        </ul>
      </section>

      {/* Contact */}
      <section className="mt-12 text-center">
        <h2 className="text-xl font-semibold">Get in Touch</h2>
        <p className="mt-3 text-muted-foreground">
          Have a question, suggestion, or want to request a product analysis?
        </p>
        <a
          href={`mailto:${SITE_AUTHOR.email}`}
          className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
        >
          <Mail className="h-4 w-4" />
          {SITE_AUTHOR.email}
        </a>
      </section>

      {/* Back to home */}
      <div className="mt-12 text-center">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Home
        </Link>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {number}
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
