"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  AlertTriangle,
  Check,
  Clock,
  Pencil,
  SkipForward,
  Trash2,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react"
import { useLocale } from "next-intl"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Link, useRouter } from "@/i18n/routing"

const TIMING_SLOTS = ["morning", "afternoon", "evening", "bedtime"] as const
type TimingSlot = (typeof TIMING_SLOTS)[number]

interface MedicationDetail {
  id: string
  name: string
  nameLocal: string | null
  dosage: string | null
  purpose: string | null
  timing: string[] | null
  active: boolean
  createdAt: string | null
}

interface DoseLogEntry {
  id: string
  scheduledAt: string
  takenAt: string | null
  status: "pending" | "taken" | "missed" | "skipped"
  source: string | null
}

interface InteractionItem {
  id: string
  type: string
  severity: string
  description: string | null
  otherMedName: string
}

function severityVariant(severity: string) {
  switch (severity) {
    case "high":
      return "destructive" as const
    case "medium":
      return "outline" as const
    default:
      return "secondary" as const
  }
}

function severityColor(severity: string) {
  switch (severity) {
    case "high":
      return "border-destructive bg-destructive/10"
    case "medium":
      return "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20"
    default:
      return "border-muted bg-muted/50"
  }
}

export default function MedicationDetailPage() {
  const t = useTranslations("medications")
  const tSlots = useTranslations("timeSlots")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const params = useParams()
  const medicationId = params.id as string

  const locale = useLocale()

  const [med, setMed] = useState<MedicationDetail | null>(null)
  const [interactions, setInteractions] = useState<InteractionItem[]>([])
  const [recentLogs, setRecentLogs] = useState<DoseLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const [editNameLocal, setEditNameLocal] = useState("")
  const [editDosage, setEditDosage] = useState("")
  const [editTiming, setEditTiming] = useState<TimingSlot[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Deactivation state
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)

  const fetchMedication = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/medications/${medicationId}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(t("detail.notFound"))
        }
        throw new Error(t("detail.fetchError"))
      }

      const data = await response.json()
      setMed(data.medication)
      setInteractions(data.interactions)
      setRecentLogs(data.recentLogs ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : tCommon("error")
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [medicationId, t, tCommon])

  useEffect(() => {
    fetchMedication()
  }, [fetchMedication])

  function enterEditMode() {
    if (!med) return
    setEditName(med.name)
    setEditNameLocal(med.nameLocal ?? "")
    setEditDosage(med.dosage ?? "")
    setEditTiming((med.timing ?? []) as TimingSlot[])
    setIsEditing(true)
  }

  function cancelEdit() {
    setIsEditing(false)
  }

  function handleTimingToggle(slot: TimingSlot, checked: boolean) {
    setEditTiming((prev) =>
      checked ? [...prev, slot] : prev.filter((s) => s !== slot),
    )
  }

  async function handleSave() {
    if (!editName.trim()) {
      toast.error(t("add.nameRequired"))
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch(`/api/medications/${medicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          nameLocal: editNameLocal.trim() || undefined,
          dosage: editDosage.trim() || undefined,
          timing: editTiming.length > 0 ? editTiming : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error ?? t("detail.updateError"))
      }

      toast.success(t("detail.updateSuccess"))
      setIsEditing(false)
      await fetchMedication()
    } catch (err) {
      const message = err instanceof Error ? err.message : tCommon("error")
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeactivate() {
    setIsDeactivating(true)

    try {
      const response = await fetch(`/api/medications/${medicationId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error(t("detail.deactivateError"))
      }

      toast.success(t("detail.deactivateSuccess"))
      router.push("/medications")
    } catch (err) {
      const message = err instanceof Error ? err.message : tCommon("error")
      toast.error(message)
    } finally {
      setIsDeactivating(false)
      setShowDeactivateDialog(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !med) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-6">
        <p className="text-center text-lg text-destructive">
          {error ?? t("detail.notFound")}
        </p>
        <Button asChild size="lg" className="min-h-12 text-base">
          <Link href="/medications">{t("detail.backToList")}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      {/* Header with back navigation */}
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="min-h-12 min-w-12"
        >
          <Link href="/medications">
            <ArrowLeft className="h-6 w-6" />
          </Link>
        </Button>
        <h1 className="flex-1 text-2xl font-bold">{t("detail.title")}</h1>
        {!isEditing && (
          <Button
            variant="outline"
            size="icon"
            onClick={enterEditMode}
            className="min-h-12 min-w-12"
          >
            <Pencil className="h-5 w-5" />
          </Button>
        )}
      </div>

      {isEditing ? (
        /* Edit mode form */
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="edit-name" className="text-base">
              {t("add.name")}
            </Label>
            <Input
              id="edit-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="min-h-12 text-base"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-name-local" className="text-base">
              {t("add.nameLocal")}
            </Label>
            <Input
              id="edit-name-local"
              value={editNameLocal}
              onChange={(e) => setEditNameLocal(e.target.value)}
              className="min-h-12 text-base"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-dosage" className="text-base">
              {t("add.dosage")}
            </Label>
            <Input
              id="edit-dosage"
              value={editDosage}
              onChange={(e) => setEditDosage(e.target.value)}
              className="min-h-12 text-base"
              autoComplete="off"
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-base font-medium">{t("add.timing")}</legend>
            <div className="grid grid-cols-2 gap-3">
              {TIMING_SLOTS.map((slot) => (
                <label
                  key={slot}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <Checkbox
                    checked={editTiming.includes(slot)}
                    onCheckedChange={(checked) =>
                      handleTimingToggle(slot, checked === true)
                    }
                    className="h-5 w-5"
                  />
                  <span className="text-base">{tSlots(slot)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={cancelEdit}
              disabled={isSaving}
              className="min-h-12 flex-1 text-base"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              size="lg"
              onClick={handleSave}
              disabled={isSaving}
              className="min-h-12 flex-1 text-base"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {tCommon("saving")}
                </>
              ) : (
                tCommon("save")
              )}
            </Button>
          </div>
        </div>
      ) : (
        /* Display mode */
        <div className="space-y-4">
          {/* Medication info card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                {med.name}
                {med.nameLocal && med.nameLocal !== med.name && (
                  <span className="ml-2 text-lg font-normal text-muted-foreground">
                    {med.nameLocal}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dosage */}
              {med.dosage && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("detail.dosage")}
                  </p>
                  <p className="text-base">{med.dosage}</p>
                </div>
              )}

              {/* AI-generated purpose (full, not truncated) */}
              {med.purpose && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("detail.purpose")}
                  </p>
                  <p className="text-base leading-relaxed">{med.purpose}</p>
                </div>
              )}

              {/* Timing schedule as badges */}
              {med.timing && med.timing.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    {t("detail.schedule")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {med.timing.map((slot) => (
                      <Badge key={slot} variant="secondary" className="text-sm">
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
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent dose history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {t("detail.recentHistory")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentLogs.length > 0 ? (
                <div className="space-y-3">
                  {recentLogs.map((log) => {
                    const scheduledDate = new Date(log.scheduledAt)
                    const formattedDate = scheduledDate.toLocaleDateString(
                      locale === "zh-TW" ? "zh-TW" : "en-US",
                      {
                        month: locale === "zh-TW" ? "numeric" : "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      },
                    )

                    const statusConfig = {
                      taken: {
                        icon: <Check className="h-4 w-4" />,
                        label: t("detail.statusTaken"),
                        className:
                          "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                      },
                      missed: {
                        icon: <X className="h-4 w-4" />,
                        label: t("detail.statusMissed"),
                        className:
                          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                      },
                      skipped: {
                        icon: <SkipForward className="h-4 w-4" />,
                        label: t("detail.statusSkipped"),
                        className:
                          "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                      },
                      pending: {
                        icon: <Clock className="h-4 w-4" />,
                        label: t("detail.statusPending"),
                        className:
                          "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                      },
                    } as const

                    const config = statusConfig[log.status] ?? statusConfig.pending

                    const takenTime = log.takenAt
                      ? new Date(log.takenAt).toLocaleTimeString(
                          locale === "zh-TW" ? "zh-TW" : "en-US",
                          { hour: "numeric", minute: "2-digit" },
                        )
                      : null

                    return (
                      <div
                        key={log.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{formattedDate}</p>
                          {takenTime && (
                            <p className="text-xs text-muted-foreground">
                              {takenTime}
                            </p>
                          )}
                        </div>
                        <Badge
                          className={`flex items-center gap-1 ${config.className}`}
                        >
                          {config.icon}
                          {config.label}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-base text-muted-foreground">
                  {t("detail.noHistory")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Interactions section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {t("detail.interactions")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {interactions.length > 0 ? (
                <div className="space-y-3">
                  {interactions.map((inter) => (
                    <div
                      key={inter.id}
                      className={`flex items-start gap-3 rounded-lg border p-4 ${severityColor(inter.severity)}`}
                    >
                      <AlertTriangle
                        className={`mt-0.5 h-5 w-5 shrink-0 ${
                          inter.severity === "high"
                            ? "text-destructive"
                            : inter.severity === "medium"
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-muted-foreground"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="font-medium">
                            {inter.otherMedName}
                          </span>
                          <Badge variant={severityVariant(inter.severity)}>
                            {inter.severity === "medium" ? (
                              <span className="text-yellow-700 dark:text-yellow-300">
                                {t(`detail.severity.${inter.severity}`)}
                              </span>
                            ) : (
                              t(`detail.severity.${inter.severity}`)
                            )}
                          </Badge>
                        </div>
                        {inter.description && (
                          <p className="text-sm leading-relaxed">
                            {inter.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck className="h-5 w-5" />
                  <p className="text-base">{t("detail.noInteractions")}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deactivate button */}
          <Button
            variant="outline"
            size="lg"
            onClick={() => setShowDeactivateDialog(true)}
            className="min-h-12 w-full gap-2 text-base text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-5 w-5" />
            {t("detail.deactivate")}
          </Button>
        </div>
      )}

      {/* Deactivation confirmation dialog */}
      <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("detail.deactivateConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("detail.deactivateConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeactivateDialog(false)}
              disabled={isDeactivating}
              className="min-h-12 text-base"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={isDeactivating}
              className="min-h-12 text-base"
            >
              {isDeactivating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("detail.deactivating")}
                </>
              ) : (
                t("detail.deactivate")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
