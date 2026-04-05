import { Skeleton } from "@/components/ui/skeleton"

export default function AuthLoading() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6">
        {/* Title + subtitle */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-5 w-56" />
        </div>
        {/* Form fields placeholder */}
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-48 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
