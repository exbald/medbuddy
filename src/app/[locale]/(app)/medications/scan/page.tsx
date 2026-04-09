"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, X, Loader2, ImageIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "@/i18n/routing"

interface ScannedMedication {
  name: string
  nameLocal?: string
  dosage?: string
  frequency?: string
}

type ScanState = "idle" | "preview" | "scanning" | "results"

/**
 * Converts a frequency string (e.g. "twice daily", "3 times a day")
 * into a timing array that the medications API expects.
 * Falls back to ['morning'] if the frequency is unparseable.
 */
function frequencyToTiming(frequency: string | undefined): string[] {
  if (!frequency) return ["morning"]

  const lower = frequency.toLowerCase()

  // Four times daily
  if (
    lower.includes("four times") ||
    lower.includes("4 times") ||
    lower.includes("qid") ||
    lower.includes("每日四次") ||
    lower.includes("一天四次")
  ) {
    return ["morning", "afternoon", "evening", "bedtime"]
  }

  // Three or more times daily (including Chinese "三餐飯後" pattern)
  if (
    lower.includes("three times") ||
    lower.includes("3 times") ||
    lower.includes("tid") ||
    lower.includes("ter in die") ||
    lower.includes("每日三次") ||
    lower.includes("一天三次") ||
    lower.includes("三餐飯後") ||
    lower.includes("三餐飯前")
  ) {
    return ["morning", "afternoon", "evening"]
  }

  // Twice daily
  if (
    lower.includes("twice") ||
    lower.includes("two times") ||
    lower.includes("2 times") ||
    lower.includes("bid") ||
    lower.includes("bis in die") ||
    lower.includes("每日兩次") ||
    lower.includes("一天兩次") ||
    lower.includes("每日二次") ||
    lower.includes("一天二次") ||
    lower.includes("早晚")
  ) {
    return ["morning", "evening"]
  }

  // Bedtime / at night
  if (
    lower.includes("bedtime") ||
    lower.includes("at night") ||
    lower.includes("hs") ||
    lower.includes("睡前")
  ) {
    return ["bedtime"]
  }

  // Evening
  if (
    lower.includes("evening") ||
    lower.includes("dinner") ||
    lower.includes("晚餐") ||
    lower.includes("晚上")
  ) {
    return ["evening"]
  }

  // Afternoon
  if (
    lower.includes("afternoon") ||
    lower.includes("lunch") ||
    lower.includes("noon") ||
    lower.includes("午餐") ||
    lower.includes("中午")
  ) {
    return ["afternoon"]
  }

  // Once daily (check after more specific patterns)
  if (
    lower.includes("每天一次") ||
    lower.includes("每日一次") ||
    lower.includes("一天一次") ||
    lower.includes("once daily") ||
    lower.includes("qd")
  ) {
    return ["morning"]
  }

  return ["morning"]
}

export default function ScanPrescriptionPage() {
  const t = useTranslations("medications")
  const router = useRouter()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const [scanState, setScanState] = useState<ScanState>("idle")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [medications, setMedications] = useState<ScannedMedication[]>([])
  const [saveProgress, setSaveProgress] = useState<{
    current: number
    total: number
  } | null>(null)

  // Revoke object URL on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      if (!file.type.startsWith("image/")) {
        toast.error(t("scan.invalidFileType"))
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error(t("scan.fileTooLarge"))
        return
      }

      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setSelectedFile(file)
      setScanState("preview")
    },
    [t],
  )

  const handleScan = useCallback(async () => {
    if (!selectedFile) return

    setScanState("scanning")

    const formData = new FormData()
    formData.append("image", selectedFile)

    try {
      const response = await fetch("/api/medications/scan", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || t("scan.scanFailed"))
      }

      const data = await response.json()
      const scanned: ScannedMedication[] = data.medications ?? []

      if (scanned.length === 0) {
        toast.info(t("scan.noMedsFound"))
        setScanState("preview")
        return
      }

      setMedications(scanned)
      setScanState("results")
      toast.success(t("scan.foundMeds", { count: scanned.length }))
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("scan.scanFailed")
      toast.error(message)
      setScanState("preview")
    }
  }, [selectedFile, t])

  const handleReset = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setSelectedFile(null)
    setMedications([])
    setScanState("idle")
    setSaveProgress(null)

    // Clear the file inputs so the same file can be re-selected
    if (cameraInputRef.current) cameraInputRef.current.value = ""
    if (galleryInputRef.current) galleryInputRef.current.value = ""
  }, [previewUrl])

  const handleRemoveMedication = useCallback((index: number) => {
    setMedications((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleUpdateMedication = useCallback(
    (index: number, field: keyof ScannedMedication, value: string) => {
      setMedications((prev) =>
        prev.map((med, i) =>
          i === index ? { ...med, [field]: value } : med
        )
      )
    },
    []
  )

  const handleSaveAll = useCallback(async () => {
    if (medications.length === 0) return

    setSaveProgress({ current: 0, total: medications.length })

    let savedCount = 0

    for (const med of medications) {
      try {
        const response = await fetch("/api/medications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: med.name,
            nameLocal: med.nameLocal || undefined,
            dosage: med.dosage || undefined,
            timing: frequencyToTiming(med.frequency),
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || `Failed to save ${med.name}`)
        }

        savedCount += 1
        setSaveProgress({ current: savedCount, total: medications.length })
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : `Failed to save ${med.name}`
        toast.error(message)
      }
    }

    setSaveProgress(null)

    if (savedCount === medications.length) {
      toast.success(t("scan.saved"))
      router.push("/medications")
    } else {
      toast.error(
        t("scan.partialSave", { saved: savedCount, total: medications.length }),
      )
    }
  }, [medications, router, t])

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <h1 className="text-2xl font-bold">{t("scan.title")}</h1>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Idle state: show camera + gallery triggers */}
      {scanState === "idle" && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-12 transition-colors hover:border-primary/50 hover:bg-muted/50 active:bg-muted/70"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <Camera className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-lg font-medium">{t("scan.takePhoto")}</p>
            </div>
          </button>
          <Button
            type="button"
            variant="outline"
            className="min-h-[48px] w-full"
            onClick={() => galleryInputRef.current?.click()}
          >
            <ImageIcon className="h-5 w-5" />
            {t("scan.choosePhoto")}
          </Button>
        </div>
      )}

      {/* Preview state: show image and scan button */}
      {(scanState === "preview" || scanState === "scanning") &&
        previewUrl && (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-xl border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Prescription preview"
                className="w-full object-contain"
              />
              {scanState === "scanning" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-lg font-medium">
                    {t("scan.analyzing")}
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="min-h-[48px] flex-1"
                onClick={handleReset}
                disabled={scanState === "scanning"}
              >
                {t("scan.retry")}
              </Button>
              <Button
                className="min-h-[48px] flex-1"
                onClick={handleScan}
                disabled={scanState === "scanning"}
              >
                {scanState === "scanning" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ImageIcon className="h-5 w-5" />
                )}
                {scanState === "scanning"
                  ? t("scan.analyzing")
                  : t("scan.title")}
              </Button>
            </div>
          </div>
        )}

      {/* Results state: editable medication cards */}
      {scanState === "results" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("scan.editBeforeSave")}
          </p>

          {medications.map((med, index) => (
            <Card key={`${med.name}-${index}`}>
              <CardContent className="relative space-y-3 p-4">
                <button
                  type="button"
                  onClick={() => handleRemoveMedication(index)}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label={t("scan.remove")}
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="space-y-1.5 pr-8">
                  <Label htmlFor={`name-${index}`}>
                    {t("add.name")}
                  </Label>
                  <Input
                    id={`name-${index}`}
                    value={med.name}
                    onChange={(e) =>
                      handleUpdateMedication(index, "name", e.target.value)
                    }
                    className="min-h-[48px] text-base"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`nameLocal-${index}`}>
                    {t("add.nameLocal")}
                  </Label>
                  <Input
                    id={`nameLocal-${index}`}
                    value={med.nameLocal ?? ""}
                    onChange={(e) =>
                      handleUpdateMedication(
                        index,
                        "nameLocal",
                        e.target.value
                      )
                    }
                    placeholder={t("add.nameLocalPlaceholder")}
                    className="min-h-[48px] text-base"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`dosage-${index}`}>
                    {t("add.dosage")}
                  </Label>
                  <Input
                    id={`dosage-${index}`}
                    value={med.dosage ?? ""}
                    onChange={(e) =>
                      handleUpdateMedication(
                        index,
                        "dosage",
                        e.target.value
                      )
                    }
                    placeholder={t("add.dosagePlaceholder")}
                    className="min-h-[48px] text-base"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`frequency-${index}`}>
                    {t("add.timing")}
                  </Label>
                  <Input
                    id={`frequency-${index}`}
                    value={med.frequency ?? ""}
                    onChange={(e) =>
                      handleUpdateMedication(
                        index,
                        "frequency",
                        e.target.value
                      )
                    }
                    placeholder={t("scan.frequencyPlaceholder")}
                    className="min-h-[48px] text-base"
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          {medications.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">{t("scan.noMedsFound")}</p>
              <Button
                variant="outline"
                className="mt-4 min-h-[48px]"
                onClick={handleReset}
              >
                {t("scan.retry")}
              </Button>
            </div>
          )}

          {medications.length > 0 && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="min-h-[48px] flex-1"
                onClick={handleReset}
              >
                {t("scan.retry")}
              </Button>
              <Button
                className="min-h-[48px] flex-1"
                onClick={handleSaveAll}
                disabled={saveProgress !== null}
              >
                {saveProgress !== null ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {`${saveProgress.current}/${saveProgress.total}`}
                  </>
                ) : (
                  t("scan.saveAll")
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
