export default function DashboardLayoutSkeleton() {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Sidebar skeleton */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-4 md:block">
        {/* Logo placeholder */}
        <div className="mb-8 h-8 w-32 animate-pulse rounded bg-white/10" />

        {/* Nav items */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-8 animate-pulse rounded bg-white/10"
              style={{ width: `${70 + Math.random() * 30}%` }}
            />
          ))}
        </div>

        {/* Bottom user area */}
        <div className="mt-auto pt-8">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main content skeleton */}
      <main className="flex-1 p-6">
        {/* Header bar */}
        <div className="mb-8 flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded bg-white/5" />
          <div className="h-8 w-24 animate-pulse rounded bg-white/5" />
        </div>

        {/* Content cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl bg-white/5 border border-white/10"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
