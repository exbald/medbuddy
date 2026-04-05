"use client"

import { Check, X, Pill } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Link } from "@/i18n/routing"
import { cn } from "@/lib/utils"

interface MedCardProps {
  medication: {
    id: string
    name: string
    nameLocal: string | null
    dosage: string | null
  }
  logId: string
  status: "pending" | "taken" | "missed"
  scheduledTime: string
  onTake: (logId: string) => void
}

export function MedCard({ medication, logId, status, scheduledTime, onTake }: MedCardProps) {
  const t = useTranslations("home")

  return (
    <Card
      className={cn(
        "transition-colors",
        status === "taken" && "border-green-500/30 bg-green-50/50 dark:bg-green-950/20",
        status === "missed" && "border-destructive/30 bg-destructive/5",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* Card body - navigates to detail page */}
          <Link
            href={`/medications/${medication.id}`}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Pill className="h-5 w-5 text-primary" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold leading-tight">
                {medication.name}
                {medication.nameLocal && medication.nameLocal !== medication.name && (
                  <span className="ml-2 text-base font-normal text-muted-foreground">
                    {medication.nameLocal}
                  </span>
                )}
              </h3>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {medication.dosage && <span>{medication.dosage}</span>}
                <span>{scheduledTime}</span>
              </div>
            </div>
          </Link>

          {/* Status action area */}
          <div className="shrink-0">
            {status === "pending" && (
              <Button
                size="lg"
                className="min-h-12 min-w-[80px] gap-2 text-base"
                onClick={() => onTake(logId)}
              >
                {t("take")}
              </Button>
            )}

            {status === "taken" && (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            )}

            {status === "missed" && (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <X className="h-6 w-6 text-destructive" />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
