"use client"

import { useEffect, useState } from "react"
import { Plus, Pill, Camera, AlertTriangle, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Link } from "@/i18n/routing"

interface MedicationItem {
  id: string
  name: string
  nameLocal: string | null
  dosage: string | null
  purpose: string | null
  timing: string[] | null
  interactionCount: number
}

export default function MedicationsPage() {
  const t = useTranslations("medications")
  const tSlots = useTranslations("timeSlots")
  const tCommon = useTranslations("common")

  const [medications, setMedications] = useState<MedicationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMedications() {
      try {
        const response = await fetch("/api/medications")
        if (!response.ok) {
          throw new Error(t("fetchError"))
        }
        const data = await response.json()
        setMedications(data.medications)
      } catch (err) {
        const message = err instanceof Error ? err.message : tCommon("error")
        setError(message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMedications()
  }, [t, tCommon])

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

  return (
    <div className="mx-auto max-w-lg p-4">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button asChild size="lg" className="min-h-12 gap-2 text-base">
          <Link href="/medications/add">
            <Plus className="h-5 w-5" />
            {t("addMedication")}
          </Link>
        </Button>
      </div>

      {/* Scan shortcut */}
      <Button
        variant="outline"
        asChild
        className="mb-4 min-h-12 w-full gap-2 text-base"
      >
        <Link href="/medications/scan">
          <Camera className="h-5 w-5" />
          {t("scanPrescription")}
        </Link>
      </Button>

      {/* Medication list or empty state */}
      {medications.length === 0 ? (
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
          <Button asChild size="lg" className="min-h-12 gap-2 text-base">
            <Link href="/medications/add">
              <Plus className="h-5 w-5" />
              {t("addMedication")}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {medications.map((med) => (
            <Link
              href={`/medications/${med.id}`}
              key={med.id}
              className="block"
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Medication name */}
                      <h3 className="text-lg font-semibold leading-tight">
                        {med.name}
                        {med.nameLocal && med.nameLocal !== med.name && (
                          <span className="ml-2 text-base font-normal text-muted-foreground">
                            {med.nameLocal}
                          </span>
                        )}
                      </h3>

                      {/* Dosage */}
                      {med.dosage && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {med.dosage}
                        </p>
                      )}

                      {/* Purpose snippet */}
                      {med.purpose && (
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed">
                          {med.purpose}
                        </p>
                      )}

                      {/* Timing badges */}
                      {med.timing && med.timing.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {med.timing.map((slot) => (
                            <Badge
                              key={slot}
                              variant="secondary"
                              className="text-xs"
                            >
                              {tSlots(
                                slot as
                                  | "morning"
                                  | "afternoon"
                                  | "evening"
                                  | "bedtime",
                              )}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Interaction warning badge */}
                    {med.interactionCount > 0 && (
                      <div className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="text-xs font-semibold text-destructive">
                          {med.interactionCount}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
