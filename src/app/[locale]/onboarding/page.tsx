"use client"

import { useState, useEffect, useCallback } from "react"
import { Pill, Heart, Check, Copy, Loader2, Share2, Link2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "@/i18n/routing"
import { useSession } from "@/lib/auth-client"

type Role = "patient" | "caretaker"

const TOTAL_STEPS = 3

/**
 * Onboarding wizard with 3 steps:
 * 1. Name confirmation
 * 2. Role selection (patient vs caretaker)
 * 3. Invite code (generate for patient, enter for caretaker)
 *
 * Designed for elderly users: large touch targets (48px+), 18px+ text,
 * high contrast, generous spacing.
 */
export default function OnboardingPage() {
  const t = useTranslations("onboarding")
  const tCommon = useTranslations("common")
  const tCare = useTranslations("caretaker")
  const router = useRouter()
  const { data: session } = useSession()

  const [step, setStep] = useState(1)
  const [name, setName] = useState("")
  const [role, setRole] = useState<Role | null>(null)
  const [inviteCode, setInviteCode] = useState("")
  const [enteredCode, setEnteredCode] = useState("")
  const [copied, setCopied] = useState(false)
  const [linking, setLinking] = useState(false)
  const [linkSuccess, setLinkSuccess] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState("")
  const [showInviteMode, setShowInviteMode] = useState(false)
  const [generatedCode, setGeneratedCode] = useState("")
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)

  // Pre-fill name from session
  useEffect(() => {
    if (session?.user?.name) {
      setName(session.user.name)
    }
  }, [session?.user?.name])

  // Check if user already completed onboarding
  useEffect(() => {
    async function checkOnboarding() {
      try {
        const res = await fetch("/api/onboarding")
        if (!res.ok) return

        const data = await res.json()
        if (data.complete) {
          // GET endpoint sets httpOnly cookie server-side, just redirect
          router.replace("/home")
        }
      } catch {
        // Silently fail - user will proceed with onboarding
      }
    }
    checkOnboarding()
  }, [router])

  const handleComplete = useCallback(async () => {
    if (!role || !name.trim()) return

    setCompleting(true)
    setError("")

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), role }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? tCommon("error"))
        setCompleting(false)
        return
      }

      const data = await res.json()

      if (role === "patient" && data.inviteCode) {
        setInviteCode(data.inviteCode)
      }

      setStep(3)
    } catch {
      setError(tCommon("error"))
    } finally {
      setCompleting(false)
    }
  }, [role, name, tCommon])

  const handleLink = useCallback(async () => {
    if (enteredCode.length !== 6) return

    setLinking(true)
    setError("")

    try {
      const res = await fetch("/api/onboarding/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: enteredCode.toUpperCase() }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? tCommon("error"))
        setLinking(false)
        return
      }

      setLinkSuccess(true)
    } catch {
      setError(tCommon("error"))
    } finally {
      setLinking(false)
    }
  }, [enteredCode, tCommon])

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the text (clipboard API may not be available)
    }
  }, [inviteCode])

  const handleGenerateInvite = useCallback(async () => {
    setGeneratingInvite(true)
    setError("")

    try {
      const res = await fetch("/api/caretaker/invite", {
        method: "POST",
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? tCommon("error"))
        setGeneratingInvite(false)
        return
      }

      const data = await res.json()
      setGeneratedCode(data.code ?? "")
      setShowInviteMode(true)
    } catch {
      setError(tCommon("error"))
    } finally {
      setGeneratingInvite(false)
    }
  }, [tCommon])

  const handleCopyInviteLink = useCallback(async () => {
    try {
      const link = `${window.location.origin}/invite/${generatedCode}`
      await navigator.clipboard.writeText(link)
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2000)
    } catch {
      // Clipboard API may not be available on all devices
    }
  }, [generatedCode])

  const handleShareInviteLink = useCallback(async () => {
    try {
      const link = `${window.location.origin}/invite/${generatedCode}`
      await navigator.share({
        title: "MedBuddy",
        url: link,
      })
    } catch {
      // Share API cancelled or unavailable
    }
  }, [generatedCode])

  const handleFinish = useCallback(() => {
    router.replace("/home")
  }, [router])

  return (
    <div className="flex min-h-dvh flex-col items-center px-5 py-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("welcome")}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {t("letsSetUp")}
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-8 text-center">
          <p className="text-base font-medium text-muted-foreground">
            {t("step", { current: step, total: TOTAL_STEPS })}
          </p>
          <div className="mx-auto mt-3 flex max-w-[200px] gap-2">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  i < step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-6 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-center text-base text-destructive">
            {error}
          </div>
        )}

        {/* Step 1: Name confirmation */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold">{t("nameStep.title")}</h2>
              <p className="mt-1 text-base text-muted-foreground">
                {t("nameStep.subtitle")}
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="name" className="text-base">
                {t("nameStep.nameLabel")}
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-14 text-lg"
                autoFocus
              />
            </div>

            <Button
              size="lg"
              className="h-14 w-full text-lg font-semibold"
              disabled={!name.trim()}
              onClick={() => setStep(2)}
            >
              {tCommon("next")}
            </Button>
          </div>
        )}

        {/* Step 2: Role selection */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold">{t("roleStep.title")}</h2>
              <p className="mt-1 text-base text-muted-foreground">
                {t("roleStep.subtitle")}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <RoleCard
                icon={<Pill className="h-8 w-8" />}
                title={t("roleStep.patient")}
                description={t("roleStep.patientDesc")}
                selected={role === "patient"}
                onClick={() => setRole("patient")}
              />
              <RoleCard
                icon={<Heart className="h-8 w-8" />}
                title={t("roleStep.caretaker")}
                description={t("roleStep.caretakerDesc")}
                selected={role === "caretaker"}
                onClick={() => setRole("caretaker")}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                className="h-14 flex-1 text-lg"
                onClick={() => setStep(1)}
              >
                {tCommon("back")}
              </Button>
              <Button
                size="lg"
                className="h-14 flex-1 text-lg font-semibold"
                disabled={!role || completing}
                onClick={handleComplete}
              >
                {completing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {t("completing")}
                  </>
                ) : (
                  tCommon("next")
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Invite code */}
        {step === 3 && role === "patient" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold">
                {t("inviteStep.patientTitle")}
              </h2>
              <p className="mt-1 text-base text-muted-foreground">
                {t("inviteStep.patientSubtitle")}
              </p>
            </div>

            {/* Invite code display */}
            <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-6 text-center">
              <p className="font-mono text-4xl font-bold tracking-[0.3em] text-primary">
                {inviteCode}
              </p>
            </div>

            <Button
              variant="outline"
              size="lg"
              className="h-14 w-full text-lg"
              onClick={handleCopyCode}
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-5 w-5" />
                  {t("inviteStep.copied")}
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-5 w-5" />
                  {t("inviteStep.copyCode")}
                </>
              )}
            </Button>

            <Button
              size="lg"
              className="h-14 w-full text-lg font-semibold"
              onClick={handleFinish}
            >
              {t("complete")}
            </Button>
          </div>
        )}

        {step === 3 && role === "caretaker" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold">
                {t("inviteStep.caretakerTitle")}
              </h2>
              <p className="mt-1 text-base text-muted-foreground">
                {t("inviteStep.caretakerSubtitle")}
              </p>
            </div>

            {linkSuccess ? (
              <div className="rounded-2xl border-2 border-green-500/20 bg-green-500/10 p-6 text-center">
                <Check className="mx-auto mb-2 h-10 w-10 text-green-600" />
                <p className="text-lg font-semibold text-green-700 dark:text-green-400">
                  {t("inviteStep.linkSuccess")}
                </p>
              </div>
            ) : showInviteMode ? (
              <div className="space-y-4">
                {/* Shareable invite link */}
                <div className="space-y-3">
                  <p className="text-center text-base font-medium">
                    {tCare("inviteLink")}
                  </p>
                  <div className="flex items-center gap-2 rounded-xl border-2 border-muted bg-muted/30 p-3">
                    <Link2 className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-base">
                      {typeof window !== "undefined"
                        ? `${window.location.origin}/invite/${generatedCode}`
                        : `/invite/${generatedCode}`}
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-14 flex-1 text-lg"
                      onClick={handleCopyInviteLink}
                    >
                      {inviteCopied ? (
                        <>
                          <Check className="mr-2 h-5 w-5" />
                          {tCare("linkCopied")}
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-5 w-5" />
                          {tCare("copyLink")}
                        </>
                      )}
                    </Button>
                    {typeof navigator !== "undefined" &&
                      "share" in navigator && (
                        <Button
                          variant="outline"
                          size="lg"
                          className="h-14 flex-1 text-lg"
                          onClick={handleShareInviteLink}
                        >
                          <Share2 className="mr-2 h-5 w-5" />
                          {tCare("shareLink")}
                        </Button>
                      )}
                  </div>
                </div>

                {/* Manual code display */}
                <div className="space-y-2 text-center">
                  <p className="text-base text-muted-foreground">
                    {tCare("orManualCode")}
                  </p>
                  <p className="font-mono text-4xl font-bold tracking-[0.3em] text-primary">
                    {generatedCode}
                  </p>
                </div>

                {/* Waiting indicator */}
                <p className="text-center text-base text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {tCare("invitePending")}
                </p>

                {/* Toggle back to code entry */}
                <button
                  type="button"
                  className="mx-auto block min-h-[48px] text-lg text-primary underline underline-offset-4"
                  onClick={() => setShowInviteMode(false)}
                >
                  {t("inviteStep.caretakerTitle")}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  type="text"
                  value={enteredCode}
                  onChange={(e) =>
                    setEnteredCode(e.target.value.toUpperCase().slice(0, 6))
                  }
                  placeholder={t("inviteStep.codePlaceholder")}
                  className="h-14 text-center font-mono text-2xl tracking-[0.2em] uppercase"
                  maxLength={6}
                  autoFocus
                />

                <Button
                  size="lg"
                  className="h-14 w-full text-lg font-semibold"
                  disabled={enteredCode.length !== 6 || linking}
                  onClick={handleLink}
                >
                  {linking ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {t("inviteStep.linking")}
                    </>
                  ) : (
                    t("inviteStep.linkAccount")
                  )}
                </Button>

                {/* Divider */}
                <div className="flex items-center gap-3 py-2">
                  <div className="h-px flex-1 bg-muted-foreground/30" />
                  <span className="text-base text-muted-foreground">or</span>
                  <div className="h-px flex-1 bg-muted-foreground/30" />
                </div>

                {/* Invite instead toggle */}
                <button
                  type="button"
                  className="mx-auto block min-h-[48px] text-lg text-primary underline underline-offset-4"
                  disabled={generatingInvite}
                  onClick={handleGenerateInvite}
                >
                  {generatingInvite ? (
                    <Loader2 className="mr-2 inline h-5 w-5 animate-spin" />
                  ) : null}
                  <span>
                    {t("inviteStep.noCodePrompt")}{" "}
                    {t("inviteStep.inviteInstead")}
                  </span>
                </button>
              </div>
            )}

            <Button
              size="lg"
              className="h-14 w-full text-lg font-semibold"
              variant={linkSuccess ? "default" : "outline"}
              onClick={handleFinish}
            >
              {linkSuccess
                ? t("complete")
                : t("inviteStep.skipForNow")}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Large, accessible role selection card with clear selected state.
 */
function RoleCard({
  icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      className={`cursor-pointer transition-all ${
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary"
          : "hover:border-primary/40 hover:shadow-md"
      }`}
    >
      <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
            selected
              ? "bg-primary text-primary-foreground"
              : "bg-primary/10 text-primary"
          }`}
        >
          {icon}
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  )
}
