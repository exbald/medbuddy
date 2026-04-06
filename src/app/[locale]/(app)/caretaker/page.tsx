"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Loader2,
  Clock,
  X,
  AlertCircle,
  TrendingUp,
  Pill,
  UserX,
  FileText,
  History,
  Share2,
  Link2,
  Copy,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Link } from "@/i18n/routing"
import { MedicationRow } from "./_components/medication-row"

interface ScheduleMed {
  logId: string
  medicationId: string
  name: string
  nameLocal: string | null
  dosage: string | null
  status: "pending" | "taken" | "missed" | "skipped"
  scheduledAt: string
  takenAt: string | null
}

interface TimeSlotGroup {
  timeSlot: string
  scheduledTime: string
  medications: ScheduleMed[]
}

interface WeekStats {
  taken: number
  missed: number
  pending: number
  total: number
  percentage: number
}

interface MissedDose {
  name: string
  nameLocal: string | null
  dosage: string | null
  scheduledAt: string
}

interface CaretakerData {
  patient: { name: string; email: string } | null
  medications: Array<{
    id: string
    name: string
    nameLocal: string | null
    dosage: string | null
    timing: string[] | null
  }>
  todaySchedule: TimeSlotGroup[]
  weekStats: WeekStats
  recentMissed: MissedDose[]
}

export default function CaretakerPage() {
  const t = useTranslations("caretaker")
  const tSlots = useTranslations("timeSlots")
  const tCommon = useTranslations("common")
  const tStatus = useTranslations("status")
  const tSummary = useTranslations("healthSummary")

  const [data, setData] = useState<CaretakerData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const fetchedRef = useRef(false)

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch("/api/caretaker/patient")
      if (!response.ok) {
        throw new Error(t("loadError"))
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : tCommon("error")
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [t, tCommon])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetchData()
  }, [fetchData])

  const handleGenerateInvite = useCallback(async () => {
    setInviteLoading(true)
    try {
      const response = await fetch("/api/caretaker/invite", { method: "POST" })
      if (!response.ok) {
        throw new Error(t("loadError"))
      }
      const result = await response.json()
      setInviteCode(result.inviteCode)
    } catch {
      setError(t("loadError"))
    } finally {
      setInviteLoading(false)
    }
  }, [t])

  const handleCopyLink = useCallback(async () => {
    if (!inviteCode) return
    const url = `${window.location.origin}/invite/${inviteCode}`
    try {
      await navigator.clipboard.writeText(url)
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2000)
    } catch {
      // Clipboard API not available; silently fail
    }
  }, [inviteCode])

  const handleShareLink = useCallback(async () => {
    if (!inviteCode) return
    const url = `${window.location.origin}/invite/${inviteCode}`
    try {
      await navigator.share({ title: t("inviteLink"), url })
    } catch {
      // Share cancelled or unavailable; silently fail
    }
  }, [inviteCode, t])

  if (isLoading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-6">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-center text-lg text-destructive">{error}</p>
        <Button onClick={() => window.location.reload()}>
          {tCommon("retry")}
        </Button>
      </div>
    )
  }

  // No linked patient
  if (!data?.patient) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-6 text-center">
        <UserX className="h-16 w-16 text-muted-foreground/40" />
        <div>
          <p className="text-lg text-muted-foreground">{t("noPatient")}</p>
          <p className="text-sm text-muted-foreground">{t("noPatientHint")}</p>
        </div>

        {!inviteCode ? (
          <div className="flex flex-col items-center gap-2">
            <Button
              size="lg"
              className="min-h-12 text-base"
              onClick={handleGenerateInvite}
              disabled={inviteLoading}
            >
              <span className="mr-2 h-4 w-4">
                {inviteLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
              </span>
              {t("invitePatient")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t("invitePatientDesc")}
            </p>
          </div>
        ) : (
          <div className="flex w-full max-w-sm flex-col items-center gap-4">
            {/* Shareable link */}
            <div className="w-full">
              <p className="mb-1.5 text-sm font-medium">{t("inviteLink")}</p>
              <div className="rounded-md border bg-muted/50 px-3 py-2.5">
                <p className="break-all text-sm">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/invite/${inviteCode}`
                    : `/invite/${inviteCode}`}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                className="min-h-12"
                onClick={handleCopyLink}
              >
                <Copy className="mr-2 h-4 w-4" />
                {inviteCopied ? t("linkCopied") : t("copyLink")}
              </Button>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <Button
                  size="lg"
                  className="min-h-12"
                  onClick={handleShareLink}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  {t("shareLink")}
                </Button>
              )}
            </div>

            {/* Manual code */}
            <div className="flex flex-col items-center gap-1.5">
              <p className="text-sm text-muted-foreground">
                {t("orManualCode")}
              </p>
              <p className="font-mono text-2xl font-bold tracking-widest">
                {inviteCode}
              </p>
            </div>

            {/* Pending status */}
            <p className="text-sm text-muted-foreground">
              <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />
              {t("invitePending")}
            </p>
          </div>
        )}
      </div>
    )
  }

  const { patient, todaySchedule, weekStats, recentMissed } = data

  return (
    <div className="mx-auto max-w-lg p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("monitoring", { name: patient.name })}
        </p>
      </div>

      {/* 7-Day Adherence Stats */}
      <section className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          {t("weeklyAdherence")}
        </h2>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">
                  {weekStats.percentage}
                  <span className="text-lg font-normal text-muted-foreground">%</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("takenCount", { taken: weekStats.taken, total: weekStats.total })}
                </p>
              </div>
              <div className="flex gap-3 text-center text-xs">
                <div>
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {weekStats.taken}
                  </p>
                  <p className="text-muted-foreground">{tStatus("taken")}</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-destructive">
                    {weekStats.missed}
                  </p>
                  <p className="text-muted-foreground">{tStatus("missed")}</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">
                    {weekStats.pending}
                  </p>
                  <p className="text-muted-foreground">{tStatus("pending")}</p>
                </div>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${weekStats.percentage}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="mb-6 flex justify-end gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/health-summary?for=patient">
            <FileText className="mr-2 h-4 w-4" />
            {tSummary("generate")}
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/caretaker/history">
            <History className="mr-2 h-4 w-4" />
            {t("history.viewHistory")}
          </Link>
        </Button>
      </div>

      {/* Today's Schedule */}
      <section className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Clock className="h-5 w-5 text-muted-foreground" />
          {t("todaySchedule")}
        </h2>

        {todaySchedule.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
              <Pill className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t("noSchedule")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {todaySchedule.map((group) => (
              <Card key={group.timeSlot}>
                <CardHeader className="px-4 pb-2 pt-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {tSlots(group.timeSlot)} &middot; {group.scheduledTime}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 px-4 pb-4">
                  {group.medications.map((med) => (
                    <MedicationRow
                      key={med.logId}
                      name={med.name}
                      nameLocal={med.nameLocal}
                      dosage={med.dosage}
                      status={med.status}
                      statusLabel={tStatus(med.status === "skipped" ? "missed" : med.status)}
                    />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Recent Missed Doses */}
      <section className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
          {t("recentMissed")}
        </h2>

        {recentMissed.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center p-6">
              <p className="text-sm text-muted-foreground">
                {t("noMissedDoses")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {recentMissed.map((dose, idx) => {
                const scheduledDate = new Date(dose.scheduledAt)
                const dateStr = scheduledDate.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
                const timeStr = `${String(scheduledDate.getHours()).padStart(2, "0")}:${String(scheduledDate.getMinutes()).padStart(2, "0")}`

                return (
                  <div key={`${dose.scheduledAt}-${idx}`} className="flex items-center gap-3 px-4 py-3">
                    <X className="h-4 w-4 shrink-0 text-destructive" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {dose.name}
                        {dose.nameLocal && dose.nameLocal !== dose.name && (
                          <span className="ml-1.5 font-normal text-muted-foreground">
                            {dose.nameLocal}
                          </span>
                        )}
                      </p>
                      {dose.dosage && (
                        <p className="text-xs text-muted-foreground">{dose.dosage}</p>
                      )}
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {dateStr} {timeStr}
                    </p>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
