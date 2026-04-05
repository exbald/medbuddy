import { Skeleton } from "@/components/ui/skeleton"

export default function OnboardingLoading() {
  return (
    <div className="flex min-h-dvh flex-col items-center px-5 py-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-36" />
        </div>

        {/* Progress bar */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <Skeleton className="h-5 w-24" />
          <div className="flex w-[200px] gap-2">
            <Skeleton className="h-2 flex-1 rounded-full" />
            <Skeleton className="h-2 flex-1 rounded-full" />
            <Skeleton className="h-2 flex-1 rounded-full" />
          </div>
        </div>

        {/* Form placeholder */}
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-56" />
          </div>
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
