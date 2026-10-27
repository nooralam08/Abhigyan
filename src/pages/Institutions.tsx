import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  GitMerge,
  Layers,
  Mail,
  MapPin,
  Phone,
  Search,
  Shield,
  ShieldAlert,
  User,
  Users,
} from 'lucide-react'
import type { Complaint, Role, Status, UserProfile } from '../types'
import { BUREAU_INFO, institutions, isOverdue, resolveOfficerName } from '../data'
import { Badge, Button, Card, CardHeader, PageTitle, SearchBox } from '../components/ui'

interface InstitutionsProps {
  complaints: Complaint[]
  onOpen: (id: string) => void
  onStatus?: (id: string, s: Status, note?: string) => void
  currentRole?: Role
  currentUser?: UserProfile
  selectedInstitutionId?: string
  onSelectInstitution?: (id: string) => void
  onNavigateToOverlaps?: () => void
}

const STORAGE_KEY = 'abhigyan_selected_institution_id'

export default function Institutions({
  complaints,
  onOpen,
  onStatus,
  currentRole,
  currentUser,
  selectedInstitutionId: propSelectedId,
  onSelectInstitution,
  onNavigateToOverlaps,
}: InstitutionsProps) {
  // Directory Search & Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [dualExposureFilter, setDualExposureFilter] = useState<'All' | 'dual' | 'single'>('All')
  const [viewMode, setViewMode] = useState<'directory' | 'profile'>(() => {
    // If a specific institution is requested or saved, default to profile view, else directory
    return 'profile'
  })

  // Selected Institution State
  const [selectedInstId, setSelectedInstId] = useState<string>(() => {
    if (propSelectedId) return propSelectedId
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored && institutions.some((i) => i.id === stored)) {
        return stored
      }
    } catch {
      // fallback
    }
    return institutions[0].id
  })

  // Sync prop changes
  useEffect(() => {
    if (propSelectedId && institutions.some((i) => i.id === propSelectedId)) {
      setSelectedInstId(propSelectedId)
      setViewMode('profile')
    }
  }, [propSelectedId])

  // Save selection
  const handleSelect = (id: string) => {
    setSelectedInstId(id)
    setViewMode('profile')
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // ignore
    }
    if (onSelectInstitution) {
      onSelectInstitution(id)
    }
  }

  // Active institution object
  const currentInst = institutions.find((i) => i.id === selectedInstId) || institutions[0]

  // Complaints linked to current institution across all bureaus
  const instComplaints = useMemo(() => {
    return complaints.filter(
      (c) =>
        c.institutionId === currentInst.id ||
        (c.institutionPermanentId && c.institutionPermanentId === currentInst.aicteId)
    )
  }, [complaints, currentInst])

  // Summary Metrics for Active Institution
  const totalCases = instComplaints.length
  const pendingCases = instComplaints.filter((c) => c.status === 'Pending').length
  const inProgressCases = instComplaints.filter((c) => c.status === 'In Progress').length
  const resolvedCases = instComplaints.filter((c) => c.status === 'Resolved').length
  const overdueCases = instComplaints.filter((c) => isOverdue(c)).length

  // Highlight check: Does institution have complaints handled by both RB and PGRC?
  const hasRB = instComplaints.some((c) => c.bureau === 'RB')
  const hasPGRC = instComplaints.some((c) => c.bureau === 'PGRC')
  const hasBothRBandPGRC = hasRB && hasPGRC

  const rbCount = instComplaints.filter((c) => c.bureau === 'RB').length
  const pgrcCount = instComplaints.filter((c) => c.bureau === 'PGRC').length

  // Bureau breakdown for active institution
  const bureauCounts: Record<string, number> = {}
  instComplaints.forEach((c) => {
    bureauCounts[c.bureau] = (bureauCounts[c.bureau] || 0) + 1
  })

  // Consolidated Timeline of Complaint Activity across all dockets
  const timelineEvents = useMemo(() => {
    const list: Array<{
      date: string
      label: string
      by?: string
      role?: Role
      note?: string
      caseId: string
      bureau: string
      status: Status
      title: string
    }> = []

    instComplaints.forEach((c) => {
      // Add filing event if not already in timeline
      if (c.timeline && c.timeline.length > 0) {
        c.timeline.forEach((ev) => {
          list.push({
            date: ev.date,
            label: ev.label,
            by: ev.by,
            role: ev.role,
            note: ev.note,
            caseId: c.id,
            bureau: c.bureau,
            status: c.status,
            title: c.title,
          })
        })
      } else {
        list.push({
          date: c.date,
          label: 'Grievance Docket Registered & Scrutiny Initiated',
          by: resolveOfficerName(c),
          caseId: c.id,
          bureau: c.bureau,
          status: c.status,
          title: c.title,
          note: c.description,
        })
      }
    })

    // Sort descending by date
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [instComplaints])

  // Table filters inside Profile view
  const [complaintBureauFilter, setComplaintBureauFilter] = useState('All')
  const [complaintStatusFilter, setComplaintStatusFilter] = useState('All')
  const [complaintSearch, setComplaintSearch] = useState('')
  const [timelineBureauFilter, setTimelineBureauFilter] = useState('All')

  // Filtered complaints table
  const filteredComplaints = useMemo(() => {
    return instComplaints.filter((c) => {
      const matchesBureau = complaintBureauFilter === 'All' || c.bureau === complaintBureauFilter
      let matchesStatus = true
      if (complaintStatusFilter === 'Overdue') {
        matchesStatus = isOverdue(c)
      } else if (complaintStatusFilter !== 'All') {
        matchesStatus = c.status === complaintStatusFilter
      }
      const matchesSearch =
        !complaintSearch.trim() ||
        `${c.id} ${c.title} ${c.description} ${c.category} ${resolveOfficerName(c)}`
          .toLowerCase()
          .includes(complaintSearch.toLowerCase().trim())

      return matchesBureau && matchesStatus && matchesSearch
    })
  }, [instComplaints, complaintBureauFilter, complaintStatusFilter, complaintSearch])

  // Directory filter options
  const states = ['All', ...Array.from(new Set(institutions.map((i) => i.state)))]
  const types = ['All', ...Array.from(new Set(institutions.map((i) => i.type)))]

  // Directory list with counts and dual status
  const directoryItems = useMemo(() => {
    return institutions.map((inst) => {
      const instCases = complaints.filter(
        (c) =>
          c.institutionId === inst.id ||
          (c.institutionPermanentId && c.institutionPermanentId === inst.aicteId)
      )
      const hasRBInst = instCases.some((c) => c.bureau === 'RB')
      const hasPGRCInst = instCases.some((c) => c.bureau === 'PGRC')
      const isDual = hasRBInst && hasPGRCInst
      const activeCount = instCases.filter((c) => c.status !== 'Resolved').length
      const overdueCount = instCases.filter(isOverdue).length

      return {
        ...inst,
        totalCasesCount: instCases.length,
        activeCasesCount: activeCount,
        overdueCasesCount: overdueCount,
        isDualExposure: isDual,
        hasRB: hasRBInst,
        hasPGRC: hasPGRCInst,
      }
    })
  }, [complaints])

  const filteredDirectory = useMemo(() => {
    return directoryItems.filter((inst) => {
      const text = `${inst.name} ${inst.aicteId} ${inst.city} ${inst.state} ${inst.type}`.toLowerCase()
      const matchesSearch = !searchQuery.trim() || text.includes(searchQuery.toLowerCase().trim())
      const matchesState = stateFilter === 'All' || inst.state === stateFilter
      const matchesType = typeFilter === 'All' || inst.type === typeFilter
      const matchesDual =
        dualExposureFilter === 'All' ||
        (dualExposureFilter === 'dual' && inst.isDualExposure) ||
        (dualExposureFilter === 'single' && !inst.isDualExposure)

      return matchesSearch && matchesState && matchesType && matchesDual
    })
  }, [directoryItems, searchQuery, stateFilter, typeFilter, dualExposureFilter])

  return (
    <div className="space-y-6">
      {/* Top Banner and Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/60 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Institutions Directory &amp; Dossier
            </h1>
            <span className="rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-semibold text-navy-800 border border-navy-200">
              National Registry
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Institutional registry and cross-bureau grievance dossiers indexed by permanent AICTE ID.
          </p>
        </div>

        {/* View Switcher Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'directory' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('directory')}
            className="text-xs"
          >
            <Building2 size={14} />
            <span>Directory</span>
          </Button>

          <Button
            variant={viewMode === 'profile' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('profile')}
            className="text-xs"
          >
            <FileText size={14} />
            <span>Profile View</span>
          </Button>
        </div>
      </div>

      {/* VIEW A: FULL SEARCHABLE INSTITUTION DIRECTORY */}
      {viewMode === 'directory' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Quick Metrics across all institutions */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card padding="p-4" className="border-l-4 border-l-navy-800">
              <div className="text-xs font-semibold text-slate-500 uppercase">Total Institutions</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{institutions.length}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Indexed by Permanent ID</div>
            </Card>

            <Card padding="p-4" className="border-l-4 border-l-amber-500">
              <div className="text-xs font-semibold text-slate-500 uppercase">Dual RB + PGRC Exposure</div>
              <div className="mt-1 text-2xl font-bold text-amber-700">
                {directoryItems.filter((i) => i.isDualExposure).length}
              </div>
              <div className="text-[11px] text-amber-600 font-medium mt-0.5">Dual-Bureau Inquiries</div>
            </Card>

            <Card padding="p-4" className="border-l-4 border-l-rose-500">
              <div className="text-xs font-semibold text-slate-500 uppercase">High Risk Campuses</div>
              <div className="mt-1 text-2xl font-bold text-rose-700">
                {directoryItems.filter((i) => i.riskLevel === 'High').length}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Multiple active violations</div>
            </Card>

            <Card padding="p-4" className="border-l-4 border-l-teal-600">
              <div className="text-xs font-semibold text-slate-500 uppercase">Total Complaints Tracked</div>
              <div className="mt-1 text-2xl font-bold text-teal-800">{complaints.length}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Across all 6 AICTE bureaus</div>
            </Card>
          </div>

          {/* Directory Search & Filter Controls */}
          <Card className="space-y-4">
            <CardHeader
              title="Searchable Technical Institutions Directory"
              sub={`Showing ${filteredDirectory.length} of ${institutions.length} registered campuses`}
            />

            <div className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <SearchBox
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search by Institution Name, Permanent ID (PID), City, State..."
                />
              </div>

              <div>
                <select
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-200"
                >
                  {states.map((s) => (
                    <option key={s} value={s}>
                      State: {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-200"
                >
                  {types.map((t) => (
                    <option key={t} value={t}>
                      Type: {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Filter Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-semibold flex items-center gap-1">
                <Filter size={12} />
                <span>Oversight Filter:</span>
              </span>
              <button
                onClick={() => setDualExposureFilter('All')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  dualExposureFilter === 'All'
                    ? 'bg-navy-800 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Campuses ({institutions.length})
              </button>
              <button
                onClick={() => setDualExposureFilter('dual')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                  dualExposureFilter === 'dual'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                <GitMerge size={12} />
                <span>Dual RB + PGRC Exposure ({directoryItems.filter((i) => i.isDualExposure).length})</span>
              </button>
              <button
                onClick={() => setDualExposureFilter('single')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  dualExposureFilter === 'single'
                    ? 'bg-navy-800 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Single / Other Bureau ({directoryItems.filter((i) => !i.isDualExposure).length})
              </button>
            </div>

            {/* Directory Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Institution Name</th>
                    <th className="px-3 py-3">Institution Code (PID)</th>
                    <th className="px-3 py-3">City &amp; State</th>
                    <th className="px-3 py-3">Institution Type</th>
                    <th className="px-3 py-3">Total Cases</th>
                    <th className="px-3 py-3">RB &amp; PGRC Status</th>
                    <th className="px-3 py-3">Risk Assessment</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDirectory.map((inst) => (
                    <tr
                      key={inst.id}
                      onClick={() => handleSelect(inst.id)}
                      className={`cursor-pointer transition hover:bg-navy-50/50 ${
                        selectedInstId === inst.id ? 'bg-navy-50/70 font-medium' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Building size={15} className="text-navy-700 flex-shrink-0" />
                          <span>{inst.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono font-bold text-navy-800">{inst.aicteId}</td>
                      <td className="px-3 py-3 text-slate-600">
                        {inst.city}, {inst.state}
                      </td>
                      <td className="px-3 py-3">
                        <Badge v={inst.type} />
                      </td>
                      <td className="px-3 py-3 font-semibold">
                        <span className="font-mono text-slate-900">{inst.totalCasesCount} total</span>
                        {inst.activeCasesCount > 0 && (
                          <span className="ml-1 text-[11px] text-amber-700 font-normal">
                            ({inst.activeCasesCount} active)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {inst.isDualExposure ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                            <GitMerge size={12} className="text-amber-700" />
                            <span>Both RB &amp; PGRC</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            {inst.hasRB ? 'RB Only' : inst.hasPGRC ? 'PGRC Only' : 'Single Bureau'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Badge v={`Risk: ${inst.riskLevel || 'Low'}`} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelect(inst.id)
                          }}
                          className="text-[11px]"
                        >
                          <span>Open Profile</span>
                          <ChevronRight size={12} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredDirectory.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                        No institutions match the filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* VIEW B: CONSOLIDATED INSTITUTION PROFILE */}
      {viewMode === 'profile' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Institution Switcher and Directory Breadcrumb */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('directory')}
                className="text-xs"
              >
                <ArrowLeft size={13} />
                <span>Browse All Institutions</span>
              </Button>
              <span className="text-xs text-slate-400">|</span>
              <span className="text-xs text-slate-600 font-medium">
                Active Profile: <strong className="text-slate-900">{currentInst.name}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Quick Switch:</span>
              <select
                value={selectedInstId}
                onChange={(e) => handleSelect(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-200"
              >
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.aicteId})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 1. PROFILE HEADER WITH INSTITUTION DETAILS AND TOTAL COMPLAINT COUNT */}
          <Card className="border-t-4 border-t-navy-800 bg-gradient-to-r from-white via-white to-slate-50/50">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-navy-100 px-2.5 py-0.5 font-mono text-xs font-bold text-navy-800">
                    AICTE Permanent ID: {currentInst.aicteId}
                  </span>
                  <Badge v={currentInst.type} />
                  <Badge v={`Risk: ${currentInst.riskLevel || 'Low'}`} />
                  {hasBothRBandPGRC && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 border border-amber-300">
                      <GitMerge size={12} className="text-amber-700" />
                      <span>Dual-Bureau: RB + PGRC Active</span>
                    </span>
                  )}
                </div>

                <h2 className="text-2xl font-bold text-slate-900">{currentInst.name}</h2>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                  <span className="flex items-center gap-1.5 font-medium">
                    <MapPin size={14} className="text-slate-400" />
                    <span>
                      {currentInst.city}, {currentInst.state}
                    </span>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-slate-400" />
                    <span>Approved Since: {currentInst.approved}</span>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1.5">
                    <Mail size={14} className="text-slate-400" />
                    <a
                      href={`mailto:${currentInst.contactEmail || 'office@institute.ac.in'}`}
                      className="text-navy-700 hover:underline"
                    >
                      {currentInst.contactEmail || 'office@institute.ac.in'}
                    </a>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1.5">
                    <Phone size={14} className="text-slate-400" />
                    <span>{currentInst.contactPhone || '+91 11 2000 0000'}</span>
                  </span>
                </div>
              </div>

              {/* Total Complaint Count Callout */}
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border-2 border-navy-800 bg-navy-50/60 px-5 py-3 text-center min-w-[120px] shadow-sm">
                  <div className="text-3xl font-extrabold text-navy-900 font-mono">
                    {totalCases}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-navy-800 tracking-wider">
                    Total Complaints
                  </div>
                </div>
              </div>
            </div>

            {/* Bureau Breakdown Bar */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                  Jurisdiction Distribution:
                </span>
                {Object.keys(bureauCounts).length > 0 ? (
                  Object.entries(bureauCounts).map(([b, count]) => (
                    <div
                      key={b}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs"
                    >
                      <Badge v={b} />
                      <span className="font-bold text-slate-800">{count} docket(s)</span>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">No dockets registered for this campus.</span>
                )}
              </div>

              {hasBothRBandPGRC && onNavigateToOverlaps && (
                <button
                  onClick={onNavigateToOverlaps}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 hover:underline"
                >
                  <span>View Cross-Bureau Overlaps</span>
                  <ExternalLink size={12} />
                </button>
              )}
            </div>
          </Card>

          {/* 2. DUAL-BUREAU RB & PGRC HIGHLIGHT ALERT */}
          {hasBothRBandPGRC ? (
            <Card className="border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50/60 via-amber-50/20 to-white p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-amber-100 p-2 text-amber-800 mt-0.5 flex-shrink-0">
                  <ShieldAlert size={20} />
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-amber-900">
                      Dual-Bureau Cross-Exposure Flagged: Active Dockets in both RB and PGRC
                    </h3>
                    <span className="rounded bg-amber-200/80 px-2 py-0.5 text-[10px] font-extrabold uppercase text-amber-900">
                      High Regulatory Scrutiny
                    </span>
                  </div>
                  <p className="text-xs text-amber-900/90 leading-relaxed">
                    This institution has complaints actively registered under both the{' '}
                    <strong>Regulation Bureau (RB)</strong> ({rbCount} case{rbCount !== 1 ? 's' : ''})
                    and the <strong>Public Grievance Redressal Cell (PGRC)</strong> ({pgrcCount} case
                    {pgrcCount !== 1 ? 's' : ''}). Under AICTE oversight SOP, institutions facing
                    parallel regulatory scrutiny (e.g., fee structure violations or faculty cadre shortages)
                    and direct student grievances require inter-bureau corroboration to prevent conflicting notices.
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-3 pt-1 text-xs font-semibold text-amber-900">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-indigo-600" />
                      <span>RB Cases: {rbCount}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-teal-600" />
                      <span>PGRC Cases: {pgrcCount}</span>
                    </span>
                    <span className="text-slate-400">|</span>
                    <span className="text-[11px] font-normal text-amber-800">
                      Recommendation: Inspect correlation in the Overlap Detection Centre before issuing final orders.
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <div className="rounded-lg bg-slate-100/70 p-3 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-slate-500" />
                <span>
                  <strong>Single-Bureau / Independent Jurisdiction:</strong> Grievance dockets for this
                  campus are confined to {Object.keys(bureauCounts).join(', ') || 'current'} bureau(s).
                  No simultaneous Regulation Bureau (RB) and PGRC conflict detected.
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">PID: {currentInst.aicteId}</span>
            </div>
          )}

          {/* 3. SUMMARY CARDS: TOTAL CASES, PENDING, RESOLVED AND OVERDUE */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {/* Card 1: Total Cases */}
            <Card
              padding="p-4"
              className={`cursor-pointer transition-all border-l-4 border-l-navy-800 ${
                complaintStatusFilter === 'All' ? 'ring-2 ring-navy-300 shadow-sm' : 'hover:shadow-md'
              }`}
            >
              <div
                onClick={() => setComplaintStatusFilter('All')}
                className="flex items-start justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Total Cases
                  </div>
                  <div className="mt-1 text-2xl font-bold font-mono text-slate-900">{totalCases}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Across all AICTE bureaus</div>
                </div>
                <div className="rounded-xl bg-navy-50 p-2.5 text-navy-800">
                  <FileText size={20} />
                </div>
              </div>
            </Card>

            {/* Card 2: Pending */}
            <Card
              padding="p-4"
              className={`cursor-pointer transition-all border-l-4 border-l-amber-500 ${
                complaintStatusFilter === 'Pending' ? 'ring-2 ring-amber-300 shadow-sm' : 'hover:shadow-md'
              }`}
            >
              <div
                onClick={() => setComplaintStatusFilter('Pending')}
                className="flex items-start justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                    Pending
                  </div>
                  <div className="mt-1 text-2xl font-bold font-mono text-amber-700">{pendingCases}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Awaiting initial action</div>
                </div>
                <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700">
                  <Clock size={20} />
                </div>
              </div>
            </Card>

            {/* Card 3: Resolved */}
            <Card
              padding="p-4"
              className={`cursor-pointer transition-all border-l-4 border-l-emerald-600 ${
                complaintStatusFilter === 'Resolved' ? 'ring-2 ring-emerald-300 shadow-sm' : 'hover:shadow-md'
              }`}
            >
              <div
                onClick={() => setComplaintStatusFilter('Resolved')}
                className="flex items-start justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                    Resolved
                  </div>
                  <div className="mt-1 text-2xl font-bold font-mono text-emerald-700">
                    {resolvedCases}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Compliance concluded</div>
                </div>
                <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
                  <CheckCircle2 size={20} />
                </div>
              </div>
            </Card>

            {/* Card 4: Overdue */}
            <Card
              padding="p-4"
              className={`cursor-pointer transition-all border-l-4 border-l-rose-600 ${
                complaintStatusFilter === 'Overdue' ? 'ring-2 ring-rose-300 shadow-sm' : 'hover:shadow-md'
              }`}
            >
              <div
                onClick={() => setComplaintStatusFilter('Overdue')}
                className="flex items-start justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-rose-700 uppercase tracking-wider">
                    Overdue
                  </div>
                  <div className="mt-1 text-2xl font-bold font-mono text-rose-700">{overdueCases}</div>
                  <div className="text-[11px] text-rose-500 font-medium mt-0.5">Breached SLA deadline</div>
                </div>
                <div className="rounded-xl bg-rose-50 p-2.5 text-rose-700">
                  <AlertTriangle size={20} />
                </div>
              </div>
            </Card>
          </div>

          {/* TWO COLUMN SECTION: COMPLAINTS TABLE (LEFT) & COMPLAINT ACTIVITY TIMELINE (RIGHT) */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* 4. SHOW ALL COMPLAINTS LINKED TO THAT INSTITUTION ACROSS BUREAUS */}
            <div className="space-y-4 lg:col-span-2">
              <Card>
                <CardHeader
                  title={`All Complaints Linked to Permanent ID: ${currentInst.aicteId}`}
                  sub={`Showing ${filteredComplaints.length} of ${instComplaints.length} grievances filed across bureaus`}
                  action={
                    complaintStatusFilter !== 'All' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setComplaintStatusFilter('All')}
                        className="text-xs text-navy-800"
                      >
                        Clear Status Filter ({complaintStatusFilter})
                      </Button>
                    )
                  }
                />

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-slate-100">
                  <SearchBox
                    value={complaintSearch}
                    onChange={setComplaintSearch}
                    placeholder="Search complaint ID, keywords, officer..."
                    className="min-w-[180px]"
                  />

                  {/* Bureau Filter */}
                  <select
                    value={complaintBureauFilter}
                    onChange={(e) => setComplaintBureauFilter(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
                  >
                    <option value="All">All Bureaus ({instComplaints.length})</option>
                    {Object.keys(bureauCounts).map((b) => (
                      <option key={b} value={b}>
                        {b} Bureau ({bureauCounts[b]})
                      </option>
                    ))}
                  </select>

                  {/* Status Filter */}
                  <select
                    value={complaintStatusFilter}
                    onChange={(e) => setComplaintStatusFilter(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
                  >
                    <option value="All">All Statuses ({totalCases})</option>
                    <option value="Pending">Pending ({pendingCases})</option>
                    <option value="In Progress">In Progress ({inProgressCases})</option>
                    <option value="Resolved">Resolved ({resolvedCases})</option>
                    <option value="Overdue">Overdue ({overdueCases})</option>
                  </select>
                </div>

                {/* Complaints Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5">Case ID</th>
                        <th className="px-2 py-2.5">Bureau</th>
                        <th className="px-3 py-2.5">Category &amp; Title</th>
                        <th className="px-2 py-2.5">Priority</th>
                        <th className="px-2 py-2.5">Complainant</th>
                        <th className="px-2 py-2.5">Status</th>
                        <th className="px-3 py-2.5">Target Due</th>
                        <th className="px-3 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredComplaints.map((c) => {
                        const caseIsOverdue = isOverdue(c)
                        return (
                          <tr
                            key={c.id}
                            className="hover:bg-slate-50/80 transition cursor-pointer"
                            onClick={() => onOpen(c.id)}
                          >
                            <td className="px-3 py-3 font-mono font-bold text-navy-800">
                              {c.id}
                            </td>
                            <td className="px-2 py-3">
                              <Badge v={c.bureau} />
                            </td>
                            <td className="px-3 py-3 max-w-[220px]">
                              <div className="font-semibold text-slate-900 truncate">{c.title}</div>
                              <div className="text-[10px] text-slate-500">{c.category}</div>
                            </td>
                            <td className="px-2 py-3">
                              <Badge v={c.priority} dot />
                            </td>
                            <td className="px-2 py-3 text-slate-600">
                              {c.complainantType || 'Student'}
                            </td>
                            <td className="px-2 py-3">
                              <Badge v={c.status} dot />
                            </td>
                            <td className="px-3 py-3 font-mono text-[11px]">
                              <div>{c.due}</div>
                              {caseIsOverdue && (
                                <span className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5">
                                  <AlertTriangle size={10} /> Overdue
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onOpen(c.id)
                                }}
                                className="text-[11px]"
                              >
                                <span>Open Case</span>
                                <ExternalLink size={11} />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}

                      {filteredComplaints.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                            No complaints matching current filters for this institution.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* 5. TIMELINE OF COMPLAINT ACTIVITY */}
            <div className="space-y-4 lg:col-span-1">
              <Card className="h-full flex flex-col">
                <CardHeader
                  title="Complaint Activity Timeline"
                  sub={`Chronological ledger of ${timelineEvents.length} events across all bureaus`}
                />

                {/* Timeline filter */}
                <div className="mb-3 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Filter by Bureau:</span>
                  <select
                    value={timelineBureauFilter}
                    onChange={(e) => setTimelineBureauFilter(e.target.value)}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                  >
                    <option value="All">All Bureaus</option>
                    {Object.keys(bureauCounts).map((b) => (
                      <option key={b} value={b}>
                        {b} ({bureauCounts[b]})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Timeline scroll container */}
                <div className="flex-1 overflow-y-auto max-h-[520px] pr-1 space-y-4 scrollbar-thin">
                  {timelineEvents
                    .filter(
                      (ev) => timelineBureauFilter === 'All' || ev.bureau === timelineBureauFilter
                    )
                    .map((ev, idx) => (
                      <div key={idx} className="relative pl-6 pb-2 group">
                        {/* Vertical line connecting events */}
                        {idx !== timelineEvents.length - 1 && (
                          <div className="absolute left-2.5 top-3 bottom-0 w-0.5 bg-slate-200" />
                        )}

                        {/* Event bullet point */}
                        <div
                          className={`absolute left-1 top-1 h-3.5 w-3.5 rounded-full border-2 border-white ${
                            ev.bureau === 'RB'
                              ? 'bg-indigo-600'
                              : ev.bureau === 'PGRC'
                              ? 'bg-teal-600'
                              : ev.bureau === 'Approval'
                              ? 'bg-sky-500'
                              : 'bg-navy-600'
                          }`}
                        />

                        {/* Event content card */}
                        <div className="rounded-lg border border-slate-200/90 bg-slate-50/70 p-3 text-xs transition hover:bg-white hover:shadow-2xs">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-mono text-[10px] text-slate-400">{ev.date}</span>
                            <div className="flex items-center gap-1">
                              <Badge v={ev.bureau} />
                              <button
                                onClick={() => onOpen(ev.caseId)}
                                className="font-mono text-[10px] font-bold text-navy-800 hover:underline"
                              >
                                {ev.caseId}
                              </button>
                            </div>
                          </div>

                          <h4 className="font-bold text-slate-900 leading-snug">{ev.label}</h4>

                          {ev.note && (
                            <p className="mt-1 text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                              {ev.note}
                            </p>
                          )}

                          {ev.by && (
                            <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-200/50 pt-1 flex items-center justify-between">
                              <span className="truncate">Actor: {ev.by}</span>
                              <span className="font-semibold text-navy-700">{ev.status}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                  {timelineEvents.length === 0 && (
                    <div className="py-12 text-center text-xs text-slate-400">
                      No activity recorded on dockets for this institution.
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
