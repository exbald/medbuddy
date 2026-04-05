import { Check, Clock, SkipForward, X } from "lucide-react"

export function StatusIcon({ status }: { status: string }) {
  if (status === "taken") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
      </div>
    )
  }
  if (status === "missed") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
        <X className="h-4 w-4 text-destructive" />
      </div>
    )
  }
  if (status === "skipped") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
        <SkipForward className="h-4 w-4 text-muted-foreground" />
      </div>
    )
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/10">
      <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
    </div>
  )
}
