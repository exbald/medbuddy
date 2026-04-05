import { Skeleton } from "@/components/ui/skeleton"

export default function LandingLoading() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-6 w-28" />
        </div>
        <Skeleton className="h-10 w-16 rounded-md" />
      </div>

      {/* Hero */}
      <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-12">
        <Skeleton className="mb-6 h-24 w-24 rounded-3xl" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-4 h-6 w-48" />
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
