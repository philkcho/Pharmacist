import { useTranslations } from "next-intl";
import { Pill, Search, ShieldCheck, BookOpen } from "lucide-react";

export default function Home() {
  const t = useTranslations();

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Pill className="h-10 w-10 text-primary" />
              </div>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Trusted OTC Medication
              <br />
              <span className="text-primary">Recommendations</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Expert pharmacist-reviewed guides to help you choose the right
              over-the-counter medications. Evidence-based, unbiased, and always
              up to date.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="rounded-lg bg-primary/10 p-3">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">Pharmacist Verified</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Every article is reviewed and approved by a licensed pharmacist
                with real clinical experience.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="rounded-lg bg-primary/10 p-3">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">Evidence-Based</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Recommendations backed by FDA guidelines, clinical studies, and
                professional expertise.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="rounded-lg bg-primary/10 p-3">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">Easy to Understand</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Complex medication information simplified into clear,
                actionable advice for everyday decisions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Preview */}
      <section className="border-t bg-muted/30 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold">
            Browse by Category
          </h2>
          <p className="mt-2 text-center text-muted-foreground">
            Find the right medication for your needs
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "Pain Relief", emoji: "💊" },
              { name: "Cold & Flu", emoji: "🤧" },
              { name: "Digestive Health", emoji: "🫁" },
              { name: "Allergy", emoji: "🌸" },
              { name: "Vitamins & Supplements", emoji: "🍊" },
              { name: "Skin Care", emoji: "✨" },
              { name: "Sleep & Relaxation", emoji: "😴" },
              { name: "First Aid", emoji: "🩹" },
            ].map((category) => (
              <div
                key={category.name}
                className="flex items-center gap-3 rounded-lg border bg-background p-4 transition-colors hover:bg-accent"
              >
                <span className="text-2xl">{category.emoji}</span>
                <span className="font-medium">{category.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
