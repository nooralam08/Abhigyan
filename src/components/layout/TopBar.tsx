import { useState } from 'react'
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  LogOut,
  Menu,
  Search,
  Settings,
  Shield,
  User,
  X,
  AlertTriangle,
  Info,
  Clock,
  Building2,
  FilePlus,
  UserCheck,
} from 'lucide-react'
import type { AppNotification, Page, Role, UserProfile } from '../../types'
import { Badge } from '../ui'

interface TopBarProps {
  activePage: Page
  onNavigate: (page: Page) => void
  onToggleMobileMenu: () => void
  notifications: AppNotification[]
  onMarkNotificationAsRead: (id: string) => void
  onMarkAllNotificationsRead: () => void
  currentUser: UserProfile
  currentRole: Role
  onSelectRole: (role: Role, userId?: string) => void
  onSignOut?: () => void
  onSelectCase?: (caseId: string) => void
}

const PAGE_META: Record<Page, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Consolidated grievance monitoring, SLA surveillance, and bureau distribution',
  },
  complaints: {
    title: 'Complaints Directory',
    subtitle: 'Search, filter, track, and update grievance dockets',
  },
  submit: {
    title: 'Grievance Submission',
    subtitle: 'File formal complaints with AICTE Permanent ID verification',
  },
  details: {
    title: 'Case Details',
    subtitle: 'Audit trail, institution profile, evidence, and timeline',
  },
  institutions: {
    title: 'Institutions Directory',
    subtitle: 'Accredited technical institutes and consolidated grievance history',
  },
  overlaps: {
    title: 'Cross-Bureau Overlaps',
    subtitle: 'Automated detection of parallel complaints across bureaus',
  },
  tracking: {
    title: 'Case Tracking & SLA',
    subtitle: 'Lifecycle progression, milestone verification, and resolution deadlines',
  },
  reports: {
    title: 'Reports & Analytics',
    subtitle: 'Disposal metrics, resolution throughput, and compliance trends',
  },
  notifications: {
    title: 'Notifications',
    subtitle: 'SLA warnings, overlap alerts, and case updates',
  },
  users: {
    title: 'User Management',
    subtitle: 'Authorized officers, bureau administrators, and personnel directory',
  },
  settings: {
    title: 'System Settings',
    subtitle: 'Configure SLA thresholds, overlap tolerance, and compliance rules',
  },
}

export default function TopBar({
  activePage,
  onNavigate,
  onToggleMobileMenu,
  notifications,
  onMarkNotificationAsRead,
  onMarkAllNotificationsRead,
  currentUser,
  currentRole,
  onSelectRole,
  onSignOut,
  onSelectCase,
}: TopBarProps) {
  const [showNotifMenu, setShowNotifMenu] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [quickSearch, setQuickSearch] = useState('')

  const unreadNotifs = notifications.filter((n) => !n.read)
  const pageMeta = PAGE_META[activePage] || PAGE_META.dashboard

  const handleCaseClick = (caseId?: string) => {
    if (caseId && onSelectCase) {
      onSelectCase(caseId)
      setShowNotifMenu(false)
    }
  }

  const getNotifIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'alert':
        return <AlertTriangle size={15} className="text-rose-600" />
      case 'warning':
        return <Clock size={15} className="text-amber-600" />
      case 'success':
        return <CheckCircle2 size={15} className="text-emerald-600" />
      default:
        return <Info size={15} className="text-sky-600" />
    }
  }

  const roleNameMap: Record<Role, string> = {
    Complainant: 'Citizen User',
    BureauAdmin: 'Bureau Admin',
    Officer: 'Handling Officer',
    Admin: 'System Admin',
  }

  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-white px-4 sm:px-6 shadow-xs">
      {/* Left: Mobile trigger & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 lg:hidden transition"
          aria-label="Open mobile menu"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">
              {pageMeta.title}
            </h1>
            <span className="hidden md:inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 font-mono">
              Gov of India
            </span>
          </div>
          <p className="hidden sm:block text-xs text-slate-500 truncate max-w-xl">
            {pageMeta.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Actions, Search, Notifications, Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Search Box */}
        <div className="relative hidden xl:block w-64">
          <input
            type="text"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && quickSearch.trim()) {
                if (onSelectCase && quickSearch.toUpperCase().includes('-2026-')) {
                  onSelectCase(quickSearch.trim().toUpperCase())
                } else {
                  onNavigate('complaints')
                }
              }
            }}
            placeholder="Search Case ID (e.g. PGRC-)..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/80 pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-navy-600 focus:bg-white focus:outline-none transition shadow-2xs"
          />
          <Search size={14} className="absolute left-3 top-2 text-slate-400" />
        </div>

        {/* Action Button: Submit Complaint for Citizen / Complainant */}
        {currentRole === 'Complainant' && activePage !== 'submit' && (
          <button
            onClick={() => onNavigate('submit')}
            className="hidden sm:flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition"
          >
            <FilePlus size={14} />
            <span>File Grievance</span>
          </button>
        )}

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifMenu(!showNotifMenu)
              setShowProfileMenu(false)
            }}
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
            aria-label="Notifications"
          >
            <Bell size={19} />
            {unreadNotifs.length > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs">
                {unreadNotifs.length}
              </span>
            )}
          </button>

          {/* Notifications Flyout */}
          {showNotifMenu && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowNotifMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white shadow-xl z-40 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/70">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">Notifications &amp; Alerts</span>
                    {unreadNotifs.length > 0 && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        {unreadNotifs.length} new
                      </span>
                    )}
                  </div>
                  {unreadNotifs.length > 0 && (
                    <button
                      onClick={onMarkAllNotificationsRead}
                      className="text-[11px] font-semibold text-teal-700 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.slice(0, 5).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        onMarkNotificationAsRead(n.id)
                        handleCaseClick(n.caseId)
                      }}
                      className={`p-3.5 hover:bg-slate-50 transition cursor-pointer ${
                        !n.read ? 'bg-sky-50/40' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 flex-shrink-0">{getNotifIcon(n.type)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {n.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                              {n.timestamp.slice(11)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                          {n.caseId && (
                            <span className="inline-block mt-1 text-[10px] font-mono font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                              Docket: {n.caseId}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 p-2 bg-slate-50/50 text-center">
                  <button
                    onClick={() => {
                      setShowNotifMenu(false)
                      onNavigate('notifications')
                    }}
                    className="text-xs font-bold text-navy-800 hover:underline"
                  >
                    View All Notifications in Center
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Profile / Role Trigger */}
        <div className="relative border-l border-slate-200 pl-3 ml-1">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu)
              setShowNotifMenu(false)
            }}
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100 transition text-left"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-800 font-bold text-white text-xs shadow-xs">
              {currentUser.avatarText || 'AI'}
            </div>
            <div className="hidden md:block">
              <div className="text-xs font-bold text-slate-800 leading-tight">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                {roleNameMap[currentRole]}
              </div>
            </div>
            <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
          </button>

          {/* Profile Flyout */}
          {showProfileMenu && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowProfileMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-xl z-40 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="border-b border-slate-100 p-4 bg-slate-50/80">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-800 font-bold text-white text-sm shadow-xs">
                      {currentUser.avatarText}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {currentUser.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{currentUser.email}</div>
                      <div className="mt-1 flex items-center gap-1">
                        <Badge v={currentRole} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-1.5 text-xs text-slate-700 divide-y divide-slate-100">
                  {/* Switch Role Options */}
                  <div className="py-1">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Switch Demo Role Perspective:
                    </div>
                    {[
                      { role: 'Complainant' as Role, label: 'Citizen (Rohit Sharma)', userId: 'u0' },
                      { role: 'BureauAdmin' as Role, label: 'Bureau Head (Dr. Priya Nair - PGRC)', userId: 'u1b' },
                      { role: 'Officer' as Role, label: 'Handling Officer (Rajesh Kumar - PGRC)', userId: 'u2' },
                      { role: 'Officer' as Role, label: 'Handling Officer (Anita Verma - RB)', userId: 'u3' },
                      { role: 'Admin' as Role, label: 'System Admin (Dr. S. Mehta)', userId: 'u1' },
                    ].map((opt) => {
                      const isCur = currentUser?.id === opt.userId || (currentRole === opt.role && !currentUser?.id)
                      return (
                        <button
                          key={`${opt.role}-${opt.userId}`}
                          onClick={() => {
                            onSelectRole(opt.role, opt.userId)
                            setShowProfileMenu(false)
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 hover:bg-slate-100 transition ${
                            isCur ? 'font-bold text-teal-800 bg-teal-50/50' : 'text-slate-700'
                          }`}
                        >
                          <span className="truncate">{opt.label}</span>
                          {isCur && (
                            <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded font-mono shrink-0 ml-1">
                              Active
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {currentRole !== 'Complainant' && (
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowProfileMenu(false)
                          onNavigate('users')
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-slate-100 transition"
                      >
                        <User size={15} className="text-slate-400" />
                        <span>User Management</span>
                      </button>
                      {currentRole === 'Admin' && (
                        <button
                          onClick={() => {
                            setShowProfileMenu(false)
                            onNavigate('settings')
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-slate-100 transition"
                        >
                          <Settings size={15} className="text-slate-400" />
                          <span>System Settings</span>
                        </button>
                      )}
                    </div>
                  )}

                  {onSignOut && (
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowProfileMenu(false)
                          onSignOut()
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-rose-700 hover:bg-rose-50 transition font-medium"
                      >
                        <LogOut size={15} className="text-rose-600" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}

                  <div className="pt-1">
                    <div className="px-3 py-2 text-[10px] text-slate-400 leading-tight">
                      Abhigyan • AICTE Redressal Portal
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
