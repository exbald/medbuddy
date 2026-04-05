import { Geist } from "next/font/google"
import { headers } from "next/headers"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { routing } from "@/i18n/routing"
import type { Metadata } from "next"

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "MedBuddy 藥好友",
    template: "%s | MedBuddy",
  },
  description: "您的貼心用藥好夥伴 — 掃描處方箋、設定提醒、確認服藥",
}

/**
 * Detects the active locale from the URL path.
 * Falls back to the default locale when no locale segment is present
 * (which is the case for zh-TW with localePrefix: "as-needed").
 */
async function detectLocaleFromHeaders(): Promise<string> {
  const h = await headers()
  const pathname = h.get("x-next-url") ?? h.get("x-invoke-path") ?? ""
  for (const locale of routing.locales) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return locale
    }
  }
  return routing.defaultLocale
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const lang = await detectLocaleFromHeaders()

  return (
    <html lang={lang} suppressHydrationWarning>
      <body className={`${geist.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  )
}
