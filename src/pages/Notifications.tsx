import { useState } from 'react'
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Info,
  Trash2,
} from 'lucide-react'
import type { AppNotification } from '../types'
import { Badge, Button, Card, CardHeader, PageTitle } from '../components/ui'

interface NotificationsPageProps {
  notifications: AppNotification[]
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onOpenCase: (caseId: string) => void
}

export default function NotificationsPage({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onOpenCase,
}: NotificationsPageProps) {
  const [filterType, setFilterType] = useState<string>('All')

  const filtered = notifications.filter((n) => {
    if (filterType === 'All') return true
    if (filterType === 'Unread') return !n.read
    return n.type === filterType
  })

  const unreadCount = notifications.filter((n) => !n.read).length

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'alert':
        return <AlertTriangle size={18} className="text-rose-600" />
      case 'warning':
        return <Clock size={18} className="text-amber-600" />
      case 'success':
        return <CheckCircle2 size={18} className="text-emerald-600" />
      default:
        return <Info size={18} className="text-sky-600" />
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Notifications"
        sub="Case updates, SLA notifications, and system alerts"
        action={
          unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onMarkAllAsRead}
              className="text-xs text-navy-800"
            >
              <CheckCheck size={14} />
              <span>Mark All as Read</span>
            </Button>
          )
        }
      />

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {['All', 'Unread', 'alert', 'warning', 'info', 'success'].map((f) => {
          const label =
            f === 'All'
              ? 'All'
              : f === 'Unread'
              ? `Unread (${unreadCount})`
              : f === 'alert'
              ? 'Alerts'
              : f === 'warning'
              ? 'SLA Alerts'
              : f === 'success'
              ? 'Resolved'
              : 'Info'

          return (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filterType === f
                  ? 'bg-navy-800 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Notification Cards Feed */}
      <div className="space-y-3">
        {filtered.map((n) => (
          <Card
            key={n.id}
            padding="p-4"
            className={`transition border-l-4 ${
              !n.read
                ? 'bg-sky-50/20 border-l-navy-800 ring-1 ring-navy-100 shadow-2xs'
                : 'border-l-slate-300'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="rounded-xl bg-slate-100 p-2.5 flex-shrink-0 mt-0.5">
                  {getIcon(n.type)}
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4
                      className={`text-sm ${
                        !n.read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'
                      }`}
                    >
                      {n.title}
                    </h4>
                    {!n.read && (
                      <span className="rounded-full bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.2">
                        NEW
                      </span>
                    )}
                    {n.caseId && (
                      <span className="font-mono text-xs font-bold text-navy-700 bg-navy-50 px-2 py-0.5 rounded border border-navy-100">
                        {n.caseId}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                    <span>Logged: {n.timestamp}</span>
                    {n.caseId && (
                      <button
                        onClick={() => onOpenCase(n.caseId!)}
                        className="text-navy-700 font-semibold hover:underline flex items-center gap-1"
                      >
                        <span>View Case</span>
                        <ExternalLink size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {!n.read && (
                <button
                  onClick={() => onMarkAsRead(n.id)}
                  title="Mark as read"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                >
                  <Check size={16} />
                </button>
              )}
            </div>
          </Card>
        ))}

        {filtered.length === 0 && (
          <Card className="py-16 text-center text-slate-400 text-xs">
            No notifications found under the &quot;{filterType}&quot; filter.
          </Card>
        )}
      </div>
    </div>
  )
}
