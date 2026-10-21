export default function Loading() {
  return (
    <div className="container-page pt-6">
      <div className="skeleton h-[300px] w-full" />
      <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton aspect-[2/3] w-full" />
            <div className="skeleton mt-2 h-3 w-4/5" />
            <div className="skeleton mt-1.5 h-2.5 w-2/5" />
          </div>
        ))}
      </div>
    </div>
  )
}
