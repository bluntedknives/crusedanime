/** Row of poster placeholders matching the grid card footprint. */
export function PosterGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="skeleton aspect-[2/3] w-full rounded-xl" />
          <div className="skeleton mt-2 h-3 w-4/5" />
          <div className="skeleton mt-1.5 h-2.5 w-2/5" />
        </div>
      ))}
    </div>
  )
}

/** Horizontal rail of poster placeholders. */
export function MediaRailSkeleton({ count = 8 }: { count?: number }) {
  return (
    <section>
      <div className="container-page mb-3">
        <div className="skeleton h-5 w-40" />
      </div>
      <div className="scrollbar-none flex gap-3 overflow-hidden px-4 sm:px-6 lg:px-8">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="w-[132px] shrink-0 sm:w-[150px]">
            <div className="skeleton aspect-[2/3] w-full rounded-xl" />
            <div className="skeleton mt-2 h-3 w-4/5" />
            <div className="skeleton mt-1.5 h-2.5 w-2/5" />
          </div>
        ))}
      </div>
    </section>
  )
}

export function ListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface flex gap-4 p-3">
          <div className="skeleton h-[128px] w-[88px] shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2.5 py-1">
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  )
}
