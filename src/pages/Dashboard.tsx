import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Flame,
  GitMerge,
  Loader2,
  RefreshCw,
  RotateCcw,
  Shield,
  TrendingUp,
  FileText,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Complaint, DashboardAnalyticsResponse, Page, Role, Status, UserProfile } from '../types'
import { BUREAUS, BUREAU_INFO, TODAY, isOverdue, overlaps, resolveOfficerName, getAppSettings } from '../data'
import { DEFAULT_OVERLAP_STATES, OVERLAP_STORAGE_KEYS, isOverlapActivePending } from './Overlaps'
import { Button, Card, CardHeader, PageTitle, Stat } from '../components/ui'
import ComplaintTable from '../components/ComplaintTable'
import { fetchDashboardAnalyticsApi } from '../api/analytics'

interface DashboardProps {
  complaints: Complaint[]
  onOpen: (id: string) => void
  onStatus?: (id: string, s: Status, note?: string, overrideReason?: string) => Promise<{ success: boolean; error?: string } | void> | void
  onNavigate: (page: Page) => void
  currentRole: Role
  currentUser?: UserProfile
  pendingOverlapsCount?: number
}

export default function Dashboard({
  complaints,
  onOpen,
  onStatus,
  onNavigate,
  currentRole,
  currentUser,
  pendingOverlapsCount,
}: DashboardProps) {
  // If user is BureauAdmin, default to their bureau if not 'All'
  const initialBureau =
    currentRole === 'BureauAdmin' && currentUser?.bureau && currentUser.bureau !== 'All'
      ? currentUser.bureau
      : 'All'

  const [bureauFilter, setBureauFilter] = useState<string>(initialBureau)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const [analytics, setAnalytics] = useState<DashboardAnalyticsResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Scope complaints in-memory for fallback
  const scopedComplaints = useMemo(() => {
    let list = complaints
    if (currentRole === 'Complainant') {
      list = list.filter((c) =>
        Boolean(
          (currentUser?.id && c.complainantUserId === currentUser.id) ||
          (currentUser?.email &&
            c.complainantEmail &&
            c.complainantEmail.trim().toLowerCase() === currentUser.email.trim().toLowerCase())
        )
      )
    } else if (currentRole === 'Officer') {
      list = list.filter((c) => {
        if (c.assignedUserId) {
          return Boolean(currentUser?.id && c.assignedUserId === currentUser.id)
        }
        return Boolean(
          currentUser?.name &&
          (c.officer === currentUser.name || resolveOfficerName(c) === currentUser.name)
        )
      })
    } else if (currentRole === 'BureauAdmin') {
      list = list.filter((c) =>
        currentUser?.bureau === 'All' ||
        c.bureau.toUpperCase() === (currentUser?.bureau || '').toUpperCase()
      )
    }

    if (bureauFilter !== 'All') {
      list = list.filter((c) => c.bureau.toUpperCase() === bureauFilter.toUpperCase())
    }
    if (startDate) {
      list = list.filter((c) => c.date >= startDate)
    }
    if (endDate) {
      list = list.filter((c) => c.date <= endDate)
    }
    return list
  }, [complaints, currentRole, currentUser, bureauFilter, startDate, endDate])

  // Fetch real database-backed analytics
  const loadAnalytics = useCallback(async () => {
    setIsLoading(true)
    setApiError(null)
    try {
      const data = await fetchDashboardAnalyticsApi({
        bureau: bureauFilter !== 'All' ? bureauFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        asOfDate: TODAY,
      })
      setAnalytics(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to backend analytics service.'
      setApiError(msg)
      // Fallback remains active via in-memory scopedComplaints
    } finally {
      setIsLoading(false)
    }
  }, [bureauFilter, startDate, endDate])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  // Fallback in-memory calculations if API not yet loaded or on error
  const fallbackTotal = scopedComplaints.length
  const fallbackPending = scopedComplaints.filter((c) => c.status === 'Pending').length
  const fallbackInProgress = scopedComplaints.filter((c) => c.status === 'In Progress').length
  const fallbackResolved = scopedComplaints.filter((c) => c.status === 'Resolved').length
  const fallbackEscalated = scopedComplaints.filter((c) => c.status === 'Escalated').length
  const fallbackOverdue = scopedComplaints.filter(isOverdue).length
  const fallbackCriticalHigh = scopedComplaints.filter(
    (c) => c.priority === 'Critical' || c.priority === 'High'
  ).length
  const fallbackPendingOverlaps =
    currentRole === 'Complainant'
      ? 0
      : pendingOverlapsCount !== undefined
      ? pendingOverlapsCount
      : (() => {
          try {
            const stored = localStorage.getItem(OVERLAP_STORAGE_KEYS.STATES)
            const states = stored ? JSON.parse(stored) : DEFAULT_OVERLAP_STATES
            const threshold = getAppSettings().similarityThreshold ?? 75
            return overlaps.filter((o) => isOverlapActivePending(o, states, threshold)).length
          } catch {
            return overlaps.filter((o) => isOverlapActivePending(o, DEFAULT_OVERLAP_STATES, 75)).length
          }
        })()
  const fallbackResolutionRate = Math.round((fallbackResolved / fallbackTotal) * 100) || 0

  // Active metrics: prefer live database-backed analytics from backend
  const totalCases = analytics ? analytics.kpis.total : fallbackTotal
  const pendingCases = analytics ? analytics.kpis.pending : fallbackPending
  const inProgressCases = analytics ? analytics.kpis.inProgress : fallbackInProgress
  const resolvedCases = analytics ? analytics.kpis.resolved : fallbackResolved
  const escalatedCases = analytics ? analytics.kpis.escalated : fallbackEscalated
  const overdueCases = analytics ? analytics.kpis.overdue : fallbackOverdue
  const criticalHighCases = analytics ? analytics.kpis.criticalHigh : fallbackCriticalHigh
  const pendingOverlaps = analytics ? analytics.kpis.pendingOverlaps : fallbackPendingOverlaps
  const resolutionRate = analytics ? analytics.kpis.resolutionRate : fallbackResolutionRate

  // Real historical trend from backend
  const totalTrend = analytics?.kpis.totalTrend ?? null
  const totalTrendLabel = analytics?.kpis.totalTrendLabel ?? (fallbackTotal > 0 ? 'in active scope' : 'no records')

  // Bureau Chart Data
  const bureauData = useMemo(() => {
    if (analytics && analytics.bureauBreakdown.length > 0) {
      return analytics.bureauBreakdown
    }
    return BUREAUS.map((b) => {
      const list = scopedComplaints.filter((c) => c.bureau === b)
      return {
        name: b,
        Resolved: list.filter((c) => c.status === 'Resolved').length,
        'In Progress': list.filter((c) => c.status === 'In Progress').length,
        Pending: list.filter((c) => c.status === 'Pending').length,
        Escalated: list.filter((c) => c.status === 'Escalated').length,
        Total: list.length,
      }
    })
  }, [analytics, scopedComplaints])

  // Priority Distribution Chart Data
  const priorityData = useMemo(() => {
    if (analytics && analytics.priorityDistribution.length > 0) {
      return analytics.priorityDistribution
    }
    return [
      { name: 'Critical', value: scopedComplaints.filter((c) => c.priority === 'Critical').length, color: '#dc2626' },
      { name: 'High', value: scopedComplaints.filter((c) => c.priority === 'High').length, color: '#ea580c' },
      { name: 'Medium', value: scopedComplaints.filter((c) => c.priority === 'Medium').length, color: '#d97706' },
      { name: 'Low', value: scopedComplaints.filter((c) => c.priority === 'Low').length, color: '#64748b' },
    ]
  }, [analytics, scopedComplaints])

  // Recent complaints
  const recentCases = useMemo(() => {
    if (analytics && analytics.recentCases.length > 0) {
      return analytics.recentCases
    }
    return [...scopedComplaints]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
  }, [analytics, scopedComplaints])

  const handleResetFilters = () => {
    setBureauFilter(initialBureau)
    setStartDate('')
    setEndDate('')
  }

  const isFilterActive = bureauFilter !== initialBureau || Boolean(startDate) || Boolean(endDate)

  return (
    <div className="space-y-6">
      {/* Page Title & Scope Header */}
      <PageTitle
        title={
          currentRole === 'Complainant'
            ? 'My Grievance Dashboard'
            : currentRole === 'Officer'
            ? 'Officer Grievance Dashboard'
            : currentRole === 'BureauAdmin'
            ? `${currentUser?.bureau || 'Bureau'} Dashboard`
            : 'Grievance Monitoring Dashboard'
        }
        sub={
          currentRole === 'Complainant'
            ? 'Track your registered grievance filings and resolution status'
            : currentRole === 'Officer'
            ? `Assigned grievance case surveillance for ${currentUser?.name || 'Officer'}`
            : currentRole === 'BureauAdmin'
            ? `Jurisdiction monitoring for ${currentUser?.bureau || 'Bureau'} Cell`
            : 'Cross-bureau grievance monitoring, SLA compliance, and case volume'
        }
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadAnalytics}
              disabled={isLoading}
              className="text-xs flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              <span>{isLoading ? 'Updating...' : 'Refresh'}</span>
            </Button>
          </div>
        }
      />

      {/* Filter and Date-Range Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Bureau Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter size={14} className="text-slate-400" />
            <span className="font-semibold text-slate-700">Bureau:</span>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/70 p-0.5">
              {['All', 'RB', 'PGRC', 'Approval', 'Academic', 'SB', 'EO'].map((b) => {
                const isRestricted =
                  currentRole === 'BureauAdmin' &&
                  currentUser?.bureau &&
                  currentUser.bureau !== 'All' &&
                  b !== 'All' &&
                  b.toUpperCase() !== currentUser.bureau.toUpperCase()

                return (
                  <button
                    key={b}
                    onClick={() => !isRestricted && setBureauFilter(b)}
                    disabled={isRestricted}
                    title={isRestricted ? `Restricted to authorized ${currentUser?.bureau} Bureau` : undefined}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      bureauFilter === b
                        ? 'bg-navy-800 text-white shadow-2xs'
                        : isRestricted
                        ? 'opacity-40 cursor-not-allowed text-slate-400'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    {b}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date Range Filters */}
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Calendar size={14} className="text-slate-400 ml-2" />
            <span className="font-semibold text-slate-700">Filing Period:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1 text-xs text-slate-800 focus:border-navy-600 focus:outline-hidden"
              placeholder="From"
            />
            <span className="text-slate-400">&ndash;</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1 text-xs text-slate-800 focus:border-navy-600 focus:outline-hidden"
              placeholder="To"
            />
          </div>
        </div>

        {/* Clear Filters / Indicator */}
        <div className="flex items-center gap-2">
          {isFilterActive && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
          <span className="text-xs font-medium text-slate-500">
            {isLoading ? (
              <span className="flex items-center gap-1.5 text-navy-700">
                <Loader2 size={13} className="animate-spin" />
                Updating...
              </span>
            ) : (
              <span className="text-slate-600">Showing {totalCases} case{totalCases === 1 ? '' : 's'}</span>
            )}
          </span>
        </div>
      </div>

      {/* API Error Notification with Retry option */}
      {apiError && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={16} className="text-amber-700 shrink-0" />
            <span>
              Unable to reach analytics service ({apiError}). Showing local data.
            </span>
          </div>
          <button
            onClick={loadAnalytics}
            className="text-amber-800 hover:text-amber-950 font-bold underline ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Top Banner Alert if any Overdue cases exist */}
      {overdueCases > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50/90 p-4 text-red-900 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-100 p-2 text-red-700">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold">
                {overdueCases} Case{overdueCases > 1 ? 's' : ''} Past SLA Window
              </h4>
              <p className="text-xs text-red-700 mt-0.5">
                Grievance files past resolution deadline as of {TODAY}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => onNavigate('tracking')}
              className="text-xs"
            >
              View Tracker
            </Button>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Total Complaints"
          value={totalCases}
          icon={FileText}
          color="bg-navy-50 text-navy-800"
          trend={totalTrend ?? undefined}
          trendLabel={totalTrendLabel}
          onClick={() => onNavigate('complaints')}
        />
        <Stat
          label="Under Investigation"
          value={pendingCases + inProgressCases}
          icon={Clock}
          color="bg-blue-50 text-blue-700"
          trend={`${inProgressCases} active`}
          trendLabel="in progress"
          onClick={() => onNavigate('complaints')}
        />
        <Stat
          label="Overdue"
          value={overdueCases}
          icon={AlertTriangle}
          color="bg-rose-50 text-rose-700"
          trend={overdueCases > 0 ? 'Action Needed' : 'Compliant'}
          trendLabel={overdueCases > 0 ? 'Past SLA' : 'Within SLA'}
          onClick={() => onNavigate('tracking')}
        />
        {currentRole !== 'Complainant' && (
          <Stat
            label="Cross-Bureau Overlaps"
            value={pendingOverlaps}
            icon={GitMerge}
            color="bg-indigo-50 text-indigo-700"
            trend={pendingOverlaps > 0 ? `${pendingOverlaps} Pending` : 'Cleared'}
            trendLabel={pendingOverlaps > 0 ? 'Review needed' : 'No duplicates'}
            onClick={() => onNavigate('overlaps')}
          />
        )}
        <Stat
          label="Resolved Cases"
          value={resolvedCases}
          icon={CheckCircle2}
          color="bg-emerald-50 text-emerald-700"
          trend={`${resolutionRate}%`}
          trendLabel="closure rate"
          onClick={() => onNavigate('reports')}
        />
        <Stat
          label="High & Critical"
          value={criticalHighCases}
          icon={Flame}
          color="bg-amber-50 text-amber-700"
          trend={`${totalCases > 0 ? Math.round((criticalHighCases / totalCases) * 100) : 0}%`}
          trendLabel="of all cases"
          onClick={() => onNavigate('complaints')}
        />
      </div>

      {/* Main Grid: Charts & Analytics */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Bureau Distribution Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Bureau Case Distribution"
            sub="Active complaints grouped by AICTE bureau"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('reports')}
                className="text-xs"
              >
                View Reports
              </Button>
            }
          />
          <div className="h-72 w-full pt-2">
            {totalCases === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-slate-400">
                <BarChart3 size={36} className="text-slate-300 mb-2" />
                <p className="text-xs">No complaint data recorded for the selected scope</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bureauData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={12} stroke="#64748b" tickLine={false} />
                  <YAxis allowDecimals={false} fontSize={12} stroke="#64748b" tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      borderColor: '#e2e8f0',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="Resolved" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="In Progress" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="Pending" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="Escalated" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Priority Breakdown Pie Chart */}
        <Card>
          <CardHeader
            title="Priority Breakdown"
            sub="Distribution by case severity level"
          />
          <div className="h-56 w-full flex items-center justify-center">
            {totalCases === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-slate-400">
                <Clock size={32} className="text-slate-300 mb-1" />
                <p className="text-xs">No severity metrics available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      borderColor: '#e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
            {priorityData.map((p) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-slate-600 font-medium">{p.name}:</span>
                <span className="font-bold text-slate-800">{p.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Cross-Bureau Overlap Highlight Banner */}
      {currentRole !== 'Complainant' && (
        <Card className="border-l-4 border-l-teal-600 bg-gradient-to-r from-teal-50/40 via-white to-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-600 text-white shadow-xs">
                  <GitMerge size={14} />
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  Cross-Bureau Overlap Detection
                </h3>
              </div>
              <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                {pendingOverlaps > 0
                  ? `${pendingOverlaps} unreviewed overlap ${pendingOverlaps === 1 ? 'candidate' : 'candidates'} detected across RB and PGRC requiring review.`
                  : 'All detected cross-bureau overlap records have been reviewed.'}
              </p>
            </div>
            <Button
              variant="teal"
              size="sm"
              onClick={() => onNavigate('overlaps')}
              className="text-xs flex items-center gap-1.5"
            >
              <span>Review Overlaps</span>
              <ArrowRight size={13} />
            </Button>
          </div>
        </Card>
      )}

      {/* Recent Complaints Table Section */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Recent Complaints</h3>
            <p className="text-xs text-slate-500">
              Latest grievance dockets in current scope
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('complaints')}
              className="text-xs"
            >
              View All
            </Button>
          </div>
        </div>

        {recentCases.length === 0 ? (
          <div className="py-10 text-center">
            <FileText size={32} className="mx-auto text-slate-300 mb-2" />
            <h4 className="text-sm font-semibold text-slate-700">No Complaints Found</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              No complaint records match the active role permissions, bureau filter, or date range.
            </p>
            {isFilterActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="mt-3 text-xs"
              >
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          <ComplaintTable
            rows={recentCases}
            onOpen={onOpen}
            onStatus={onStatus}
            compact={false}
            showActions={true}
            currentRole={currentRole}
            currentUser={currentUser}
          />
        )}
      </Card>
    </div>
  )
}
