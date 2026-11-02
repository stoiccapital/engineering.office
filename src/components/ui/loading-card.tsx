export function LoadingCard({ children }: { children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="space-y-3">
        <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div className="mt-6 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 w-6 animate-pulse rounded bg-muted" />
              <div className="h-3 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
      {children && (
        <div className="mt-4 text-center text-xs text-muted-foreground">{children}</div>
      )}
    </div>
  )
}
