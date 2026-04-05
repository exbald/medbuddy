import { Badge } from "@/components/ui/badge"
import { StatusIcon } from "./status-icon"

interface MedicationRowProps {
  name: string
  nameLocal: string | null
  dosage: string | null
  status: "pending" | "taken" | "missed" | "skipped"
  statusLabel: string
}

export function MedicationRow({ name, nameLocal, dosage, status, statusLabel }: MedicationRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <StatusIcon status={status} />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-tight">
          {name}
          {nameLocal && nameLocal !== name && (
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              {nameLocal}
            </span>
          )}
        </p>
        {dosage && (
          <p className="text-xs text-muted-foreground">{dosage}</p>
        )}
      </div>
      <Badge
        variant={
          status === "taken"
            ? "default"
            : status === "missed"
              ? "destructive"
              : "secondary"
        }
        className="shrink-0"
      >
        {statusLabel}
      </Badge>
    </div>
  )
}
