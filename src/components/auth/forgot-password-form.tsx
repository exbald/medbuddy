"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Link } from "@/i18n/routing"
import { requestPasswordReset } from "@/lib/auth-client"

export function ForgotPasswordForm() {
  const locale = useLocale()
  const localePrefix = locale === "zh-TW" ? "" : `/${locale}`
  const t = useTranslations("authPages.forgotPassword")
  const tAuth = useTranslations("auth")
  const tErrors = useTranslations("authPages.errors")
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsPending(true)

    try {
      const result = await requestPasswordReset({
        email,
        redirectTo: `${localePrefix}/reset-password`,
      })

      if (result.error) {
        setError(result.error.message || tErrors("resetFailed"))
      } else {
        setSuccess(true)
      }
    } catch {
      setError(tErrors("unexpected"))
    } finally {
      setIsPending(false)
    }
  }

  if (success) {
    return (
      <div className="space-y-4 w-full max-w-sm text-center">
        <p className="text-sm text-muted-foreground">
          {t("successMessage")}
        </p>
        <Link href="/login">
          <Button variant="outline" className="w-full">
            {t("backToSignIn")}
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
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
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <Button type="submit" className="min-h-12 w-full" disabled={isPending}>
        {isPending ? t("sending") : t("sendResetLink")}
      </Button>
      <div className="text-center text-sm text-muted-foreground">
        {t("rememberPassword")}{" "}
        <Link href="/login" className="text-primary hover:underline">
          {tAuth("signIn")}
        </Link>
      </div>
    </form>
  )
}
