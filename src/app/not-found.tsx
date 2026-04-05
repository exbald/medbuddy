import { headers } from "next/headers"
import Link from "next/link"
import { FileQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"
import { routing } from "@/i18n/routing"

// Inline translations for the global not-found page, which lives outside
// the [locale] route and therefore cannot use next-intl hooks.
const translations = {
  en: {
    heading: "Page Not Found",
    description: "The page you're looking for doesn't exist or has been moved.",
    goHome: "Go home",
  },
  "zh-TW": {
    heading: "找不到頁面",
    description: "您要找的頁面不存在或已移動。",
    goHome: "回首頁",
  },
} as const

type Locale = keyof typeof translations

async function detectLocale(): Promise<Locale> {
  const h = await headers()
  const pathname = h.get("x-next-url") ?? h.get("x-invoke-path") ?? ""
  for (const locale of routing.locales) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return locale as Locale
    }
  }
  return routing.defaultLocale as Locale
}

export default async function NotFound() {
  const locale = await detectLocale()
  const t = translations[locale]
  const homePath = locale === "en" ? "/en" : "/"

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-md mx-auto text-center">
        <div className="flex justify-center mb-6">
          <FileQuestion className="h-16 w-16 text-muted-foreground" />
        </div>
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <h2 className="text-xl font-semibold mb-4">{t.heading}</h2>
        <p className="text-muted-foreground mb-6">{t.description}</p>
        <Button asChild>
          <Link href={homePath}>{t.goHome}</Link>
        </Button>
      </div>
    </div>
  )
}
