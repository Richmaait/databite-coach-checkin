export default function DashboardLayoutSkeleton() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar skeleton */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-gray-100 p-4 md:block">
        {/* Logo placeholder */}
        <div className="mb-8 h-8 w-32 animate-pulse rounded bg-gray-300" />

        {/* Nav items */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-8 animate-pulse rounded bg-gray-300"
              style={{ width: `${70 + Math.random() * 30}%` }}
            />
          ))}
        </div>

        {/* Bottom user area */}
        <div className="mt-auto pt-8">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 animate-pulse rounded-full bg-gray-300" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-gray-300" />
              <div className="h-3 w-16 animate-pulse rounded bg-gray-300" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main content skeleton */}
      <main className="flex-1 p-6">
        {/* Header bar */}
        <div className="mb-8 flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-24 animate-pulse rounded bg-gray-200" />
        </div>

        {/* Content cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-lg bg-gray-200"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
