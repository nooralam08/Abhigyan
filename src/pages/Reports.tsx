import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  PieChart as PieIcon,
  Printer,
  RefreshCw,
  RotateCcw,
  TrendingUp,
} from 'lucide-react'
import type { Complaint, Role, UserProfile, ReportsAnalyticsResponse } from '../types'
import { BUREAUS, BUREAU_INFO, STATUSES, TODAY, instName, resolveOfficerName } from '../data'
import { Badge, Button, Card, CardHeader, PageTitle } from '../components/ui'
import { fetchReportsAnalyticsApi } from '../api/analytics'

const PALETTE = ['#0b2250', '#1d4a94', '#0d9488', '#f59e0b', '#dc2626', '#8b5cf6', '#64748b']
const STATUS_COLORS: Record<string, string> = {
  Pending: '#f59e0b',
  'In Progress': '#3b82f6',
  Escalated: '#ef4444',
  Resolved: '#10b981',
}

interface ReportsProps {
  complaints: Complaint[]
  currentRole?: Role
  currentUser?: UserProfile
}

export default function Reports({ complaints, currentRole, currentUser }: ReportsProps) {
  const initialBureau =
    currentRole === 'BureauAdmin' && currentUser?.bureau && currentUser.bureau !== 'All'
      ? currentUser.bureau
      : 'All'

  const [bureauFilter, setBureauFilter] = useState<string>(initialBureau)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [downloadSuccess, setDownloadSuccess] = useState(false)

  const [analytics, setAnalytics] = useState<ReportsAnalyticsResponse | null>(null)
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

  // Fetch real database-backed reports analytics
  const loadReportsAnalytics = useCallback(async () => {
    setIsLoading(true)
    setApiError(null)
    try {
      const data = await fetchReportsAnalyticsApi({
        bureau: bureauFilter !== 'All' ? bureauFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        asOfDate: TODAY,
      })
      setAnalytics(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to backend reports analytics service.'
      setApiError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [bureauFilter, startDate, endDate])

  useEffect(() => {
    loadReportsAnalytics()
  }, [loadReportsAnalytics])

  // In-memory fallback computations
  const fallbackCategoryData = useMemo(() => {
    const counts: Record<string, number> = {}
    scopedComplaints.forEach((c) => {
      counts[c.category] = (counts[c.category] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [scopedComplaints])

  const fallbackStatusData = useMemo(() => {
    return STATUSES.map((s) => ({
      name: s,
      value: scopedComplaints.filter((c) => c.status === s).length,
    }))
  }, [scopedComplaints])

  const fallbackBureauData = useMemo(() => {
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
  }, [scopedComplaints])

  const fallbackTurnaroundDays = useMemo(() => {
    const resolved = scopedComplaints.filter((c) => c.status === 'Resolved' && c.date)
    const turnarounds: number[] = []
    for (const c of resolved) {
      const resDate = c.lastActionDate || c.date
      const t1 = new Date(c.date).getTime()
      const t2 = new Date(resDate).getTime()
      const diff = Math.round((t2 - t1) / (1000 * 3600 * 24))
      if (diff >= 0) turnarounds.push(diff)
    }
    return turnarounds.length > 0 ? (turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length).toFixed(1) : null
  }, [scopedComplaints])

  // Active chart and table datasets
  const categoryData = analytics ? analytics.categoryDistribution : fallbackCategoryData
  const statusData = analytics ? analytics.statusDistribution : fallbackStatusData
  const bureauData = analytics ? analytics.bureauBreakdown : fallbackBureauData
  const monthlyData = analytics ? analytics.monthlyTrends : []

  const totalCases = analytics ? analytics.kpis.total : scopedComplaints.length
  const resolvedCases = analytics
    ? analytics.kpis.resolved
    : scopedComplaints.filter((c) => c.status === 'Resolved').length
  const resolutionRate = analytics
    ? analytics.kpis.resolutionRate
    : totalCases > 0
    ? Math.round((resolvedCases / totalCases) * 100)
    : 0

  const avgTurnaroundDisplay = analytics
    ? analytics.kpis.avgTurnaroundDays !== null
      ? `${analytics.kpis.avgTurnaroundDays} Days`
      : 'N/A'
    : fallbackTurnaroundDays !== null
    ? `${fallbackTurnaroundDays} Days`
    : 'N/A'

  const redundancyRateDisplay = analytics
    ? analytics.kpis.redundancyPreventedRate !== null
      ? `${analytics.kpis.redundancyPreventedRate}%`
      : currentRole === 'Complainant'
      ? 'Restricted'
      : '0%'
    : currentRole === 'Complainant'
    ? 'Restricted'
    : '0%'

  const handlePrint = () => {
    window.print()
  }

  const handleResetFilters = () => {
    setBureauFilter(initialBureau)
    setStartDate('')
    setEndDate('')
  }

  const isFilterActive = bureauFilter !== initialBureau || Boolean(startDate) || Boolean(endDate)

  const handleDownloadDossierCSV = () => {
    const headers = [
      'Case ID',
      'AICTE Permanent ID',
      'Institution Name',
      'Bureau / Cell',
      'Category',
      'Priority',
      'Investigating Officer',
      'Status',
      'Filing Date',
      'Statutory SLA Due Date',
      'Subject Title',
      'Case Description',
    ]

    const escapeCsv = (str: string) => {
      const escaped = (str || '').replace(/"/g, '""')
      return `"${escaped}"`
    }

    const rows = scopedComplaints.map((c) => [
      c.id,
      c.institutionPermanentId || '',
      instName(c.institutionId),
      c.bureau,
      c.category,
      c.priority,
      resolveOfficerName(c),
      c.status,
      c.date,
      c.due,
      c.title,
      c.description.replace(/[\r\n]+/g, ' '),
    ])

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ].join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `AICTE_Abhigyan_Compliance_Dossier_${TODAY}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setDownloadSuccess(true)
    setTimeout(() => {
      setDownloadSuccess(false)
    }, 6000)
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Reports &amp; Analytics"
        sub="Compliance metrics, resolution throughput, and disposal trends"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="text-xs">
              <Printer size={14} />
              <span>Print (PDF)</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownloadDossierCSV}
              className="text-xs"
            >
              <Download size={14} />
              <span>Export CSV</span>
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
            <span className="font-semibold text-slate-700">Bureau Scope:</span>
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

          {/* Date Range Inputs */}
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

        {/* Clear Filters / Reload */}
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
          <Button
            variant="outline"
            size="sm"
            onClick={loadReportsAnalytics}
            disabled={isLoading}
            className="text-xs"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
          </Button>
        </div>
      </div>

      {/* API Notice / Error */}
      {apiError && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={16} className="text-amber-700 shrink-0" />
            <span>
              Unable to reach analytics service ({apiError}). Showing local data.
            </span>
          </div>
          <button
            onClick={loadReportsAnalytics}
            className="text-amber-800 hover:text-amber-950 font-bold underline ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Historical Data Notice */}
      {analytics?.dataNote && (
        <div className="flex items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-2.5 text-xs text-blue-900 shadow-2xs">
          <Clock size={15} className="text-blue-700 shrink-0" />
          <span>
            <strong>Notice:</strong> {analytics.dataNote}
          </span>
        </div>
      )}

      {downloadSuccess && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
            <span>
              Report exported successfully as <strong>AICTE_Abhigyan_Compliance_Dossier_{TODAY}.csv</strong> ({totalCases} records).
            </span>
          </div>
          <button
            onClick={() => setDownloadSuccess(false)}
            className="text-emerald-700 hover:text-emerald-950 font-semibold text-xs ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary KPI Ribbon */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-navy-50 p-3 text-navy-800">
            <FileText size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{totalCases}</div>
            <div className="text-xs text-slate-500">Total Registered</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{resolutionRate}%</div>
            <div className="text-xs text-slate-500">Resolution Rate</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
            <TrendingUp size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{avgTurnaroundDisplay}</div>
            <div className="text-xs text-slate-500">Average Resolution Time</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-50 p-3 text-indigo-700">
            <BarChart3 size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{redundancyRateDisplay}</div>
            <div className="text-xs text-slate-500">
              {currentRole === 'Complainant'
                ? 'Overlap Resolution (Restricted)'
                : 'Overlap Resolution Rate'}
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Grid Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category Breakdown */}
        <Card>
          <CardHeader
            title="Grievance Categories"
            sub="Distribution across grievance subject categories"
          />
          <div className="h-72 w-full">
            {categoryData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-slate-400">
                <PieIcon size={36} className="text-slate-300 mb-2" />
                <p className="text-xs">No complaint categories found in current scope</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={95}
                    innerRadius={45}
                    paddingAngle={3}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
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
        </Card>

        {/* Resolution Status Distribution */}
        <Card>
          <CardHeader
            title="Status Distribution"
            sub="Complaints by resolution stage"
          />
          <div className="h-72 w-full">
            {totalCases === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-slate-400">
                <Clock size={36} className="text-slate-300 mb-2" />
                <p className="text-xs">No cases recorded for resolution tracking</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={4}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((s) => (
                      <Cell key={s.name} fill={STATUS_COLORS[s.name] || '#64748b'} />
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
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Charts Grid Row 2: Monthly Trends and Bureau Breakdown */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Bureau-wise Stacked Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Bureau Workload &amp; Status"
            sub="Volume and disposal status across bureaus"
          />
          <div className="h-80 w-full pt-2">
            {totalCases === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-slate-400">
                <BarChart3 size={36} className="text-slate-300 mb-2" />
                <p className="text-xs">No bureau records found matching filters</p>
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
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  {STATUSES.map((s) => (
                    <Bar
                      key={s}
                      dataKey={s}
                      stackId="a"
                      fill={STATUS_COLORS[s]}
                      radius={s === 'Escalated' ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Real Historical Intake vs Resolution Trend */}
        <Card>
          <CardHeader
            title="Filing vs Resolution Trend"
            sub="Monthly complaint filing vs resolution trend"
          />
          <div className="h-80 w-full pt-2">
            {monthlyData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-slate-400 px-4 text-center">
                <TrendingUp size={36} className="text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-600">No Historical Time-Series Records</p>
                <p className="text-2xs text-slate-400 mt-1">
                  Complaints matching the current scope or date range do not span multiple historical months.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" fontSize={10} stroke="#64748b" tickLine={false} />
                  <YAxis allowDecimals={false} fontSize={12} stroke="#64748b" tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      borderColor: '#e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line
                    type="monotone"
                    dataKey="Filed"
                    stroke="#ef4444"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Resolved"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
