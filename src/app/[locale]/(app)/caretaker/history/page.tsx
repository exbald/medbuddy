"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, Pill } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TAIPEI_OFFSET_MS } from "@/lib/constants"
import { Link } from "@/i18n/routing"
import { MedicationRow } from "../_components/medication-row"

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

interface DaySummary {
  taken: number
  missed: number
  skipped: number
  pending: number
  total: number
  percentage: number
}

interface HistoryData {
  date: string
  patient: { name: string }
  schedule: TimeSlotGroup[]
  summary: DaySummary
}

function getTodayStr(): string {
  const now = new Date()
  const taipeiMs = now.getTime() + TAIPEI_OFFSET_MS
  const d = new Date(taipeiMs)
  return d.toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number): string {
  const parts = dateStr.split("-").map(Number)
  const date = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export default function CaretakerHistoryPage() {
  const t = useTranslations("caretaker")
  const tSlots = useTranslations("timeSlots")
  const tStatus = useTranslations("status")
  const tCommon = useTranslations("common")
  const locale = useLocale()

  const [currentDate, setCurrentDate] = useState(getTodayStr)
  const [data, setData] = useState<HistoryData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Recompute today/min on each render to stay fresh past midnight
  const todayStr = getTodayStr()
  const minDate = addDays(todayStr, -29)
  const isToday = currentDate === todayStr
  const isOldest = currentDate <= minDate

  // Format date for display using Intl
  const displayDate = new Intl.DateTimeFormat(locale === "zh-TW" ? "zh-TW" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(currentDate + "T00:00:00+08:00"))

  const fetchData = useCallback(async (date: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/caretaker/patient/history?date=${date}`, {
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(t("loadError"))
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      const message = err instanceof Error ? err.message : tCommon("error")
      setError(message)
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [t, tCommon])

  useEffect(() => {
    fetchData(currentDate)
  }, [currentDate, fetchData])

  const goPrev = () => {
    const fresh = getTodayStr()
    const min = addDays(fresh, -29)
    setCurrentDate(prev => {
      const next = addDays(prev, -1)
      return next < min ? prev : next
    })
  }
  const goNext = () => {
    const fresh = getTodayStr()
    setCurrentDate(prev => {
      const next = addDays(prev, 1)
      return next > fresh ? prev : next
    })
  }
  const goToday = () => setCurrentDate(getTodayStr())

  return (
    <div className="mx-auto max-w-lg p-4">
      {/* Back + Title */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
          <Link href="/caretaker">
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t("history.back")}
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{t("history.title")}</h1>
      </div>

      {/* Date Navigation */}
      <div className="mb-6 flex items-center justify-between rounded-lg border bg-card p-2">
        <Button variant="ghost" size="icon" disabled={isOldest} onClick={goPrev}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm font-medium">{displayDate}</span>
        <Button variant="ghost" size="icon" disabled={isToday} onClick={goNext}>
          <ChevronRight className="h-5 w-5" />
        </Button>
        <Button variant="outline" size="sm" disabled={isToday} onClick={goToday}>
          {t("history.today")}
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex min-h-[40dvh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-4 p-6">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-center text-lg text-destructive">{error}</p>
          <Button onClick={() => fetchData(currentDate)}>
            {tCommon("retry")}
          </Button>
        </div>
      )}

      {/* Content */}
      {data && !isLoading && !error && (
        <>
          {/* Day Summary */}
          <section className="mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold">
                      {data.summary.percentage}
                      <span className="text-lg font-normal text-muted-foreground">%</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("history.daySummary", {
                        taken: data.summary.taken,
                        total: data.summary.total,
                      })}
                    </p>
                  </div>
                  <div className="flex gap-3 text-center text-xs">
                    <div>
                      <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {data.summary.taken}
                      </p>
                      <p className="text-muted-foreground">{tStatus("taken")}</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-destructive">
                        {data.summary.missed}
                      </p>
                      <p className="text-muted-foreground">{tStatus("missed")}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${data.summary.percentage}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Schedule by Time Slot */}
          {data.schedule.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                <Pill className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t("history.noLogs")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {data.schedule.map((group) => (
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
                        statusLabel={tStatus(med.status)}
                      />
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
