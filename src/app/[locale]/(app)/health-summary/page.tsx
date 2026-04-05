"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, Printer } from "lucide-react"
import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

const PERIODS = [7, 14, 30] as const

interface MedAdherence {
  taken: number
  missed: number
  total: number
  percentage: number
}

interface MedicationSummary {
  name: string
  nameLocal: string | null
  dosage: string
  purpose: string | null
  timing: string[]
  adherence: MedAdherence
}

interface Interaction {
  medAName: string
  medBName: string
  severity: string
  type: string
  description: string
}

interface OverallAdherence {
  taken: number
  missed: number
  pending: number
  total: number
  percentage: number
}

interface SummaryData {
  patient: { name: string }
  generatedAt: string
  period: number
  medications: MedicationSummary[]
  overallAdherence: OverallAdherence
  interactions: Interaction[]
  narrative: string | null
}

export default function HealthSummaryPage() {
  const t = useTranslations("healthSummary")
  const tSlots = useTranslations("timeSlots")

  const [period, setPeriod] = useState<number>(14)
  const [data, setData] = useState<SummaryData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchedPeriodRef = useRef<number | null>(null)

  const fetchSummary = useCallback(async (days: number) => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set("period", String(days))

      // Check if URL has for=patient
      const urlParams = new URLSearchParams(window.location.search)
      const forParam = urlParams.get("for")
      if (forParam === "patient") {
        params.set("for", "patient")
      }

      const response = await fetch(`/api/health-summary?${params}`)
      if (!response.ok) throw new Error("Failed to fetch")
      const result = await response.json()
      setData(result)
    } catch {
      setError(t("error"))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (fetchedPeriodRef.current === period) return
    fetchedPeriodRef.current = period
    fetchSummary(period)
  }, [period, fetchSummary])

  function handlePrint() {
    window.print()
  }

  function severityColor(severity: string) {
    switch (severity) {
      case "high":
        return "destructive"
      case "medium":
        return "outline"
      default:
        return "secondary"
    }
  }

  if (error) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-6">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-center text-lg text-destructive">{error}</p>
        <Button onClick={() => fetchSummary(period)}>{t("generating").replace("...", "")}</Button>
      </div>
    )
  }

  return (
    <div className="summary-page mx-auto max-w-2xl p-4 pb-24">
      {/* Header with controls */}
      <div className="mb-6 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          {data && (
            <p className="mt-1 text-sm text-muted-foreground">
              {data.patient.name} &middot;{" "}
              {new Date(data.generatedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="no-print min-h-12 min-w-12"
          onClick={handlePrint}
          disabled={isLoading}
        >
          <Printer className="h-5 w-5" />
        </Button>
      </div>

      {/* Period selector */}
      <div className="no-print mb-6 flex gap-2">
        {PERIODS.map((d) => (
          <Button
            key={d}
            variant={period === d ? "default" : "outline"}
            className="min-h-12 flex-1 text-base"
            onClick={() => setPeriod(d)}
            disabled={isLoading}
          >
            {t(`days${d}` as "days7" | "days14" | "days30")}
          </Button>
        ))}
      </div>

      {/* Print-only period text */}
      <p className="print-only mb-4 text-sm text-muted-foreground">
        {t("period", { days: period })}
      </p>

      {isLoading ? (
        <LoadingSkeleton />
      ) : data ? (
        <div className="space-y-6">
          {/* AI Narrative */}
          {data.narrative && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("narrative")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{data.narrative}</p>
              </CardContent>
            </Card>
          )}

          {/* Medications */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">
              {t("medications")} ({data.medications.length})
            </h2>
            {data.medications.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  {t("noMedications")}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {data.medications.map((med) => (
                  <Card key={med.name}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {med.name}
                            {med.nameLocal && med.nameLocal !== med.name && (
                              <span className="ml-2 font-normal text-muted-foreground">
                                {med.nameLocal}
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {med.dosage}
                          </p>
                          {med.purpose && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {t("purpose")}: {med.purpose}
                            </p>
                          )}
                          {med.timing && med.timing.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {med.timing.map((slot) => (
                                <Badge key={slot} variant="secondary" className="text-xs">
                                  {tSlots(slot)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xl font-bold">
                            {med.adherence.percentage}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {med.adherence.taken}/{med.adherence.total}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Overall Adherence */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">{t("adherence")}</h2>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {t("overallRate")}
                  </p>
                  <p className="text-2xl font-bold">
                    {data.overallAdherence.percentage}%
                  </p>
                </div>
                <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${data.overallAdherence.percentage}%` }}
                  />
                </div>
                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-green-600 dark:text-green-400">
                    {t("taken")}: {data.overallAdherence.taken}
                  </span>
                  <span className="text-destructive">
                    {t("missed")}: {data.overallAdherence.missed}
                  </span>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Drug Interactions */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">
              {t("interactions")}
              {data.interactions.length > 0 && ` (${data.interactions.length})`}
            </h2>
            {data.interactions.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  {t("noInteractions")}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {data.interactions.map((ix, idx) => (
                  <Card key={`${ix.medAName}-${ix.medBName}-${idx}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">
                          {ix.medAName} &harr; {ix.medBName}
                        </p>
                        <Badge variant={severityColor(ix.severity)}>
                          {ix.severity}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {ix.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <Separator />

          {/* Disclaimer */}
          <p className="text-center text-xs text-muted-foreground">
            ⚕ {t("disclaimer")}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
