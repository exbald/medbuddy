"use client"

import { useState } from "react"
import { ArrowLeft, AlertTriangle, Plus, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Link } from "@/i18n/routing"

const TIMING_SLOTS = ["morning", "afternoon", "evening", "bedtime"] as const
type TimingSlot = (typeof TIMING_SLOTS)[number]

interface InteractionResult {
  id: string
  severity: string
  description: string
}

interface SubmitResult {
  purpose: string
  interactions: InteractionResult[]
}

export default function AddMedicationPage() {
  const t = useTranslations("medications")
  const tSlots = useTranslations("timeSlots")
  const tCommon = useTranslations("common")

  const [name, setName] = useState("")
  const [nameLocal, setNameLocal] = useState("")
  const [dosage, setDosage] = useState("")
  const [timing, setTiming] = useState<TimingSlot[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResult | null>(null)

  function handleTimingToggle(slot: TimingSlot, checked: boolean) {
    setTiming((prev) =>
      checked ? [...prev, slot] : prev.filter((s) => s !== slot),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      toast.error(t("add.nameRequired"))
      return
    }

    if (timing.length === 0) {
      toast.error(t("add.timingRequired"))
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          nameLocal: nameLocal.trim() || undefined,
          dosage: dosage.trim() || undefined,
          timing,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error ?? t("addError"))
      }

      const data = await response.json()
      toast.success(t("add.success"))
      setResult({
        purpose: data.purpose,
        interactions: data.interactions,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : tCommon("error")
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // After successful submission, show results
  if (result) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <h1 className="text-2xl font-bold">{t("add.success")}</h1>

        {/* AI-generated purpose */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("add.purpose")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed">{result.purpose}</p>
          </CardContent>
        </Card>

        {/* Interaction warnings */}
        {result.interactions.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">
              {t("interactions.title")}
            </h2>
            {result.interactions.map((inter) => (
              <div
                key={inter.id}
                className={`flex items-start gap-3 rounded-lg border p-4 ${
                  inter.severity === "high"
                    ? "border-destructive bg-destructive/10"
                    : "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20"
                }`}
              >
                <AlertTriangle
                  className={`mt-0.5 h-5 w-5 shrink-0 ${
                    inter.severity === "high"
                      ? "text-destructive"
                      : "text-yellow-600 dark:text-yellow-400"
                  }`}
                />
                <p className="text-sm">{inter.description}</p>
              </div>
            ))}
          </div>
        )}

        <Button asChild size="lg" className="min-h-12 w-full text-base">
          <Link href="/medications">{t("add.backToList")}</Link>
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
        <h1 className="text-2xl font-bold">{t("add.title")}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Medication name */}
        <div className="space-y-2">
          <Label htmlFor="med-name" className="text-base">
            {t("add.name")}
          </Label>
          <Input
            id="med-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("add.namePlaceholder")}
            className="min-h-12 text-base"
            required
            autoComplete="off"
          />
        </div>

        {/* Chinese / local name */}
        <div className="space-y-2">
          <Label htmlFor="med-name-local" className="text-base">
            {t("add.nameLocal")}
          </Label>
          <Input
            id="med-name-local"
            value={nameLocal}
            onChange={(e) => setNameLocal(e.target.value)}
            placeholder={t("add.nameLocalPlaceholder")}
            className="min-h-12 text-base"
            autoComplete="off"
          />
        </div>

        {/* Dosage */}
        <div className="space-y-2">
          <Label htmlFor="med-dosage" className="text-base">
            {t("add.dosage")}
          </Label>
          <Input
            id="med-dosage"
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder={t("add.dosagePlaceholder")}
            className="min-h-12 text-base"
            autoComplete="off"
          />
        </div>

        {/* Timing checkboxes */}
        <fieldset className="space-y-3">
          <legend className="text-base font-medium">{t("add.timing")}</legend>
          <div className="grid grid-cols-2 gap-3">
            {TIMING_SLOTS.map((slot) => (
              <label
                key={slot}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <Checkbox
                  checked={timing.includes(slot)}
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

        {/* Submit button */}
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="min-h-12 w-full text-base"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("add.submitting")}
            </>
          ) : (
            <>
              <Plus className="h-5 w-5" />
              {t("add.submit")}
            </>
          )}
        </Button>
      </form>
    </div>
  )
}
