"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Copy, ExternalLink, FileText, Loader2, LogOut, Globe, MessageCircle, RefreshCw, Sun, Moon, Monitor, UserPlus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Link, useRouter } from "@/i18n/routing"
import { signOut } from "@/lib/auth-client"

interface ProfileData {
  id: string
  name: string
  email: string
  role: string | null
  locale: string | null
  telegramChatId: string | null
  reminderTimes: {
    morning: string
    afternoon: string
    evening: string
    bedtime: string
  }
}

const TIME_SLOTS = ["morning", "afternoon", "evening", "bedtime"] as const

export default function ProfilePage() {
  const t = useTranslations("profile")
  const tTg = useTranslations("profile.telegram")
  const tCg = useTranslations("profile.caregiver")
  const tSlots = useTranslations("timeSlots")
  const tCommon = useTranslations("common")
  const tSummary = useTranslations("healthSummary")
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  const STORAGE_KEY = "profile-accordion-open"

  const [openSections, setOpenSections] = useState<string[]>(() => {
    if (typeof window === "undefined") return ["reminders"]
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : ["reminders"]
    } catch {
      return ["reminders"]
    }
  })

  function handleAccordionChange(value: string[]) {
    setOpenSections(value)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      // localStorage unavailable
    }
  }

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [linkingCode, setLinkingCode] = useState<string | null>(null)
  const [isLinking, setIsLinking] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteClaimed, setInviteClaimed] = useState(false)
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [reminderTimes, setReminderTimes] = useState({
    morning: "08:00",
    afternoon: "12:30",
    evening: "18:00",
    bedtime: "21:30",
  })
  const fetchedRef = useRef(false)

  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch("/api/profile")
      if (!response.ok) throw new Error("Failed to load profile")
      const data = await response.json()
      setProfile(data.profile)
      setReminderTimes(data.profile.reminderTimes)

      // Fetch invite code for patients
      if (data.profile.role === "patient") {
        const inviteRes = await fetch("/api/caretaker/invite")
        if (inviteRes.ok) {
          const inviteData = await inviteRes.json()
          setInviteCode(inviteData.inviteCode)
          setInviteClaimed(inviteData.claimed)
        }
      }
    } catch {
      toast.error(tCommon("error"))
    } finally {
      setIsLoading(false)
    }
  }, [tCommon])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetchProfile()
  }, [fetchProfile])

  async function handleSaveReminders() {
    setIsSaving(true)
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderTimes }),
      })

      if (!response.ok) throw new Error("Failed to save")
      toast.success(t("remindersSaved"))
    } catch {
      toast.error(tCommon("error"))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleLocaleToggle() {
    if (!profile) return
    const newLocale = profile.locale === "zh-TW" ? "en" : "zh-TW"
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: newLocale }),
      })

      if (!response.ok) throw new Error("Failed to save")
      setProfile({ ...profile, locale: newLocale })
      toast.success(t("localeSaved"))
      router.replace("/profile", { locale: newLocale })
    } catch {
      toast.error(tCommon("error"))
    }
  }

  async function handleLinkTelegram() {
    setIsLinking(true)
    try {
      const response = await fetch("/api/telegram/link", { method: "POST" })
      if (!response.ok) throw new Error("Failed to generate code")
      const data = await response.json()
      setLinkingCode(data.code)
    } catch {
      toast.error(tCommon("error"))
    } finally {
      setIsLinking(false)
    }
  }

  async function handleUnlinkTelegram() {
    setIsUnlinking(true)
    try {
      const response = await fetch("/api/profile", { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to unlink")
      setProfile(profile ? { ...profile, telegramChatId: null } : null)
      toast.success(tTg("unlinkSuccess"))
    } catch {
      toast.error(tCommon("error"))
    } finally {
      setIsUnlinking(false)
    }
  }

  async function handleCopyCode() {
    if (!linkingCode) return
    await navigator.clipboard.writeText(`/start ${linkingCode}`)
    setCodeCopied(true)
    toast.success(tTg("codeCopied"))
    setTimeout(() => setCodeCopied(false), 2000)
  }

  async function handleGenerateInvite() {
    setIsGeneratingInvite(true)
    try {
      const response = await fetch("/api/caretaker/invite", { method: "POST" })
      if (!response.ok) throw new Error("Failed to generate invite code")
      const data = await response.json()
      setInviteCode(data.inviteCode)
      setInviteClaimed(false)
    } catch {
      toast.error(tCommon("error"))
    } finally {
      setIsGeneratingInvite(false)
    }
  }

  async function handleCopyInvite() {
    if (!inviteCode) return
    await navigator.clipboard.writeText(inviteCode)
    setInviteCopied(true)
    toast.success(tCg("copied"))
    setTimeout(() => setInviteCopied(false), 2000)
  }

  async function handleSignOut() {
    await signOut()
    router.replace("/")
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center p-6">
        <p className="text-lg text-muted-foreground">{tCommon("error")}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* User info — always visible */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div>
            <Label className="text-sm text-muted-foreground">
              {t("name")}
            </Label>
            <p className="text-lg">{profile.name}</p>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">
              {t("email")}
            </Label>
            <p className="text-lg">{profile.email}</p>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">
              {t("role")}
            </Label>
            <p className="text-lg">
              {t(`roles.${profile.role ?? "patient"}`)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Health Summary */}
      <Button variant="outline" className="min-h-12 w-full gap-2 text-base" asChild>
        <Link href="/health-summary">
          <FileText className="h-5 w-5" />
          {tSummary("generate")}
        </Link>
      </Button>

      {/* Collapsible sections */}
      <Card>
        <Accordion type="multiple" value={openSections} onValueChange={handleAccordionChange}>
          {/* Caregiver invite (patients only) */}
          {profile.role === "patient" && (
            <AccordionItem value="caregiver" className="px-6">
              <AccordionTrigger className="text-base font-semibold">
                <span className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  {tCg("title")}
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {tCg("description")}
                </p>
                {inviteCode && !inviteClaimed ? (
                  <>
                    <div className="flex items-center justify-center gap-3">
                      <code className="rounded-md bg-muted px-4 py-3 text-2xl font-mono tracking-widest">
                        {inviteCode}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCopyInvite}
                        aria-label={tCg("copyCode")}
                      >
                        {inviteCopied ? (
                          <Check className="h-5 w-5 text-green-500" />
                        ) : (
                          <Copy className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleGenerateInvite}
                      disabled={isGeneratingInvite}
                      className="min-h-12 w-full gap-2 text-base"
                    >
                      <RefreshCw className={`h-4 w-4 ${isGeneratingInvite ? "animate-spin" : ""}`} />
                      {isGeneratingInvite ? tCommon("loading") : tCg("regenerate")}
                    </Button>
                  </>
                ) : inviteClaimed ? (
                  <>
                    <p className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                      <Check className="h-4 w-4" />
                      {tCg("claimed")}
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleGenerateInvite}
                      disabled={isGeneratingInvite}
                      className="min-h-12 w-full gap-2 text-base"
                    >
                      <UserPlus className="h-5 w-5" />
                      {isGeneratingInvite ? tCommon("loading") : tCg("regenerate")}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleGenerateInvite}
                    disabled={isGeneratingInvite}
                    className="min-h-12 w-full gap-2 text-base"
                  >
                    <UserPlus className="h-5 w-5" />
                    {isGeneratingInvite ? tCommon("loading") : tCg("generate")}
                  </Button>
                )}
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Reminder times */}
          <AccordionItem value="reminders" className="px-6">
            <AccordionTrigger className="text-base font-semibold">
              {t("reminderTimes")}
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              {TIME_SLOTS.map((slot) => (
                <div key={slot} className="flex items-center justify-between gap-4">
                  <Label className="min-w-[80px] text-base">
                    {tSlots(slot)}
                  </Label>
                  <Input
                    type="time"
                    value={reminderTimes[slot]}
                    onChange={(e) =>
                      setReminderTimes({
                        ...reminderTimes,
                        [slot]: e.target.value,
                      })
                    }
                    className="max-w-[140px] text-base"
                  />
                </div>
              ))}
              <Button
                onClick={handleSaveReminders}
                disabled={isSaving}
                className="min-h-12 w-full text-base"
              >
                {isSaving ? tCommon("saving") : tCommon("save")}
              </Button>
            </AccordionContent>
          </AccordionItem>

          {/* Appearance & Language */}
          <AccordionItem value="appearance" className="px-6">
            <AccordionTrigger className="text-base font-semibold">
              {t("appearance")}
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div className="flex gap-2">
                {([
                  { value: "light", icon: Sun, label: t("themeLight") },
                  { value: "dark", icon: Moon, label: t("themeDark") },
                  { value: "system", icon: Monitor, label: t("themeSystem") },
                ] as const).map(({ value, icon: Icon, label }) => (
                  <Button
                    key={value}
                    variant={theme === value ? "default" : "outline"}
                    onClick={() => setTheme(value)}
                    className="min-h-12 flex-1 gap-2 text-base"
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                onClick={handleLocaleToggle}
                className="min-h-12 w-full gap-2 text-base"
              >
                <Globe className="h-5 w-5" />
                {t("switchLanguage")}
              </Button>
            </AccordionContent>
          </AccordionItem>

          {/* Notifications */}
          <AccordionItem value="notifications" className="border-b-0 px-6">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                {t("notifications")}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6">
              {/* Telegram */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">{tTg("title")}</Label>
                {profile.telegramChatId ? (
                  <>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MessageCircle className="h-4 w-4 text-green-500" />
                      {tTg("linked")}
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleUnlinkTelegram}
                      disabled={isUnlinking}
                      className="min-h-12 w-full text-base"
                    >
                      {isUnlinking ? tCommon("loading") : tTg("unlink")}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {tTg("notLinked")}
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleLinkTelegram}
                      disabled={isLinking}
                      className="min-h-12 w-full gap-2 text-base"
                    >
                      <MessageCircle className="h-5 w-5" />
                      {isLinking ? tCommon("loading") : tTg("link")}
                    </Button>
                  </>
                )}
              </div>

              {/* LINE */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">{t("line.title")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("line.notLinked")}
                </p>
                <Button
                  variant="outline"
                  disabled
                  className="min-h-12 w-full gap-2 text-base"
                >
                  {t("line.comingSoon")}
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      {/* Linking code dialog */}
      <Dialog
        open={linkingCode !== null}
        onOpenChange={(open) => {
          if (!open) setLinkingCode(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tTg("codeTitle")}</DialogTitle>
            <DialogDescription>{tTg("codeInstructions")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center gap-3">
            <code className="rounded-md bg-muted px-4 py-3 text-2xl font-mono tracking-widest">
              /start {linkingCode}
            </code>
            <Button variant="ghost" size="icon" onClick={handleCopyCode}>
              {codeCopied ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <Copy className="h-5 w-5" />
              )}
            </Button>
          </div>
          <a
            href="https://t.me/medbuddy_tw_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-sm text-primary underline"
          >
            <ExternalLink className="h-4 w-4" />
            {tTg("openBot")}
          </a>
          <p className="text-center text-sm text-muted-foreground">
            {tTg("codeExpires")}
          </p>
        </DialogContent>
      </Dialog>

      {/* Sign out */}
      <Button
        variant="destructive"
        onClick={handleSignOut}
        className="min-h-12 w-full gap-2 text-base"
      >
        <LogOut className="h-5 w-5" />
        {t("signOut")}
      </Button>
    </div>
  )
}
