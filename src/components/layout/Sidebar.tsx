import { useState } from 'react'
import {
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FilePlus,
  FileText,
  FolderGit2,
  GitMerge,
  Landmark,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  ShieldCheck,
  User,
  UserCheck,
  Users,
} from 'lucide-react'
import type { Page, Role, UserProfile } from '../../types'

interface SidebarProps {
  activePage: Page
  onNavigate: (page: Page) => void
  collapsed: boolean
  onToggleCollapse: () => void
  unreadNotificationsCount: number
  pendingOverlapsCount: number
  currentRole: Role
  onSelectRole: (role: Role, userId?: string) => void
  onSignOut?: () => void
  currentUser?: UserProfile
}

interface NavConfig {
  id: Page
  label: string
  icon: typeof LayoutDashboard
  badge?: number
  badgeColor?: string
}

const ROLE_INFO: Record<Role, { name: string; scope: string; short: string }> = {
  Complainant: {
    name: 'Complainant / Citizen',
    scope: 'Personal Case Filing & Status',
    short: 'Citizen',
  },
  BureauAdmin: {
    name: 'Bureau / Cell Admin',
    scope: 'PGRC Bureau Operations',
    short: 'Bureau',
  },
  Officer: {
    name: 'Handling Officer',
    scope: 'Inquiry & Case Scrutiny',
    short: 'Officer',
  },
  Admin: {
    name: 'System Admin',
    scope: 'Full AICTE Oversight',
    short: 'Admin',
  },
}

export default function Sidebar({
  activePage,
  onNavigate,
  collapsed,
  onToggleCollapse,
  unreadNotificationsCount,
  pendingOverlapsCount,
  currentRole,
  onSelectRole,
  onSignOut,
  currentUser,
}: SidebarProps) {
  const [showRoleMenu, setShowRoleMenu] = useState(false)

  const getNavItems = (): NavConfig[] => {
    switch (currentRole) {
      case 'Complainant':
        return [
          { id: 'complaints', label: 'My Grievances', icon: FileText },
          { id: 'submit', label: 'Submit Grievances', icon: FilePlus },
          { id: 'tracking', label: 'Track My Dockets', icon: FolderGit2 },
        ]
      case 'Officer':
        return [
          { id: 'complaints', label: 'Assigned Worklist', icon: FileText },
          {
            id: 'overlaps',
            label: 'Overlap Review',
            icon: GitMerge,
            badge: pendingOverlapsCount > 0 ? pendingOverlapsCount : undefined,
            badgeColor: 'bg-amber-500 text-slate-900',
          },
          { id: 'tracking', label: 'SLA Tracking', icon: FolderGit2 },
          { id: 'institutions', label: 'Institutions Roster', icon: Building2 },
          {
            id: 'notifications',
            label: 'Notifications',
            icon: Bell,
            badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
            badgeColor: 'bg-rose-500 text-white',
          },
        ]
      case 'BureauAdmin':
        return [
          { id: 'dashboard', label: 'Bureau Dashboard', icon: LayoutDashboard },
          { id: 'complaints', label: 'Bureau Complaints', icon: FileText },
          { id: 'institutions', label: 'Institutions', icon: Building2 },
          {
            id: 'overlaps',
            label: 'Overlap Detection',
            icon: GitMerge,
            badge: pendingOverlapsCount > 0 ? pendingOverlapsCount : undefined,
            badgeColor: 'bg-amber-500 text-slate-900',
          },
          { id: 'tracking', label: 'Case Tracking', icon: FolderGit2 },
          { id: 'reports', label: 'Reports & Workload', icon: BarChart3 },
          { id: 'users', label: 'Officer Registry', icon: Users },
          {
            id: 'notifications',
            label: 'Notifications',
            icon: Bell,
            badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
            badgeColor: 'bg-rose-500 text-white',
          },
        ]
      case 'Admin':
      default:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'complaints', label: 'All Complaints', icon: FileText },
          { id: 'institutions', label: 'Institutions', icon: Building2 },
          {
            id: 'overlaps',
            label: 'Overlaps',
            icon: GitMerge,
            badge: pendingOverlapsCount > 0 ? pendingOverlapsCount : undefined,
            badgeColor: 'bg-amber-500 text-slate-900',
          },
          { id: 'tracking', label: 'Case Tracking', icon: FolderGit2 },
          { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
          {
            id: 'notifications',
            label: 'Notifications',
            icon: Bell,
            badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
            badgeColor: 'bg-rose-500 text-white',
          },
          { id: 'users', label: 'User Management', icon: Users },
          { id: 'settings', label: 'Settings', icon: Settings },
        ]
    }
  }

  const navItems = getNavItems()

  const bureaus = [
    { code: 'RB', name: 'Regulation Bureau' },
    { code: 'PGRC', name: 'Grievance Cell' },
    { code: 'Approval', name: 'Approval Bureau' },
    { code: 'Academic', name: 'Academic Bureau' },
  ]

  const roleMeta = ROLE_INFO[currentRole] || ROLE_INFO.Admin

  return (
    <aside
      className={`relative flex flex-col bg-[#0b2250] text-white transition-all duration-300 ease-in-out border-r border-white/10 z-30 select-none ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-5 min-h-[72px]">
        <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-400/30 shadow-inner">
          <Landmark size={22} strokeWidth={2.2} />
        </div>
        {!collapsed && (
          <div className="min-w-0 overflow-hidden">
            <div className="font-bold text-sm tracking-wide text-white leading-tight flex items-center gap-1.5">
              <span>Abhigyan</span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-teal-500/30 text-teal-200 border border-teal-400/30">
                AICTE
              </span>
            </div>
            <div className="text-[11px] text-navy-200 truncate font-normal mt-0.5">
              Complaint Monitoring Portal
            </div>
          </div>
        )}
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin">
        {!collapsed && (
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-navy-200/60 flex items-center justify-between">
            <span>{currentRole === 'Complainant' ? 'Citizen Services' : 'Core Modules'}</span>
            <span className="text-[9px] font-semibold text-teal-300 bg-white/10 px-1.5 py-0.2 rounded">
              {roleMeta.short}
            </span>
          </div>
        )}
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            activePage === item.id || (activePage === 'details' && item.id === 'complaints')

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white/15 text-white shadow-sm font-semibold'
                  : 'text-navy-100 hover:bg-white/10 hover:text-white'
              } ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <div className="relative flex-shrink-0">
                <Icon
                  size={19}
                  className={`transition-colors ${
                    isActive ? 'text-teal-300' : 'text-navy-200 group-hover:text-white'
                  }`}
                  strokeWidth={isActive ? 2.3 : 1.9}
                />
                {item.badge && collapsed && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-[#0b2250]">
                    {item.badge}
                  </span>
                )}
              </div>

              {!collapsed && (
                <>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.badge && (
                    <span
                      className={`ml-auto flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        item.badgeColor || 'bg-white/20 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <div className="h-4 w-1 rounded-full bg-teal-400" />}
                </>
              )}
            </button>
          )
        })}

        {/* Bureau Tags Section - Only for Internal Roles */}
        {!collapsed && currentRole !== 'Complainant' && (
          <div className="pt-5 mt-4 border-t border-white/10">
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-navy-200/60 flex items-center justify-between">
              <span>Integrated Bureaus</span>
              <ShieldCheck size={13} className="text-teal-400" />
            </div>
            <div className="grid grid-cols-2 gap-1.5 px-1">
              {bureaus.map((b) => (
                <div
                  key={b.code}
                  className="rounded-md bg-white/5 px-2 py-1.5 text-left border border-white/5 hover:bg-white/10 transition cursor-default"
                >
                  <div className="text-[11px] font-bold text-teal-300">{b.code}</div>
                  <div className="text-[9px] text-navy-200 truncate">{b.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Role Switcher & Collapse Toggle Footer */}
      <div className="border-t border-white/10 p-3 space-y-2 relative">
        {/* Role Switcher Popover */}
        {showRoleMenu && !collapsed && (
          <div className="absolute bottom-full left-3 right-3 mb-2 rounded-xl bg-slate-900 border border-white/15 p-2 shadow-xl z-50 text-xs">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Switch Demo Role
            </div>
            {[
              { role: 'Complainant' as Role, label: 'Citizen (Rohit Sharma)', scope: 'Submit grievances & track dockets', userId: 'u0' },
              { role: 'BureauAdmin' as Role, label: 'Bureau Head (Dr. Priya Nair)', scope: 'PGRC Bureau oversight & assignments', userId: 'u1b' },
              { role: 'Officer' as Role, label: 'Officer (Rajesh Kumar)', scope: 'PGRC Investigating Officer', userId: 'u2' },
              { role: 'Officer' as Role, label: 'Officer (Anita Verma)', scope: 'RB Investigating Officer', userId: 'u3' },
              { role: 'Admin' as Role, label: 'System Admin (Dr. S. Mehta)', scope: 'All bureaus statutory oversight', userId: 'u1' },
            ].map((opt) => {
              const isCur = currentUser?.id === opt.userId || (currentRole === opt.role && !currentUser?.id)
              return (
                <button
                  key={`${opt.role}-${opt.userId}`}
                  type="button"
                  onClick={() => {
                    onSelectRole(opt.role, opt.userId)
                    setShowRoleMenu(false)
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition ${
                    isCur ? 'bg-teal-500/20 text-teal-300 font-bold' : 'hover:bg-white/10 text-slate-300'
                  }`}
                >
                  <div className="truncate">
                    <div className="leading-tight truncate">{opt.label}</div>
                    <div className="text-[10px] text-slate-400 truncate">{opt.scope}</div>
                  </div>
                  {isCur && <span className="text-[10px] text-teal-300 font-mono shrink-0 ml-1">Active</span>}
                </button>
              )
            })}
          </div>
        )}

        {/* Current Active Role Box */}
        {!collapsed ? (
          <div className="rounded-lg bg-white/5 p-2 border border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-md bg-teal-500/20 text-teal-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {currentUser?.avatarText || roleMeta.short[0]}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white leading-tight truncate">
                    {currentUser?.name || roleMeta.name}
                  </div>
                  <div className="text-[10px] text-navy-200 truncate">
                    {roleMeta.name}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                title="Switch demo perspective"
                className="rounded bg-white/10 hover:bg-white/20 px-2 py-1 text-[10px] font-semibold text-teal-200 transition flex items-center gap-1 flex-shrink-0"
              >
                <span>Role</span>
                <ChevronDown size={11} />
              </button>
            </div>

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="mt-2 w-full flex items-center justify-center gap-1.5 py-1 text-[11px] text-slate-300 hover:text-white hover:bg-white/10 rounded transition"
              >
                <LogOut size={13} />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => onSelectRole(currentRole === 'Admin' ? 'Officer' : currentRole === 'Officer' ? 'BureauAdmin' : currentRole === 'BureauAdmin' ? 'Complainant' : 'Admin')}
            title={`Active role: ${roleMeta.name} (Click to cycle roles)`}
            className="w-full flex justify-center py-2 text-teal-300 hover:bg-white/10 rounded-lg transition"
          >
            <UserCheck size={18} />
          </button>
        )}

        {/* Sidebar Collapse Toggle */}
        <button
          onClick={onToggleCollapse}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-1.5 text-xs text-navy-200 hover:bg-white/10 hover:text-white transition"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? (
            <ChevronRight size={16} />
          ) : (
            <>
              <ChevronLeft size={16} />
              <span className="text-[11px] font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
