export default function Loading() {
  return (
    <div className="container-page pt-6">
      <div className="skeleton h-[260px] w-full" />
      <div className="mt-6 flex gap-6">
        <div className="skeleton h-[330px] w-[230px] shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="skeleton h-9 w-2/3" />
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-28 w-full" />
        </div>
      </div>
    </div>
  )
}
