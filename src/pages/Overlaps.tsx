import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building,
  Check,
  CheckCircle2,
  Clock,
  Columns,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  GitMerge,
  Info,
  Layers,
  PauseCircle,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Table as TableIcon,
  Tag,
  User,
  X,
  XCircle,
} from 'lucide-react'
import type { Complaint, Overlap, Role, UserProfile } from '../types'
import {
  TODAY,
  fmt,
  instName,
  overlaps as initialOverlaps,
  resolveOfficerName,
  getOverlapEffectiveState,
  isOverlapHistorical,
  isOverlapActivePending,
  type OverlapReviewState,
} from '../data'
import { Badge, Button, Card, CardHeader, Modal, PageTitle, SearchBox } from '../components/ui'

export const OVERLAP_STORAGE_KEYS = {
  STATES: 'abhigyan_overlap_states',
  NOTES: 'abhigyan_overlap_notes',
} as const

export type { OverlapReviewState }
export type OverlapStatusDisplay = OverlapReviewState | 'open'

export const DEFAULT_OVERLAP_STATES: Record<string, OverlapReviewState | undefined> = {
  o2: 'linked',
  o4: 'linked',
  o5: 'dismissed',
  o7: 'dismissed',
}

export {
  getOverlapEffectiveState,
  isOverlapHistorical,
  isOverlapActivePending,
}

interface OverlapsProps {
  complaints: Complaint[]
  onOpen: (id: string) => void
  currentRole?: Role
  currentUser?: UserProfile
  overlaps?: Overlap[]
  overlapStates?: Record<string, OverlapReviewState | undefined>
  similarityThreshold?: number
  onUpdateOverlapState?: (
    id: string,
    state: OverlapReviewState | null,
    note?: string
  ) => Promise<boolean> | void
}

export default function Overlaps({
  complaints,
  onOpen,
  currentRole = 'Admin',
  currentUser,
  overlaps: propOverlaps,
  overlapStates: propOverlapStates,
  similarityThreshold = 75,
  onUpdateOverlapState,
}: OverlapsProps) {
  const allOverlaps = propOverlaps || initialOverlaps
  const activeThreshold = similarityThreshold
  const [showBelowThreshold, setShowBelowThreshold] = useState<boolean>(false)

  // Local state initialized from localStorage
  const [internalStates, setInternalStates] = useState<Record<string, OverlapReviewState | undefined>>(() => {
    try {
      const stored = localStorage.getItem(OVERLAP_STORAGE_KEYS.STATES)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch {
      // fallback
    }
    return DEFAULT_OVERLAP_STATES
  })

  const overlapStates = propOverlapStates || internalStates

  const [overlapNotes, setOverlapNotes] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem(OVERLAP_STORAGE_KEYS.NOTES)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch {
      // fallback
    }
    return {
      o2: 'Confirmed by Bureau Admin on 2026-10-22: Shared faculty vacancy verified.',
      o4: 'Confirmed by Bureau Admin on 2026-10-23: Joint show-cause scheduled for unapproved degrees.',
      o5: 'Dismissed on 2026-10-24: Different topics (fee vs library norms).',
      o7: 'Dismissed on 2026-10-25: Unrelated departments (hostel ragging vs faculty roster).',
    }
  })

  // Filter States
  const [bureauFilter, setBureauFilter] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<'All' | 'open' | 'linked' | 'dismissed' | 'deferred'>('All')
  const [similarityFilter, setSimilarityFilter] = useState<'All' | 'high' | 'moderate' | 'low'>('All')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [displayLayout, setDisplayLayout] = useState<'cards' | 'table'>('cards')

  // Review Modal State (Side-by-Side comparison)
  const [reviewingOverlapId, setReviewingOverlapId] = useState<string | null>(null)
  const [reviewerModalNote, setReviewerModalNote] = useState<string>('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(OVERLAP_STORAGE_KEYS.STATES, JSON.stringify(overlapStates))
    } catch {
      // ignore
    }
  }, [overlapStates])

  useEffect(() => {
    try {
      localStorage.setItem(OVERLAP_STORAGE_KEYS.NOTES, JSON.stringify(overlapNotes))
    } catch {
      // ignore
    }
  }, [overlapNotes])

  const getComplaint = (id: string) => complaints.find((c) => c.id === id)

  // Actions: Confirm Related, Dismiss Match, Defer, Reset
  const handleConfirm = async (id: string, note?: string) => {
    setSavingId(id)
    setActionError(null)
    const finalNote = note?.trim() || `Confirmed by ${currentUser?.name || 'Officer'} on ${TODAY}`
    let success = true
    if (onUpdateOverlapState) {
      const res = await onUpdateOverlapState(id, 'linked', finalNote)
      if (res === false) {
        success = false
        setActionError('Failed to confirm overlap on server. Verify your Bureau Admin or System Admin permissions.')
      }
    } else {
      setInternalStates((prev) => ({ ...prev, [id]: 'linked' }))
    }
    setSavingId(null)
    if (success) {
      setOverlapNotes((prev) => ({ ...prev, [id]: finalNote }))
      setReviewingOverlapId(null)
    }
  }

  const handleDismiss = async (id: string, note?: string) => {
    setSavingId(id)
    setActionError(null)
    const finalNote = note?.trim() || `Dismissed as independent by ${currentUser?.name || 'Officer'} on ${TODAY}`
    let success = true
    if (onUpdateOverlapState) {
      const res = await onUpdateOverlapState(id, 'dismissed', finalNote)
      if (res === false) {
        success = false
        setActionError('Failed to dismiss overlap on server.')
      }
    } else {
      setInternalStates((prev) => ({ ...prev, [id]: 'dismissed' }))
    }
    setSavingId(null)
    if (success) {
      setOverlapNotes((prev) => ({ ...prev, [id]: finalNote }))
      setReviewingOverlapId(null)
    }
  }

  const handleDefer = async (id: string, note?: string) => {
    setSavingId(id)
    setActionError(null)
    const finalNote = note?.trim() || `Deferred for inquiry evidence by ${currentUser?.name || 'Officer'} on ${TODAY}`
    let success = true
    if (onUpdateOverlapState) {
      const res = await onUpdateOverlapState(id, 'deferred', finalNote)
      if (res === false) {
        success = false
        setActionError('Failed to defer overlap on server.')
      }
    } else {
      setInternalStates((prev) => ({ ...prev, [id]: 'deferred' }))
    }
    setSavingId(null)
    if (success) {
      setOverlapNotes((prev) => ({ ...prev, [id]: finalNote }))
      setReviewingOverlapId(null)
    }
  }

  const handleReset = async (id: string) => {
    setSavingId(id)
    setActionError(null)
    let success = true
    if (onUpdateOverlapState) {
      const res = await onUpdateOverlapState(id, null)
      if (res === false) {
        success = false
        setActionError('Failed to reset overlap on server.')
      }
    } else {
      setInternalStates((prev) => {
        const copy = { ...prev }
        delete copy[id]
        return copy
      })
    }
    setSavingId(null)
    if (success) {
      setOverlapNotes((prev) => {
        const copy = { ...prev }
        delete copy[id]
        return copy
      })
      setReviewingOverlapId(null)
    }
  }

  const handleOpenReviewModal = (id: string) => {
    setActionError(null)
    setReviewingOverlapId(id)
    setReviewerModalNote(overlapNotes[id] || '')
  }

  const isAuthorizedRole = currentRole === 'Admin'

  // Active Review Modal Target
  const activeReviewOverlap = allOverlaps.find((o) => o.id === reviewingOverlapId)
  const activeCaseA = activeReviewOverlap ? getComplaint(activeReviewOverlap.a) : null
  const activeCaseB = activeReviewOverlap ? getComplaint(activeReviewOverlap.b) : null

  // Filtered List calculation
  const filteredOverlaps = useMemo(() => {
    return allOverlaps.filter((overlap) => {
      const compA = getComplaint(overlap.a)
      const compB = getComplaint(overlap.b)
      if (!compA || !compB) return false

      // Status filter
      const currentState = getOverlapEffectiveState(overlap, overlapStates)
      if (statusFilter !== 'All') {
        if (statusFilter === 'open' && currentState !== 'open') return false
        if (statusFilter !== 'open' && currentState !== statusFilter) return false
      }

      // Threshold gating for unreviewed candidates:
      // Open candidates below activeThreshold are suppressed unless showBelowThreshold is true.
      // Historical decisions (linked, dismissed, deferred) are ALWAYS preserved regardless of threshold.
      if (currentState === 'open' && overlap.similarity < activeThreshold && !showBelowThreshold) {
        return false
      }

      // Bureau filter (Case A or Case B matches)
      if (bureauFilter !== 'All') {
        if (compA.bureau !== bureauFilter && compB.bureau !== bureauFilter) {
          return false
        }
      }

      // Similarity Level filter
      if (similarityFilter === 'high' && overlap.similarity < 85) return false
      if (
        similarityFilter === 'moderate' &&
        (overlap.similarity < 65 || overlap.similarity >= 85)
      ) {
        return false
      }
      if (similarityFilter === 'low' && overlap.similarity >= 65) return false

      // Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchA = `${compA.id} ${compA.title} ${compA.description} ${compA.bureau}`.toLowerCase()
        const matchB = `${compB.id} ${compB.title} ${compB.description} ${compB.bureau}`.toLowerCase()
        const matchInst = instName(compA.institutionId).toLowerCase()
        const matchReasons = overlap.reasons.join(' ').toLowerCase()
        const matchId = overlap.id.toLowerCase()

        if (
          !matchA.includes(q) &&
          !matchB.includes(q) &&
          !matchInst.includes(q) &&
          !matchReasons.includes(q) &&
          !matchId.includes(q)
        ) {
          return false
        }
      }

      return true
    })
  }, [allOverlaps, complaints, overlapStates, statusFilter, bureauFilter, similarityFilter, searchQuery, activeThreshold, showBelowThreshold])

  // Overview Counts (Threshold-aware, distinguishing active review queue from historical decisions)
  const pendingCount = allOverlaps.filter((o) => isOverlapActivePending(o, overlapStates, activeThreshold)).length
  const confirmedCount = allOverlaps.filter((o) => getOverlapEffectiveState(o, overlapStates) === 'linked').length
  const dismissedCount = allOverlaps.filter((o) => getOverlapEffectiveState(o, overlapStates) === 'dismissed').length
  const deferredCount = allOverlaps.filter((o) => getOverlapEffectiveState(o, overlapStates) === 'deferred').length
  const belowThresholdCount = allOverlaps.filter((o) => getOverlapEffectiveState(o, overlapStates) === 'open' && o.similarity < activeThreshold).length
  const totalCount = showBelowThreshold
    ? allOverlaps.length
    : pendingCount + confirmedCount + dismissedCount + deferredCount

  return (
    <div className="space-y-6">
      {/* Page Title & Methodology Note */}
      <PageTitle
        title="Cross-Bureau Overlaps"
        sub="Detect and review parallel grievances filed across AICTE bureaus"
        tag="Overlap Engine"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-navy-50 px-3 py-1.5 text-xs font-semibold text-navy-800 border border-navy-200">
              Active Threshold: {activeThreshold}%
            </span>
            {belowThresholdCount > 0 && (
              <button
                type="button"
                onClick={() => setShowBelowThreshold((v) => !v)}
                className="rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 transition"
              >
                {showBelowThreshold ? 'Hide' : 'Show'} Suppressed ({belowThresholdCount} &lt;{activeThreshold}%)
              </button>
            )}
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200">
              Heuristic Matching
            </span>
          </div>
        }
      />

      {/* Action Error Banner */}
      {actionError && (
        <Card className="border-l-4 border-l-rose-600 bg-rose-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-900 text-xs font-medium">
              <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-xs text-rose-700 hover:text-rose-900 font-bold"
            >
              Dismiss
            </button>
          </div>
        </Card>
      )}

      {/* 1. CLEAR STATUTORY SAFEGUARD WARNING (CRITICAL REQUIREMENT) */}
      <Card className="border-l-4 border-l-rose-600 bg-gradient-to-r from-rose-50/70 via-rose-50/20 to-white p-4.5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-rose-100 p-2 text-rose-700 mt-0.5 flex-shrink-0">
            <ShieldAlert size={22} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-rose-950 flex items-center gap-1.5">
                <span>Statutory Safeguard Warning: Duplicate Determination Policy</span>
              </h3>
              <span className="rounded-full bg-rose-200/80 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-rose-900">
                Mandatory Review Protocol
              </span>
            </div>
            <p className="text-xs text-rose-900 leading-relaxed max-w-5xl">
              <strong>The same institution alone does not prove two complaints are duplicates.</strong>{' '}
              Technical campuses host thousands of students, faculty, and departments; institutions frequently face
              distinct, simultaneous, legitimate complaints from different stakeholders (for instance, a student fee grievance
              vs an infrastructure library norm violation, or a hostel ragging incident vs a faculty roster vacancy).
              Officers must independently review allegations, facts, and dates before marking complaints as related.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-4 pt-1 text-[11px] font-semibold text-rose-800">
              <span className="flex items-center gap-1">
                <CheckCircle2 size={13} className="text-rose-700" />
                <span>Zero Automation Rule: Cases are NEVER automatically merged or deleted.</span>
              </span>
              <span className="flex items-center gap-1">
                <GitMerge size={13} className="text-rose-700" />
                <span>Confirming relatedness creates an inter-bureau coordination link for evidence sharing.</span>
              </span>
              <span className="flex items-center gap-1">
                <FileText size={13} className="text-rose-700" />
                <span>Both cases remain fully independent, legally distinct active dockets.</span>
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card
          padding="p-3.5"
          className={`cursor-pointer transition border-l-4 border-l-navy-800 ${
            statusFilter === 'All' ? 'ring-2 ring-navy-300' : 'hover:shadow-md'
          }`}
        >
          <div onClick={() => setStatusFilter('All')} className="space-y-0.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Total Overlaps</div>
            <div className="text-2xl font-bold font-mono text-slate-900">{totalCount}</div>
            <div className="text-[10px] text-slate-400">Detected Pairs</div>
          </div>
        </Card>

        <Card
          padding="p-3.5"
          className={`cursor-pointer transition border-l-4 border-l-amber-500 ${
            statusFilter === 'open' ? 'ring-2 ring-amber-300' : 'hover:shadow-md'
          }`}
        >
          <div onClick={() => setStatusFilter('open')} className="space-y-0.5">
            <div className="text-[11px] font-bold text-amber-700 uppercase">Pending Review</div>
            <div className="text-2xl font-bold font-mono text-amber-700">{pendingCount}</div>
            <div className="text-[10px] text-slate-400">Awaiting Action</div>
          </div>
        </Card>

        <Card
          padding="p-3.5"
          className={`cursor-pointer transition border-l-4 border-l-emerald-600 ${
            statusFilter === 'linked' ? 'ring-2 ring-emerald-300' : 'hover:shadow-md'
          }`}
        >
          <div onClick={() => setStatusFilter('linked')} className="space-y-0.5">
            <div className="text-[11px] font-bold text-emerald-700 uppercase">Confirmed Related</div>
            <div className="text-2xl font-bold font-mono text-emerald-700">{confirmedCount}</div>
            <div className="text-[10px] text-slate-400">Coordinated Dockets</div>
          </div>
        </Card>

        <Card
          padding="p-3.5"
          className={`cursor-pointer transition border-l-4 border-l-slate-400 ${
            statusFilter === 'dismissed' ? 'ring-2 ring-slate-300' : 'hover:shadow-md'
          }`}
        >
          <div onClick={() => setStatusFilter('dismissed')} className="space-y-0.5">
            <div className="text-[11px] font-bold text-slate-600 uppercase">Dismissed Match</div>
            <div className="text-2xl font-bold font-mono text-slate-600">{dismissedCount}</div>
            <div className="text-[10px] text-slate-400">Independent Cases</div>
          </div>
        </Card>

        <Card
          padding="p-3.5"
          className={`cursor-pointer transition border-l-4 border-l-amber-400 ${
            statusFilter === 'deferred' ? 'ring-2 ring-amber-300' : 'hover:shadow-md'
          }`}
        >
          <div onClick={() => setStatusFilter('deferred')} className="space-y-0.5">
            <div className="text-[11px] font-bold text-amber-800 uppercase">Deferred</div>
            <div className="text-2xl font-bold font-mono text-amber-800">{deferredCount}</div>
            <div className="text-[10px] text-slate-400">Awaiting Inquiry</div>
          </div>
        </Card>
      </div>

      {/* 3. FILTERS BAR: BUREAU, REVIEW STATUS, SIMILARITY LEVEL & SEARCH */}
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
              <Filter size={13} />
              <span>Filters:</span>
            </span>

            {/* Bureau Filter */}
            <select
              value={bureauFilter}
              onChange={(e) => setBureauFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-200"
            >
              <option value="All">All Bureaus (RB, PGRC, Approval, Academic)</option>
              <option value="RB">Regulation Bureau (RB)</option>
              <option value="PGRC">Public Grievance Cell (PGRC)</option>
              <option value="Approval">Approval Bureau</option>
              <option value="Academic">Academic Bureau</option>
            </select>

            {/* Review Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-200"
            >
              <option value="All">All Review Statuses ({totalCount})</option>
              <option value="open">Pending Review ({pendingCount})</option>
              <option value="linked">Confirmed Related ({confirmedCount})</option>
              <option value="dismissed">Dismissed Match ({dismissedCount})</option>
              <option value="deferred">Deferred for Evidence ({deferredCount})</option>
            </select>

            {/* Similarity Level Filter */}
            <select
              value={similarityFilter}
              onChange={(e) => setSimilarityFilter(e.target.value as any)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-200"
            >
              <option value="All">All Similarity Levels</option>
              <option value="high">High Match (≥ 85%)</option>
              <option value="moderate">Moderate Match (65% – 84%)</option>
              <option value="low">Low Match (&lt; 65%)</option>
            </select>
          </div>

          {/* Layout Toggle */}
          <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
            <button
              onClick={() => setDisplayLayout('cards')}
              className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 ${
                displayLayout === 'cards'
                  ? 'bg-white shadow-2xs text-navy-800 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Card View"
            >
              <Layers size={13} />
              <span>Cards</span>
            </button>
            <button
              onClick={() => setDisplayLayout('table')}
              className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 ${
                displayLayout === 'table'
                  ? 'bg-white shadow-2xs text-navy-800 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Table View"
            >
              <TableIcon size={13} />
              <span>Table</span>
            </button>
          </div>
        </div>

        {/* Search input and active filter badges */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <SearchBox
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by Case A, Case B, Institution, Keywords, or Match Reasons..."
            className="w-full sm:max-w-md"
          />

          {(bureauFilter !== 'All' || statusFilter !== 'All' || similarityFilter !== 'All' || searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBureauFilter('All')
                setStatusFilter('All')
                setSimilarityFilter('All')
                setSearchQuery('')
              }}
              className="text-xs text-rose-700 hover:bg-rose-50"
            >
              <span>Reset All Filters</span>
              <X size={12} />
            </Button>
          )}

          <div className="ml-auto text-xs text-slate-500 font-medium">
            Showing <strong>{filteredOverlaps.length}</strong> of {initialOverlaps.length} overlap pairs
          </div>
        </div>
      </Card>

      {/* 4. OVERLAPS DISPLAY: CARDS VIEW */}
      {displayLayout === 'cards' && (
        <div className="space-y-5">
          {filteredOverlaps.map((overlap) => {
            const compA = getComplaint(overlap.a)
            const compB = getComplaint(overlap.b)
            if (!compA || !compB) return null

            const isHigh = overlap.similarity >= 85
            const isModerate = overlap.similarity >= 65 && overlap.similarity < 85
            const state: OverlapStatusDisplay = getOverlapEffectiveState(overlap, overlapStates)
            const note = overlapNotes[overlap.id]

            return (
              <Card
                key={overlap.id}
                className={`border-t-4 transition hover:shadow-md ${
                  state === 'linked'
                    ? 'border-t-emerald-600 bg-emerald-50/15'
                    : state === 'dismissed'
                    ? 'border-t-slate-400 opacity-90'
                    : isHigh
                    ? 'border-t-rose-600'
                    : isModerate
                    ? 'border-t-amber-500'
                    : 'border-t-slate-400'
                }`}
              >
                {/* Header Row: Pair Identification, Similarity Score, Status Badge */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold mt-0.5 ${
                        state === 'linked'
                          ? 'bg-emerald-100 text-emerald-800'
                          : state === 'dismissed'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-navy-50 text-navy-800'
                      }`}
                    >
                      <GitMerge size={18} />
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          {instName(compA.institutionId)}
                        </h3>
                        <span className="font-mono text-[11px] text-slate-500">
                          (PID: {compA.institutionPermanentId || '1-4821039'})
                        </span>
                      </div>

                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">Cluster #{overlap.id.toUpperCase()}</span>
                        <span>•</span>
                        <span>
                          Comparing <strong>{compA.bureau}</strong> ({compA.id}) ↔ <strong>{compB.bureau}</strong> ({compB.id})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Status Badge */}
                    <div>
                      {state === 'open' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-300">
                          <Clock size={12} />
                          <span>Pending Review</span>
                        </span>
                      )}
                      {state === 'linked' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-300">
                          <CheckCircle2 size={12} />
                          <span>Confirmed Related</span>
                        </span>
                      )}
                      {state === 'dismissed' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 border border-slate-300">
                          <XCircle size={12} />
                          <span>Dismissed Match</span>
                        </span>
                      )}
                      {state === 'deferred' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
                          <PauseCircle size={12} />
                          <span>Deferred</span>
                        </span>
                      )}
                    </div>

                    {/* Precomputed Similarity Gauge */}
                    <div className="text-right pl-3 border-l border-slate-200">
                      <div
                        className={`text-xl font-extrabold font-mono ${
                          isHigh
                            ? 'text-rose-600'
                            : isModerate
                            ? 'text-amber-600'
                            : 'text-slate-600'
                        }`}
                      >
                        {overlap.similarity}%
                      </div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">
                        Match Score
                      </div>
                      {overlap.similarity < activeThreshold && state === 'open' && (
                        <div className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded mt-0.5 border border-amber-200">
                          Below Threshold (&lt;{activeThreshold}%)
                        </div>
                      )}
                      {overlap.similarity < activeThreshold && state !== 'open' && (
                        <div className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1 py-0.5 rounded mt-0.5 border border-slate-200">
                          Historical Decision
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Note Banner if already processed */}
                {state !== 'open' && (
                  <div
                    className={`mt-3 rounded-lg p-2.5 text-xs flex items-center justify-between border ${
                      state === 'linked'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : state === 'dismissed'
                        ? 'bg-slate-100 border-slate-200 text-slate-700'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {state === 'linked' && <CheckCircle2 size={14} className="text-emerald-700 flex-shrink-0" />}
                      {state === 'dismissed' && <XCircle size={14} className="text-slate-500 flex-shrink-0" />}
                      {state === 'deferred' && <Clock size={14} className="text-amber-700 flex-shrink-0" />}
                      <span>
                        <strong>Review Determination:</strong> {note || 'Decision recorded in docket ledger.'}
                      </span>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReset(overlap.id)}
                      className="text-[11px] text-slate-600 hover:text-slate-900 h-6 px-2"
                    >
                      <RefreshCw size={11} />
                      <span>Reopen</span>
                    </Button>
                  </div>
                )}

                {/* Side-by-side Complaint Preview Cards */}
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {/* Case A Card */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 hover:border-slate-300 transition shadow-2xs">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-navy-800">{compA.id}</span>
                        <Badge v={compA.bureau} />
                      </div>
                      <Badge v={compA.priority} dot />
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{compA.title}</h4>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {compA.description}
                    </p>

                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                      <span>Filed: {fmt(compA.date)}</span>
                      <span>By: {compA.complainantType || 'Complainant'}</span>
                      <button
                        onClick={() => onOpen(compA.id)}
                        className="text-navy-700 font-semibold flex items-center gap-1 hover:underline"
                      >
                        <span>Open Docket</span>
                        <ExternalLink size={10} />
                      </button>
                    </div>
                  </div>

                  {/* Case B Card */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 hover:border-slate-300 transition shadow-2xs">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-navy-800">{compB.id}</span>
                        <Badge v={compB.bureau} />
                      </div>
                      <Badge v={compB.priority} dot />
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{compB.title}</h4>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {compB.description}
                    </p>

                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                      <span>Filed: {fmt(compB.date)}</span>
                      <span>By: {compB.complainantType || 'Complainant'}</span>
                      <button
                        onClick={() => onOpen(compB.id)}
                        className="text-navy-700 font-semibold flex items-center gap-1 hover:underline"
                      >
                        <span>Open Docket</span>
                        <ExternalLink size={10} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Precomputed Matching Points & Reasons */}
                <div className="mt-3.5 rounded-lg bg-slate-50/80 p-3 border border-slate-200/80">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                    <Info size={13} className="text-navy-700" />
                    <span>Why these complaints were surfaced as potential overlap:</span>
                  </div>
                  <ul className="grid gap-1 sm:grid-cols-2 text-xs text-slate-700">
                    {overlap.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-teal-600 flex-shrink-0" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                  {overlap.notes && (
                    <div className="mt-2 text-[11px] text-slate-500 border-t border-slate-200/50 pt-1.5 italic">
                      Analyst Scrutiny Recommendation: {overlap.notes}
                    </div>
                  )}
                </div>

                {/* 5. MANDATORY ACTIONS: REVIEW, CONFIRM RELATED, DISMISS MATCH, OPEN CASE */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Action 1: Review Button (opens side-by-side comparison modal) */}
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenReviewModal(overlap.id)}
                      className="text-xs bg-navy-800"
                    >
                      <Columns size={13} />
                      <span>Review Comparison</span>
                    </Button>

                    {/* Action 2: Confirm Related */}
                    <Button
                      variant="teal"
                      size="sm"
                      onClick={() => handleConfirm(overlap.id)}
                      disabled={state === 'linked' || savingId === overlap.id || !isAuthorizedRole}
                      className="text-xs"
                    >
                      <Check size={13} />
                      <span>{savingId === overlap.id ? 'Saving...' : 'Confirm Related'}</span>
                    </Button>

                    {/* Action 3: Dismiss Match */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDismiss(overlap.id)}
                      disabled={state === 'dismissed' || savingId === overlap.id || !isAuthorizedRole}
                      className="text-xs text-slate-700"
                    >
                      <X size={13} />
                      <span>Dismiss Match</span>
                    </Button>

                    {/* Action Defer */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDefer(overlap.id)}
                      disabled={state === 'deferred' || savingId === overlap.id || !isAuthorizedRole}
                      className="text-xs text-amber-800 hover:bg-amber-50"
                    >
                      <PauseCircle size={13} />
                      <span>Defer</span>
                    </Button>
                  </div>

                  {/* Action 4: Open Case directly */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400">Open Case:</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpen(compA.id)}
                      className="text-[11px] h-7 px-2"
                    >
                      <span>{compA.id}</span>
                      <ExternalLink size={10} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpen(compB.id)}
                      className="text-[11px] h-7 px-2"
                    >
                      <span>{compB.id}</span>
                      <ExternalLink size={10} />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}

          {filteredOverlaps.length === 0 && (
            <Card className="py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <CheckCircle2 size={24} className="text-emerald-500" />
              </div>
              <h4 className="mt-3 text-sm font-semibold text-slate-800">
                No Overlaps match current criteria
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                Adjust your bureau, review status, or similarity filters to inspect other candidate pairs.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* 4. OVERLAPS DISPLAY: TABLE VIEW */}
      {displayLayout === 'table' && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Cluster</th>
                <th className="px-4 py-3">Institution &amp; Code</th>
                <th className="px-3 py-3">Case A (Bureau)</th>
                <th className="px-3 py-3">Case B (Bureau)</th>
                <th className="px-3 py-3">Similarity</th>
                <th className="px-4 py-3">Overlap Corroboration Summary</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOverlaps.map((overlap) => {
                const compA = getComplaint(overlap.a)
                const compB = getComplaint(overlap.b)
                if (!compA || !compB) return null

                const state: OverlapStatusDisplay = getOverlapEffectiveState(overlap, overlapStates)
                const isHigh = overlap.similarity >= 85

                return (
                  <tr key={overlap.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3 font-mono font-bold text-navy-800">
                      #{overlap.id.toUpperCase()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{instName(compA.institutionId)}</div>
                      <div className="text-[10px] font-mono text-slate-500">
                        PID: {compA.institutionPermanentId || '1-4821039'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onOpen(compA.id)}
                          className="font-mono font-bold text-navy-800 hover:underline"
                        >
                          {compA.id}
                        </button>
                        <Badge v={compA.bureau} />
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                        {compA.title}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onOpen(compB.id)}
                          className="font-mono font-bold text-navy-800 hover:underline"
                        >
                          {compB.id}
                        </button>
                        <Badge v={compB.bureau} />
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                        {compB.title}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`font-mono font-bold text-xs ${
                          isHigh ? 'text-rose-600' : 'text-amber-600'
                        }`}
                      >
                        {overlap.similarity}%
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[280px]">
                      <div className="text-[11px] text-slate-700 line-clamp-2">
                        {overlap.reasons[1] || overlap.reasons[0]}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {state === 'open' && (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          Pending
                        </span>
                      )}
                      {state === 'linked' && (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          Confirmed
                        </span>
                      )}
                      {state === 'dismissed' && (
                        <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          Dismissed
                        </span>
                      )}
                      {state === 'deferred' && (
                        <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          Deferred
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenReviewModal(overlap.id)}
                          className="text-[11px] h-7 px-2"
                        >
                          <Columns size={11} />
                          <span>Review</span>
                        </Button>
                        <Button
                          variant="teal"
                          size="sm"
                          onClick={() => handleConfirm(overlap.id)}
                          disabled={state === 'linked' || savingId === overlap.id || !isAuthorizedRole}
                          className="text-[11px] h-7 px-2"
                          title="Confirm Related"
                        >
                          <Check size={11} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDismiss(overlap.id)}
                          disabled={state === 'dismissed' || savingId === overlap.id || !isAuthorizedRole}
                          className="text-[11px] h-7 px-2 text-slate-600"
                          title="Dismiss Match"
                        >
                          <X size={11} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* 6. COMPARISON VIEW MODAL (SIDE-BY-SIDE COMPLAINT DESCRIPTIONS) */}
      <Modal
        open={Boolean(reviewingOverlapId && activeReviewOverlap && activeCaseA && activeCaseB)}
        onClose={() => setReviewingOverlapId(null)}
        title={`Cross-Bureau Overlap Scrutiny: #${activeReviewOverlap?.id.toUpperCase()}`}
        subtitle={`Corroboration Score: ${activeReviewOverlap?.similarity}% • Institution: ${
          activeCaseA ? instName(activeCaseA.institutionId) : ''
        } (PID: ${activeCaseA?.institutionPermanentId || '1-4821039'})`}
        maxWidth="max-w-5xl"
      >
        {activeReviewOverlap && activeCaseA && activeCaseB && (
          <div className="space-y-5">
            {/* Modal Warning on Duplicate vs Separate Grievance */}
            <div className="rounded-lg bg-amber-50 p-3 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <ShieldAlert size={16} className="text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Investigator Guidance:</strong> The same institution alone does not prove two complaints are duplicates.
                Examine specific allegations, dates, and complainant types before confirming correlation. Confirming will create a
                cross-bureau information sharing link; cases are never merged or deleted automatically.
              </div>
            </div>

            {/* SIDE-BY-SIDE COMPARISON OF COMPLAINT DESCRIPTIONS & METADATA */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* CASE A COLUMN */}
              <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/20 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-extrabold text-indigo-900">
                      Case A: {activeCaseA.id}
                    </span>
                    <Badge v={activeCaseA.bureau} />
                  </div>
                  <Badge v={activeCaseA.priority} dot />
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-white rounded-lg p-2.5 border border-indigo-100/80">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Bureau</span>
                    <strong className="text-slate-800">{activeCaseA.bureau} Bureau</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Category</span>
                    <strong className="text-slate-800">{activeCaseA.category}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Filed On</span>
                    <span className="font-mono text-slate-800">{fmt(activeCaseA.date)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Complainant Type</span>
                    <strong className="text-slate-800">{activeCaseA.complainantType || 'Student'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Assigned Officer</span>
                    <span className="text-slate-800">{resolveOfficerName(activeCaseA)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Status</span>
                    <Badge v={activeCaseA.status} />
                  </div>
                </div>

                {/* Complaint Title */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Grievance Heading
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 leading-snug">{activeCaseA.title}</h4>
                </div>

                {/* Full Complaint Description */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Full Complaint Narrative
                  </span>
                  <div className="rounded-lg bg-white p-3 border border-slate-200 text-xs text-slate-700 leading-relaxed max-h-48 overflow-y-auto">
                    {activeCaseA.description}
                  </div>
                </div>

                <div className="text-right pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReviewingOverlapId(null)
                      onOpen(activeCaseA.id)
                    }}
                    className="text-xs"
                  >
                    <span>Inspect Full Docket A</span>
                    <ExternalLink size={11} />
                  </Button>
                </div>
              </div>

              {/* CASE B COLUMN */}
              <div className="rounded-xl border-2 border-teal-200 bg-teal-50/20 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-teal-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-extrabold text-teal-900">
                      Case B: {activeCaseB.id}
                    </span>
                    <Badge v={activeCaseB.bureau} />
                  </div>
                  <Badge v={activeCaseB.priority} dot />
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-white rounded-lg p-2.5 border border-teal-100/80">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Bureau</span>
                    <strong className="text-slate-800">{activeCaseB.bureau} Bureau</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Category</span>
                    <strong className="text-slate-800">{activeCaseB.category}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Filed On</span>
                    <span className="font-mono text-slate-800">{fmt(activeCaseB.date)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Complainant Type</span>
                    <strong className="text-slate-800">{activeCaseB.complainantType || 'Student'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Assigned Officer</span>
                    <span className="text-slate-800">{resolveOfficerName(activeCaseB)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Status</span>
                    <Badge v={activeCaseB.status} />
                  </div>
                </div>

                {/* Complaint Title */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Grievance Heading
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 leading-snug">{activeCaseB.title}</h4>
                </div>

                {/* Full Complaint Description */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Full Complaint Narrative
                  </span>
                  <div className="rounded-lg bg-white p-3 border border-slate-200 text-xs text-slate-700 leading-relaxed max-h-48 overflow-y-auto">
                    {activeCaseB.description}
                  </div>
                </div>

                <div className="text-right pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReviewingOverlapId(null)
                      onOpen(activeCaseB.id)
                    }}
                    className="text-xs"
                  >
                    <span>Inspect Full Docket B</span>
                    <ExternalLink size={11} />
                  </Button>
                </div>
              </div>
            </div>

            {/* SYNTHETIC MATCH ANALYSIS SECTION */}
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                  <Sparkles size={14} className="text-teal-600" />
                  <span>Corroboration Match Points ({activeReviewOverlap.similarity}% Precomputed Index)</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">Rule-based Lexical Corroboration</span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 text-xs text-slate-700">
                {activeReviewOverlap.reasons.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white rounded-md p-2 border border-slate-200/80">
                    <span className="h-2 w-2 rounded-full bg-teal-500 flex-shrink-0" />
                    <span>{r}</span>
                  </div>
                ))}
              </div>

              {activeReviewOverlap.notes && (
                <div className="mt-2.5 text-xs text-slate-600 italic border-t border-slate-200 pt-2">
                  Scrutiny Committee Recommendation: {activeReviewOverlap.notes}
                </div>
              )}
            </div>

            {/* REVIEWER JUSTIFICATION NOTE */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Reviewer Determination Note / Justification:
              </label>
              <textarea
                value={reviewerModalNote}
                onChange={(e) => setReviewerModalNote(e.target.value)}
                placeholder="Enter regulatory reasoning, e.g. 'Both complaints relate to the 2026-27 fee circular. Recommending consolidated notice to the Governing Body.'"
                rows={2}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-200"
              />
            </div>

            {/* Error in modal if any */}
            {actionError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle size={14} className="text-rose-600 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* MODAL DECISION BUTTONS */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <div className="text-[11px] text-slate-500">
                Reviewer: <strong>{currentUser?.name || 'Authorized Officer'}</strong> ({currentRole})
                {!isAuthorizedRole && (
                  <span className="ml-2 text-rose-600 font-semibold">(Requires System Admin or Bureau Admin role)</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="teal"
                  size="md"
                  onClick={() => handleConfirm(activeReviewOverlap.id, reviewerModalNote)}
                  disabled={savingId === activeReviewOverlap.id || !isAuthorizedRole}
                  className="text-xs font-bold"
                >
                  <Check size={14} />
                  <span>{savingId === activeReviewOverlap.id ? 'Persisting...' : 'Confirm Related Match'}</span>
                </Button>

                <Button
                  variant="outline"
                  size="md"
                  onClick={() => handleDismiss(activeReviewOverlap.id, reviewerModalNote)}
                  disabled={savingId === activeReviewOverlap.id || !isAuthorizedRole}
                  className="text-xs text-slate-700"
                >
                  <X size={14} />
                  <span>{savingId === activeReviewOverlap.id ? 'Updating...' : 'Dismiss as Independent'}</span>
                </Button>

                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => handleDefer(activeReviewOverlap.id, reviewerModalNote)}
                  disabled={savingId === activeReviewOverlap.id || !isAuthorizedRole}
                  className="text-xs text-amber-800 hover:bg-amber-50"
                >
                  <PauseCircle size={14} />
                  <span>Mark as Deferred</span>
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setReviewingOverlapId(null)}
                  className="text-xs"
                >
                  <span>Close</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
