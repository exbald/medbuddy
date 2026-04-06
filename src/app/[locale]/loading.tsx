import { Skeleton } from "@/components/ui/skeleton";

export default function LandingLoading() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <div className="bg-background/80 sticky top-0 z-50 flex items-center justify-between px-5 py-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-6 w-28" />
        </div>
        <Skeleton className="h-10 w-16 rounded-md" />
      </div>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <div className="flex flex-col items-center px-5 pt-8 pb-12">
          <Skeleton className="mb-6 h-24 w-24 rounded-3xl" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-4 h-6 w-48" />
          <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-card px-5 py-12">
          <Skeleton className="mx-auto mb-8 h-8 w-40" />
          <div className="mx-auto grid max-w-lg gap-6 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center">
                <Skeleton className="h-14 w-14 rounded-full" />
                <Skeleton className="mt-3 h-4 w-6" />
                <Skeleton className="mt-1 h-5 w-24" />
                <Skeleton className="mt-1 h-4 w-32" />
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="px-5 py-12">
          <Skeleton className="mx-auto mb-8 h-8 w-44" />
          <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        </div>

        {/* Personas */}
        <div className="bg-card px-5 py-12">
          <Skeleton className="mx-auto mb-8 h-8 w-36" />
          <div className="mx-auto grid max-w-lg gap-6 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        </div>

        {/* Trust */}
        <div className="px-5 py-12">
          <Skeleton className="mx-auto mb-8 h-8 w-36" />
          <div className="mx-auto grid max-w-lg gap-6 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="mt-3 h-5 w-24" />
                <Skeleton className="mt-1 h-4 w-32" />
              </div>
            ))}
          </div>
          <Skeleton className="mx-auto mt-8 h-20 max-w-lg rounded-2xl" />
        </div>

        {/* FAQ */}
        <div className="bg-card px-5 py-12">
          <Skeleton className="mx-auto mb-8 h-8 w-28" />
          <div className="mx-auto max-w-lg">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="mb-2 h-14 rounded-md" />
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="bg-primary/5 px-5 py-16">
          <Skeleton className="mx-auto h-8 w-56" />
          <Skeleton className="mx-auto mt-3 h-5 w-40" />
          <Skeleton className="mx-auto mt-8 h-14 w-40 rounded-2xl" />
        </div>
      </main>

      {/* Footer */}
      <div className="border-t px-5 py-6">
        <Skeleton className="mx-auto mb-3 h-4 w-48" />
        <Skeleton className="mx-auto h-4 w-32" />
      </div>
    </div>
  );
}
