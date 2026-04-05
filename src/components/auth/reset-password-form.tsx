"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Link, useRouter } from "@/i18n/routing"
import { resetPassword } from "@/lib/auth-client"

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const error = searchParams.get("error")
  const t = useTranslations("authPages.resetPassword")
  const tRegister = useTranslations("authPages.register")
  const tErrors = useTranslations("authPages.errors")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [formError, setFormError] = useState("")
  const [isPending, setIsPending] = useState(false)

  if (error === "invalid_token" || !token) {
    return (
      <div className="space-y-4 w-full max-w-sm text-center">
        <p className="text-sm text-destructive">
          {error === "invalid_token"
            ? t("invalidToken")
            : t("noToken")}
        </p>
        <Link href="/forgot-password">
          <Button variant="outline" className="w-full">
            {t("requestNewLink")}
          </Button>
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")

    if (password !== confirmPassword) {
      setFormError(tRegister("passwordMismatch"))
      return
    }

    if (password.length < 8) {
      setFormError(tRegister("passwordTooShort"))
      return
    }

    setIsPending(true)

    try {
      const result = await resetPassword({
        newPassword: password,
        token,
      })

      if (result.error) {
        setFormError(result.error.message || tErrors("resetFailed"))
      } else {
        router.push("/login?reset=success")
      }
    } catch {
      setFormError(tErrors("unexpected"))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      <div className="space-y-2">
        <Label htmlFor="password">{t("newPassword")}</Label>
        <Input
          id="password"
          type="password"
          placeholder={t("newPasswordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isPending}
          className="min-h-12 text-base"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{tRegister("confirmPassword")}</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder={t("confirmPlaceholder")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={isPending}
          className="min-h-12 text-base"
        />
      </div>
      {formError && (
        <p className="text-sm text-destructive">{formError}</p>
      )}
      <Button type="submit" className="min-h-12 w-full" disabled={isPending}>
        {isPending ? t("resetting") : t("resetButton")}
      </Button>
    </form>
  )
}
