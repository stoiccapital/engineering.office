export function LoadingCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-12 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}
