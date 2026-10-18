import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

interface CardHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-4 sm:p-6',
  lg: 'p-5 sm:p-8',
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200 shadow-sm',
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mb-6', className)}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {description && (
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function CardDivider({ className }: { className?: string }) {
  return <div className={cn('border-t border-gray-100 my-4', className)} />
}
