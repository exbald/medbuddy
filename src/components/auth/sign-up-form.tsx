"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Link, useRouter } from "@/i18n/routing"
import { signIn, signUp } from "@/lib/auth-client"

export function SignUpForm() {
  const router = useRouter()
  const locale = useLocale()
  const localePrefix = locale === "zh-TW" ? "" : `/${locale}`
  const t = useTranslations("authPages.register")
  const tAuth = useTranslations("auth")
  const tErrors = useTranslations("authPages.errors")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError(t("passwordMismatch"))
      return
    }

    if (password.length < 8) {
      setError(t("passwordTooShort"))
      return
    }

    setIsPending(true)

    try {
      const result = await signUp.email({
        name,
        email,
        password,
        callbackURL: `${localePrefix}/home`,
      })

      if (result.error) {
        setError(result.error.message || tErrors("signUpFailed"))
      } else {
        router.push("/home")
        router.refresh()
      }
    } catch {
      setError(tErrors("unexpected"))
    } finally {
      setIsPending(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError("")
    setIsPending(true)
    try {
      await signIn.social({
        provider: "google",
        callbackURL: `${localePrefix}/home`,
      })
    } catch {
      setError(tErrors("unexpected"))
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-4 w-full max-w-sm">
      <Button
        type="button"
        variant="outline"
        className="min-h-12 w-full gap-2"
        onClick={handleGoogleSignIn}
        disabled={isPending}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        {tAuth("continueWithGoogle")}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-background px-2 text-muted-foreground">{tAuth("orContinueWith")}</span>
        </div>
      </div>

    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{tAuth("name")}</Label>
        <Input
          id="name"
          type="text"
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isPending}
          className="min-h-12 text-base"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{tAuth("email")}</Label>
        <Input
          id="email"
          type="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isPending}
          className="min-h-12 text-base"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{tAuth("password")}</Label>
        <Input
          id="password"
          type="password"
          placeholder={t("passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isPending}
          className="min-h-12 text-base"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder={t("confirmPasswordPlaceholder")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={isPending}
          className="min-h-12 text-base"
        />
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <Button type="submit" className="min-h-12 w-full" disabled={isPending}>
        {isPending ? t("creating") : tAuth("createAccount")}
      </Button>
      <div className="text-center text-sm text-muted-foreground">
        {tAuth("hasAccount")}{" "}
        <Link href="/login" className="text-primary hover:underline">
          {tAuth("signIn")}
        </Link>
      </div>
    </form>
    </div>
  )
}
