"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Plus, Pill, Clock, Camera } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import { MedCard } from "@/components/med-card"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/routing"

interface AdherenceMed {
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
  medications: AdherenceMed[]
}

function getGreetingKey(): "morning" | "afternoon" | "evening" {
  const hour = new Date().getHours()
  if (hour < 12) return "morning"
  if (hour < 18) return "afternoon"
  return "evening"
}

function getFormattedDate(locale: string): string {
  return new Date().toLocaleDateString(
    locale === "zh-TW" ? "zh-TW" : "en-US",
    { weekday: "long", month: "long", day: "numeric" },
  )
}

export default function HomePage() {
  const t = useTranslations("home")
  const tSlots = useTranslations("timeSlots")
  const tCommon = useTranslations("common")
  const locale = useLocale()

  const [schedule, setSchedule] = useState<TimeSlotGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  const fetchSchedule = useCallback(async () => {
    try {
      const response = await fetch("/api/adherence/today")
      if (!response.ok) {
        throw new Error(tCommon("error"))
      }
      const data = await response.json()
      setSchedule(data.schedule)
    } catch (err) {
      const message = err instanceof Error ? err.message : tCommon("error")
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [tCommon])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetchSchedule()
  }, [fetchSchedule])

  async function handleTake(logId: string) {
    // Optimistic update
    setSchedule((prev) =>
      prev.map((group) => ({
        ...group,
        medications: group.medications.map((med) =>
          med.logId === logId
            ? {
                ...med,
                status: "taken" as const,
                takenAt: new Date().toISOString(),
              }
            : med,
        ),
      })),
    )

    try {
      const response = await fetch("/api/adherence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId, status: "taken" }),
      })

      if (!response.ok) {
        throw new Error("Failed to log dose")
      }

      toast.success(t("doseLogged"))
    } catch {
      fetchSchedule()
      toast.error(tCommon("error"))
    }
  }

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
        <p className="text-center text-lg text-destructive">{error}</p>
        <Button onClick={() => window.location.reload()}>
          {tCommon("retry")}
        </Button>
      </div>
    )
  }

  const hasMedications = schedule.some(
    (group) => group.medications.length > 0,
  )
  const greetingKey = getGreetingKey()
  const formattedDate = getFormattedDate(locale)

  return (
    <div className="mx-auto max-w-lg p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t(`greeting.${greetingKey}`)}</h1>
        <p className="text-sm text-muted-foreground">{formattedDate}</p>
      </div>

      <h2 className="mb-4 text-xl font-semibold">{t("title")}</h2>

      {!hasMedications && (
        <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-4 text-center">
          <Pill className="h-16 w-16 text-muted-foreground/40" />
          <div>
            <p className="text-lg text-muted-foreground">
              {t("noMedications")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("noMedicationsHint")}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button asChild size="lg" className="min-h-12 gap-2 text-base">
              <Link href="/medications/scan">
                <Camera className="h-5 w-5" />
                {t("scanPrescription")}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="min-h-12 gap-2 text-base">
              <Link href="/medications/add">
                <Plus className="h-5 w-5" />
                {t("addMedication")}
              </Link>
            </Button>
          </div>
        </div>
      )}

      {hasMedications && (
        <div className="space-y-6">
          {schedule.map((group) => {
            if (group.medications.length === 0) return null

            return (
              <section key={group.timeSlot}>
                <div className="mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-base font-medium text-muted-foreground">
                    {t("timeSlotHeader", {
                      slot: tSlots(group.timeSlot),
                      time: group.scheduledTime,
                    })}
                  </h3>
                </div>

                <div className="space-y-3">
                  {group.medications.map((med) => (
                    <MedCard
                      key={med.logId}
                      medication={{
                        id: med.medicationId,
                        name: med.name,
                        nameLocal: med.nameLocal,
                        dosage: med.dosage,
                      }}
                      logId={med.logId}
                      status={
                        med.status === "skipped" ? "missed" : med.status
                      }
                      scheduledTime={group.scheduledTime}
                      onTake={handleTake}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
