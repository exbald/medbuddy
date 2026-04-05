import {
  Camera,
  Bell,
  Globe,
  MessageCircle,
  Heart,
  Pill,
  ShieldCheck,
} from "lucide-react"
import { setRequestLocale, getTranslations } from "next-intl/server"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/routing"

const features = [
  { key: "scan" as const, icon: Camera },
  { key: "reminders" as const, icon: Bell },
  { key: "chat" as const, icon: MessageCircle },
  { key: "caretaker" as const, icon: Heart },
]

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("landing")
  const tCommon = await getTranslations("common")

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-xl text-primary-foreground">
            <Pill className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            {tCommon("appName")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
            <Link href="/" locale={locale === "zh-TW" ? "en" : "zh-TW"}>
              <Globe className="h-4 w-4" />
              <span className="sr-only">
                {locale === "zh-TW" ? "English" : "中文"}
              </span>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">{t("auth.signIn")}</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex flex-1 flex-col items-center px-5 pt-8 pb-12 text-center">
        {/* Decorative background */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          aria-hidden="true"
        >
          <div className="absolute -top-24 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
          <div className="absolute top-40 -right-20 h-[300px] w-[300px] rounded-full bg-accent/40 blur-3xl" />
        </div>

        {/* Pill icon cluster */}
        <div className="mb-6 flex items-center justify-center">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10 text-primary">
              <Pill className="h-12 w-12" strokeWidth={1.5} />
            </div>
            <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
              <Heart className="h-4 w-4" />
            </div>
          </div>
        </div>

        <h1 className="mx-auto max-w-md text-3xl leading-snug font-bold tracking-tight sm:text-4xl">
          {t("hero.title")}
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-lg leading-relaxed text-muted-foreground">
          {t("hero.subtitle")}
        </p>

        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <Button
            size="lg"
            className="h-14 rounded-2xl text-lg font-semibold shadow-lg shadow-primary/25"
            asChild
          >
            <Link href="/register">{t("hero.cta")}</Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-14 rounded-2xl text-lg"
            asChild
          >
            <a href="#features">{t("hero.secondaryCta")}</a>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="bg-card px-5 py-12"
      >
        <div className="mx-auto grid max-w-lg gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.key}
              className="flex gap-4 rounded-2xl border bg-background p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <feature.icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold leading-snug">
                  {t(`features.${feature.key}.title`)}
                </h3>
                <p className="mt-1 text-base leading-relaxed text-muted-foreground">
                  {t(`features.${feature.key}.description`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust / Disclaimer */}
      <section className="px-5 py-10">
        <div className="mx-auto flex max-w-lg items-start gap-3 rounded-2xl bg-secondary/50 p-5">
          <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
          <p className="text-base leading-relaxed text-muted-foreground">
            {t("trust.disclaimer")}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t px-5 py-6 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} {tCommon("appName")}</p>
      </footer>
    </div>
  )
}
