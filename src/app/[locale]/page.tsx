import {
  Camera,
  Bell,
  Globe,
  MessageCircle,
  Heart,
  Pill,
  ShieldCheck,
  ScanLine,
  BellRing,
  Users,
  ShieldAlert,
  FileText,
  User,
  HeartHandshake,
  Stethoscope,
  Lock,
  Smartphone,
} from "lucide-react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });
  const isZhTW = locale === "zh-TW";
  const title = isZhTW
    ? "MedBuddy 藥好友 — 智慧用藥提醒與管理"
    : "MedBuddy — Smart Medication Reminders & Management";
  return {
    title,
    description: t("hero.subtitle"),
    openGraph: {
      title,
      description: t("hero.subtitle"),
      type: "website",
      locale: isZhTW ? "zh_TW" : "en_US",
      siteName: "MedBuddy",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: t("hero.subtitle"),
    },
  };
}

const features = [
  { key: "scan" as const, icon: Camera },
  { key: "reminders" as const, icon: Bell },
  { key: "chat" as const, icon: MessageCircle },
  { key: "caretaker" as const, icon: Heart },
  { key: "interactions" as const, icon: ShieldAlert },
  { key: "summary" as const, icon: FileText },
];

const steps = [
  { key: 0, icon: ScanLine },
  { key: 1, icon: BellRing },
  { key: 2, icon: Users },
];

const personas = [
  { key: "patient" as const, icon: User },
  { key: "caregiver" as const, icon: HeartHandshake },
  { key: "professional" as const, icon: Stethoscope },
];

const trustItems = [
  { key: "ai" as const, icon: ShieldCheck },
  { key: "privacy" as const, icon: Lock },
  { key: "access" as const, icon: Smartphone },
];

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const tCommon = await getTranslations("common");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "MedBuddy 藥好友",
    applicationCategory: "HealthApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "TWD" },
    description: t("hero.subtitle"),
  };

  const faqItems = t.raw("faq.items") as {
    question: string;
    answer: string;
  }[];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Section 1 — Sticky Header */}
      <header className="bg-background/80 sticky top-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md md:px-8">
        <div className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-xl text-xl">
            <Pill className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">{tCommon("appName")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
            <Link href="/" locale={locale === "zh-TW" ? "en" : "zh-TW"}>
              <Globe className="h-4 w-4" />
              <span className="sr-only">{locale === "zh-TW" ? "English" : "中文"}</span>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">{t("auth.signIn")}</Link>
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Section 2 — Hero */}
        <section className="relative flex flex-col items-center px-6 pt-16 pb-20 text-center md:pt-24 md:pb-28">
          <div
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
            aria-hidden="true"
          >
            <div className="bg-primary/8 absolute -top-24 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full blur-3xl" />
            <div className="bg-accent/40 absolute top-40 -right-20 h-[400px] w-[400px] rounded-full blur-3xl" />
          </div>

          <div className="mb-8 flex items-center justify-center">
            <div className="relative">
              <div className="bg-primary/10 text-primary flex h-24 w-24 items-center justify-center rounded-3xl md:h-28 md:w-28">
                <Pill className="h-12 w-12 md:h-14 md:w-14" strokeWidth={1.5} />
              </div>
              <div className="bg-primary text-primary-foreground absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full text-sm">
                <Heart className="h-4 w-4" />
              </div>
            </div>
          </div>

          <h1 className="mx-auto max-w-lg text-3xl leading-snug font-bold tracking-tight sm:text-4xl md:text-5xl">
            {t("hero.title")}
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-md text-lg leading-relaxed md:text-xl">
            {t("hero.subtitle")}
          </p>

          <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
            <Button
              size="lg"
              className="shadow-primary/25 h-14 rounded-2xl text-lg font-semibold shadow-lg"
              asChild
            >
              <Link href="/register">{t("hero.cta")}</Link>
            </Button>
            <Button variant="outline" size="lg" className="h-14 rounded-2xl text-lg" asChild>
              <a href="#how-it-works">{t("hero.secondaryCta")}</a>
            </Button>
          </div>
        </section>

        {/* Section 3 — How It Works */}
        <section id="how-it-works" className="bg-card px-6 py-16 md:py-24">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-12 text-center text-2xl font-bold tracking-tight md:text-3xl">
              {t("howItWorks.heading")}
            </h2>
            <div className="grid gap-10 sm:grid-cols-3 sm:gap-8">
              {steps.map((step) => (
                <div key={step.key} className="flex flex-col items-center text-center">
                  <div className="bg-primary text-primary-foreground flex h-16 w-16 items-center justify-center rounded-full md:h-18 md:w-18">
                    <step.icon className="h-8 w-8" />
                  </div>
                  <span className="text-muted-foreground mt-4 text-sm font-medium">
                    {step.key + 1}
                  </span>
                  <h3 className="mt-2 text-lg font-semibold">
                    {t(`howItWorks.steps.${step.key}.title`)}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-base leading-relaxed md:text-lg">
                    {t(`howItWorks.steps.${step.key}.description`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 4 — Features (6 cards) */}
        <section id="features" className="px-6 py-16 md:py-24">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-12 text-center text-2xl font-bold tracking-tight md:text-3xl">
              {t("features.heading")}
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.key}
                  className="bg-background flex gap-4 rounded-2xl border p-6 transition-shadow hover:shadow-md"
                >
                  <div className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="leading-snug font-semibold">
                      {t(`features.${feature.key}.title`)}
                    </h3>
                    <p className="text-muted-foreground mt-1.5 text-base leading-relaxed">
                      {t(`features.${feature.key}.description`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 5 — Built For You / Personas */}
        <section className="bg-card px-6 py-16 md:py-24">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-12 text-center text-2xl font-bold tracking-tight md:text-3xl">
              {t("personas.heading")}
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {personas.map((persona) => (
                <div
                  key={persona.key}
                  className="bg-background flex flex-col items-center rounded-2xl border p-8 text-center"
                >
                  <div className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-full">
                    <persona.icon className="h-7 w-7" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">
                    {t(`personas.${persona.key}.title`)}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-base leading-relaxed">
                    {t(`personas.${persona.key}.description`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 6 — Trust & Safety */}
        <section className="px-6 py-16 md:py-24">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-12 text-center text-2xl font-bold tracking-tight md:text-3xl">
              {t("trust.heading")}
            </h2>
            <div className="grid gap-8 sm:grid-cols-3">
              {trustItems.map((item) => (
                <div key={item.key} className="flex flex-col items-center text-center">
                  <div className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-full">
                    <item.icon className="h-7 w-7" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{t(`trust.${item.key}.title`)}</h3>
                  <p className="text-muted-foreground mt-2 text-base leading-relaxed">
                    {t(`trust.${item.key}.description`)}
                  </p>
                </div>
              ))}
            </div>
            <div className="bg-secondary/50 mx-auto mt-10 flex max-w-2xl items-start gap-3 rounded-2xl p-6">
              <ShieldCheck className="text-primary mt-0.5 h-6 w-6 shrink-0" />
              <p className="text-muted-foreground text-base leading-relaxed">
                {t("trust.disclaimer")}
              </p>
            </div>
          </div>
        </section>

        {/* Section 7 — FAQ */}
        <section className="bg-card px-6 py-16 md:py-24">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-12 text-center text-2xl font-bold tracking-tight md:text-3xl">
              {t("faq.heading")}
            </h2>
            <Accordion type="single" collapsible>
              {faqItems.map((item, index) => (
                <AccordionItem key={index} value={`faq-${index}`}>
                  <AccordionTrigger className="text-base md:text-lg">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-base leading-relaxed md:text-lg">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Section 8 — Final CTA */}
        <section className="bg-primary/5 px-6 py-20 text-center md:py-28">
          <div className="mx-auto max-w-md">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              {t("finalCta.heading")}
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 text-lg md:text-xl">
              {t("finalCta.description")}
            </p>
            <div className="mt-10">
              <Button
                size="lg"
                className="shadow-primary/25 h-14 rounded-2xl px-10 text-lg font-semibold shadow-lg"
                asChild
              >
                <Link href="/register">{t("finalCta.cta")}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Section 9 — Footer */}
      <footer className="text-muted-foreground border-t px-6 py-8 text-center text-sm md:px-8">
        <div className="mb-4 flex items-center justify-center gap-6">
          <a href="#" className="hover:text-foreground">
            {t("footer.privacy")}
          </a>
          <a href="#" className="hover:text-foreground">
            {t("footer.terms")}
          </a>
        </div>
        <p>
          &copy; {new Date().getFullYear()} {tCommon("appName")}
        </p>
        <p className="mt-1">{t("footer.madeIn")}</p>
      </footer>
    </div>
  );
}
