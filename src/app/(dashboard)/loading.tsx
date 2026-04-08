export default function DashboardLoading() {
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="h-4 w-32 bg-gray-100 rounded mb-4" />
        <div className="h-8 w-64 bg-gray-200 rounded mb-6" />

        {/* KPI cards skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="h-3 w-24 bg-gray-100 rounded mb-3" />
              <div className="h-8 w-20 bg-gray-200 rounded" />
            </div>
          ))}
        </div>

        {/* Content skeleton */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="h-5 w-40 bg-gray-100 rounded mb-4" />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <div className="h-3 w-full bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
