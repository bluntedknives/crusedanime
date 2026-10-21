export default function Loading() {
  return (
    <div className="container-page pt-6">
      <div className="skeleton h-8 w-64" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[290px_1fr]">
        <div className="skeleton hidden h-[600px] lg:block" />
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton aspect-[2/3] w-full" />
              <div className="skeleton mt-2 h-3 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
