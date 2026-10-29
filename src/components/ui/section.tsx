import { cn } from '@/lib/utils'

export function Section({
  title,
  subtitle,
  action,
  footer,
  padded = true,
  className,
  children,
}: {
  title?: string
  subtitle?: string
  action?: React.ReactNode
  footer?: React.ReactNode
  padded?: boolean
  className?: string
  children: React.ReactNode
}) {
  const hasHeader = Boolean(title || action)
  return (
    <section className={cn('rounded-lg border bg-card', className)}>
      {hasHeader && (
        <div className="flex items-start justify-between gap-4 border-b px-4 py-3">
          <div className="min-w-0">
            {title && <div className="text-sm font-semibold">{title}</div>}
            {subtitle && (
              <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn(padded && 'p-4')}>{children}</div>
      {footer && <div className="border-t px-4 py-3">{footer}</div>}
    </section>
  )
}
