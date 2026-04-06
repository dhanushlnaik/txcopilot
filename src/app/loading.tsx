import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="relative flex flex-1 flex-col items-center">
      {/* Background placeholder */}
      <div className="absolute inset-0 dot-pattern opacity-30" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-2xl mx-auto px-4 pt-24 sm:pt-32">
        {/* Badge skeleton */}
        <Skeleton className="h-7 w-56 rounded-full mb-6" />

        {/* Headline skeleton */}
        <Skeleton className="h-12 w-full max-w-lg mb-3" />
        <Skeleton className="h-12 w-80 mb-5" />

        {/* Subline skeleton */}
        <Skeleton className="h-5 w-full max-w-md mb-2" />
        <Skeleton className="h-5 w-64 mb-10" />

        {/* Card skeleton */}
        <div className="w-full rounded-xl border border-border/20 bg-card/40 p-6 sm:p-8">
          <Skeleton className="h-4 w-36 mb-3" />
          <div className="flex gap-2">
            <Skeleton className="h-12 flex-1 rounded-lg" />
            <Skeleton className="h-12 w-24 rounded-lg" />
          </div>
          <div className="flex gap-2 mt-4">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>

        {/* Network strip skeleton */}
        <div className="w-full mt-6 rounded-xl border border-border/20 bg-card/40 px-5 py-3">
          <div className="flex items-center justify-center gap-6">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
