export default function Loading() {
  return (
    <div className="container-page pt-6">
      <div className="skeleton h-9 w-72" />
      <div className="mt-8 space-y-8">
        {Array.from({ length: 4 }).map((_, d) => (
          <div key={d}>
            <div className="skeleton mb-3 h-5 w-40" />
            <div className="grid gap-2 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-20 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
