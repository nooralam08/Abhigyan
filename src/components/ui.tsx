import type { ReactNode, ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Search, X } from 'lucide-react'

// Color mappings for badges
const badgeTone: Record<string, string> = {
  // Priority
  Critical: 'bg-red-50 text-red-700 border-red-200 ring-1 ring-red-100',
  High: 'bg-orange-50 text-orange-700 border-orange-200 ring-1 ring-orange-100',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-100',
  Low: 'bg-slate-100 text-slate-700 border-slate-200',

  // Status
  Pending: 'bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-100',
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-100',
  Resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-100',
  Escalated: 'bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-100 font-semibold',

  // Bureaus
  RB: 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold',
  PGRC: 'bg-teal-50 text-teal-700 border-teal-200 font-semibold',
  Approval: 'bg-sky-50 text-sky-700 border-sky-200',
  Academic: 'bg-purple-50 text-purple-700 border-purple-200',
  SB: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EO: 'bg-orange-50 text-orange-700 border-orange-200',

  // Risk
  'Risk: High': 'bg-red-50 text-red-700 border-red-200 font-semibold',
  'Risk: Moderate': 'bg-amber-50 text-amber-700 border-amber-200',
  'Risk: Low': 'bg-emerald-50 text-emerald-700 border-emerald-200',

  // Roles
  Admin: 'bg-navy-50 text-navy-800 border-navy-200 font-semibold',
  Officer: 'bg-slate-100 text-slate-700 border-slate-200',
}

export const Badge = ({
  v,
  className = '',
  dot = false,
}: {
  v: string
  className?: string
  dot?: boolean
}) => {
  const tone = badgeTone[v] ?? 'bg-slate-100 text-slate-700 border-slate-200'
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors ${tone} ${className}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            v === 'Resolved'
              ? 'bg-emerald-500'
              : v === 'Escalated' || v === 'Critical'
              ? 'bg-rose-500 animate-pulse'
              : v === 'In Progress'
              ? 'bg-blue-500'
              : 'bg-amber-500'
          }`}
        />
      )}
      {v}
    </span>
  )
}

export const Card = ({
  children,
  className = '',
  padding = 'p-5',
}: {
  children: ReactNode
  className?: string
  padding?: string
}) => (
  <div
    className={`rounded-xl border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md ${padding} ${className}`}
  >
    {children}
  </div>
)

export const CardHeader = ({
  title,
  sub,
  action,
  className = '',
}: {
  title: string
  sub?: string
  action?: ReactNode
  className?: string
}) => (
  <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 ${className}`}>
    <div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
    {action && <div className="flex items-center gap-2">{action}</div>}
  </div>
)

export const Stat = ({
  label,
  value,
  icon: Icon,
  color,
  trend,
  trendLabel,
  onClick,
  className = '',
}: {
  label: string
  value: number | string
  icon: LucideIcon
  color: string
  trend?: string
  trendLabel?: string
  onClick?: () => void
  className?: string
}) => {
  const Content = (
    <Card
      className={`relative overflow-hidden h-full flex flex-col justify-between min-h-[148px] ${
        onClick ? 'cursor-pointer hover:border-navy-300 hover:ring-1 hover:ring-navy-100 transition-all' : ''
      } ${className}`}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">
              {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
            </div>
            <div className="mt-1 min-h-[2.5rem] flex items-start text-xs font-medium text-slate-500 uppercase tracking-wider leading-snug">
              {label}
            </div>
          </div>
          <div className={`flex-shrink-0 rounded-xl p-3 shadow-inner ${color}`}>
            <Icon size={22} strokeWidth={2} />
          </div>
        </div>
      </div>
      {(trend || trendLabel) ? (
        <div className="mt-auto pt-2.5 flex items-center gap-1.5 border-t border-slate-100 text-xs">
          {trend && (
            <span
              className={`font-semibold shrink-0 ${
                trend.startsWith('+')
                  ? 'text-emerald-600'
                  : trend.startsWith('-')
                  ? 'text-rose-600'
                  : 'text-slate-600'
              }`}
            >
              {trend}
            </span>
          )}
          {trendLabel && <span className="text-slate-400 truncate">{trendLabel}</span>}
        </div>
      ) : (
        <div className="mt-auto pt-2.5 border-t border-transparent min-h-[29px]" />
      )}
    </Card>
  )

  if (onClick) {
    return (
      <div onClick={onClick} className="text-left w-full h-full flex flex-col">
        {Content}
      </div>
    )
  }
  return Content
}

export const PageTitle = ({
  title,
  sub,
  action,
  tag,
}: {
  title: string
  sub?: string
  action?: ReactNode
  tag?: string
}) => (
  <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/60 pb-4">
    <div>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {tag && (
          <span className="rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-semibold text-navy-800 border border-navy-200">
            {tag}
          </span>
        )}
      </div>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
    </div>
    {action && <div className="flex items-center gap-2.5">{action}</div>}
  </div>
)

export const SearchBox = ({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  className?: string
}) => (
  <div className={`relative min-w-[240px] flex-1 ${className}`}>
    <Search size={16} className="absolute left-3 top-3 text-slate-400" />
    <input
      className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-navy-600 focus:ring-2 focus:ring-navy-100 shadow-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
    {value && (
      <button
        onClick={() => onChange('')}
        className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600"
      >
        <X size={14} />
      </button>
    )}
  </div>
)

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'teal'
  size?: 'sm' | 'md' | 'lg'
}) => {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium transition rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-1'
  const variants = {
    primary: 'bg-navy-800 text-white hover:bg-navy-700 active:bg-navy-900 focus:ring-navy-500 shadow-sm',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300 focus:ring-slate-400',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 focus:ring-navy-300 shadow-sm',
    ghost: 'text-slate-600 hover:bg-slate-100 active:bg-slate-200 focus:ring-slate-300',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 focus:ring-rose-400 shadow-sm',
    teal: 'bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800 focus:ring-teal-400 shadow-sm',
  }
  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  }

  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export const Modal = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-2xl',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  maxWidth?: string
}) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="fixed inset-0" onClick={onClose} />
      <div
        className={`relative w-full ${maxWidth} rounded-2xl bg-white shadow-2xl border border-slate-200 z-10 overflow-hidden max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}
