import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"
import createMiddleware from "next-intl/middleware"
import { routing } from "@/i18n/routing"

const intlMiddleware = createMiddleware(routing)

/** Routes that require authentication */
const protectedRoutes = ["/home", "/medications", "/chat", "/profile", "/onboarding", "/caretaker"]

/** Routes that require both auth AND completed onboarding */
const onboardingRequiredRoutes = ["/home", "/medications", "/chat", "/profile", "/caretaker"]

/**
 * Extract the locale prefix from the pathname, preserving it for redirects.
 * Returns empty string for the default locale (zh-TW uses no prefix).
 */
function getLocalePrefix(pathname: string): string {
  const match = pathname.match(/^\/(zh-TW|en)/)
  if (!match) return ""
  const locale = match[1]
  return locale === routing.defaultLocale ? "" : `/${locale}`
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Run intl middleware first for locale handling
  const intlResponse = intlMiddleware(request)

  // Check if this is a protected route (strip locale prefix if present)
  const pathnameWithoutLocale = pathname.replace(/^\/(zh-TW|en)/, "") || "/"
  const isProtected = protectedRoutes.some((route) => pathnameWithoutLocale.startsWith(route))

  if (isProtected) {
    const sessionCookie = getSessionCookie(request)
    if (!sessionCookie) {
      const prefix = getLocalePrefix(pathname)
      return NextResponse.redirect(new URL(`${prefix}/`, request.url))
    }

    // For routes that require onboarding, redirect if not yet completed
    const requiresOnboarding = onboardingRequiredRoutes.some((route) =>
      pathnameWithoutLocale.startsWith(route)
    )
    if (requiresOnboarding) {
      const onboardingCookie = request.cookies.get("onboarding_complete")
      if (!onboardingCookie?.value) {
        const prefix = getLocalePrefix(pathname)
        return NextResponse.redirect(new URL(`${prefix}/onboarding`, request.url))
      }
    }
  }

  return intlResponse
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
