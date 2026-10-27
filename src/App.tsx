import { useEffect, useState, useMemo } from 'react'
import { Landmark, Loader2, ShieldAlert } from 'lucide-react'
import type { AppNotification, AppSettings, Bureau, CaseDocument, Complaint, Overlap, Page, Priority, ReassignmentRequest, Role, Status, UserProfile } from './types'
import {
  canAddCaseRemarks,
  canAssignCase,
  canReviewReassignmentRequest,
  canTransferBureau,
  canUpdateCaseStatus,
  canUploadCaseDocument,
  PERMITTED_STATUS_TRANSITIONS,
  canViewComplaint,
  isNotificationAuthorized,
  resolveOfficerName,
  getNotificationStorageKey,
  loadUserNotifications,
  getOfficersForBureau,
  CURRENT_OFFICER,
  TODAY,
  initialComplaints,
  initialNotifications,
  overlaps,
  userProfiles,
  getAppSettings,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
} from './data'
import {
  ApiError,
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  clearAuthToken,
  getAuthToken,
  onUnauthorized,
} from './api/client'
import {
  getCurrentUserApi,
  demoLoginApi,
  logoutAuth,
  type DemoLoginPayload,
} from './api/auth'
import {
  fetchComplaintsApi,
  updateComplaintStatusApi,
  assignComplaintApi,
  addComplaintTimelineNoteApi,
  createComplaintApi,
} from './api/complaints'
import {
  getOverlapsApi,
  updateOverlapDecisionApi,
} from './api/overlaps'
import {
  getSettingsApi,
  updateSettingsApi,
  resetSettingsApi,
} from './api/settings'
import { fetchUsersApi } from './api/users'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard'
import { ComplaintsPage, DetailsPage, SubmitComplaint } from './pages/Complaints'
import Institutions from './pages/Institutions'
import Overlaps, { DEFAULT_OVERLAP_STATES, OVERLAP_STORAGE_KEYS, isOverlapActivePending, type OverlapReviewState } from './pages/Overlaps'
import CaseTracking from './pages/CaseTracking'
import Reports from './pages/Reports'
import NotificationsPage from './pages/Notifications'
import UserManagement, { USER_STORAGE_KEY, getStoredUsers } from './pages/UserManagement'
import Settings from './pages/Settings'
import Login from './pages/Login'
import { Button, Card } from './components/ui'

// Permitted pages matrix per role - BureauAdmin and Admin cannot submit grievances
const ROLE_PERMITTED_PAGES: Record<Role, Page[]> = {
  Complainant: ['complaints', 'submit', 'details', 'tracking', 'notifications'],
  Officer: ['complaints', 'details', 'institutions', 'overlaps', 'tracking', 'notifications'],
  BureauAdmin: [
    'dashboard',
    'complaints',
    'details',
    'institutions',
    'overlaps',
    'tracking',
    'reports',
    'users',
    'notifications',
  ],
  Admin: [
    'dashboard',
    'complaints',
    'details',
    'institutions',
    'overlaps',
    'tracking',
    'reports',
    'notifications',
    'users',
    'settings',
  ],
}

export const getDefaultLandingPage = (role: Role): Page => {
  return role === 'Complainant' || role === 'Officer' ? 'complaints' : 'dashboard'
}


const STORAGE_KEYS = {
  IS_LOGGED_IN: 'abhigyan_is_logged_in',
  ROLE: 'abhigyan_role',
  PAGE: 'abhigyan_active_page',
  CASE_ID: 'abhigyan_selected_case_id',
  COMPLAINTS: 'abhigyan_complaints',
  USERS: USER_STORAGE_KEY,
  CURRENT_USER: AUTH_USER_KEY,
  TOKEN: AUTH_TOKEN_KEY,
} as const

export default function App() {
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(() => {
    return Boolean(getAuthToken())
  })

  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_USER)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed && typeof parsed === 'object' && parsed.id) return parsed
      }
    } catch {
      // fallback
    }
    return userProfiles[0]
  })

  const currentRole: Role =
    currentUser?.role && ['Complainant', 'Officer', 'BureauAdmin', 'Admin'].includes(currentUser.role)
      ? (currentUser.role as Role)
      : 'Admin'

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return Boolean(getAuthToken())
  })

  // Verify backend session on mount using GET /api/auth/me
  useEffect(() => {
    let isMounted = true

    async function verifySession() {
      const token = getAuthToken()
      if (!token) {
        if (isMounted) {
          setIsLoggedIn(false)
          setIsAuthLoading(false)
        }
        return
      }

      try {
        const user = await getCurrentUserApi()
        if (isMounted) {
          setCurrentUser(user)
          setIsLoggedIn(true)
        }
      } catch {
        clearAuthToken()
        if (isMounted) {
          setIsLoggedIn(false)
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false)
        }
      }
    }

    verifySession()

    const unsubscribe = onUnauthorized(() => {
      setIsLoggedIn(false)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  const [activePage, setActivePage] = useState<Page>(() => {
    try {
      const storedRole = localStorage.getItem(STORAGE_KEYS.ROLE) as Role | null
      const role: Role =
        storedRole && ['Complainant', 'Officer', 'BureauAdmin', 'Admin'].includes(storedRole)
          ? (storedRole as Role)
          : 'Admin'
      const storedPage = localStorage.getItem(STORAGE_KEYS.PAGE) as Page | null
      if (storedPage && ROLE_PERMITTED_PAGES[role].includes(storedPage)) {
        if (storedPage === 'details') {
          const storedCaseId = localStorage.getItem(STORAGE_KEYS.CASE_ID)
          if (!storedCaseId) {
            return getDefaultLandingPage(role)
          }
        }
        return storedPage
      }
      return getDefaultLandingPage(role)
    } catch {
      return 'dashboard'
    }
  })

  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.CASE_ID) || undefined
    } catch {
      return undefined
    }
  })

  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string>(() => {
    try {
      return localStorage.getItem('abhigyan_selected_institution_id') || 'i1'
    } catch {
      return 'i1'
    }
  })

  const handleSelectInstitution = (id: string) => {
    setSelectedInstitutionId(id)
    try {
      localStorage.setItem('abhigyan_selected_institution_id', id)
    } catch {
      // ignore
    }
  }

  const [complaints, setComplaints] = useState<Complaint[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.COMPLAINTS)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c: Complaint) => ({
            ...c,
            officer: resolveOfficerName(c, userProfiles),
          }))
        }
      }
    } catch {
      // fallback
    }
    return initialComplaints.map((c) => ({
      ...c,
      officer: resolveOfficerName(c, userProfiles),
    }))
  })

  const syncComplaints = async () => {
    const token = getAuthToken()
    if (!token) return
    try {
      const res = await fetchComplaintsApi({ pageSize: 100 })
      if (res && Array.isArray(res.items)) {
        setComplaints((prev) => {
          const serverItems = res.items
          const prevMap = new Map(prev.map((c) => [c.id, c]))

          const updated = serverItems.map((remote) => {
            const authoritativeOfficer = resolveOfficerName(remote, users)
            const local = prevMap.get(remote.id)
            return {
              ...(local || {}),
              ...remote,
              bureau: remote.bureau as Bureau,
              priority: remote.priority as Priority,
              status: remote.status as Status,
              officer: authoritativeOfficer,
              assignedUserId: remote.assignedUserId || local?.assignedUserId,
              timeline: remote.timeline?.length ? remote.timeline : (local?.timeline || []),
              assignments: local?.assignments?.length
                ? local.assignments
                : [
                    {
                      officer: authoritativeOfficer,
                      date: remote.date,
                      by: 'Central Allocation Engine',
                      byRole: 'Admin' as Role,
                      bureau: remote.bureau as Bureau,
                      type: 'initial' as const,
                    },
                  ],
              documents: local?.documents || [],
            }
          })
          return updated
        })
      }
    } catch {
      // Offline fallback: preserve local state
    }
  }

  const [overlapsList, setOverlapsList] = useState<Overlap[] | undefined>(undefined)

  const syncOverlaps = async () => {
    try {
      if (getAuthToken()) {
        const fetched = await getOverlapsApi()
        setOverlapsList(fetched)
        // Also synchronize overlapStates from authoritative backend states
        const newStates: Record<string, OverlapReviewState> = {}
        for (const o of fetched) {
          if (o.status && o.status !== 'open') {
            newStates[o.id] = o.status as OverlapReviewState
          }
        }
        setOverlapStates(newStates)
        try {
          localStorage.setItem(OVERLAP_STORAGE_KEYS.STATES, JSON.stringify(newStates))
        } catch {
          // ignore
        }
      }
    } catch {
      // Offline fallback: preserve local state
    }
  }

  const [appSettings, setAppSettings] = useState<AppSettings>(() => getAppSettings())

  const syncSettings = async () => {
    if (!getAuthToken()) return
    try {
      const remote = await getSettingsApi()
      if (remote) {
        setAppSettings(remote)
        try {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(remote))
        } catch {
          // ignore
        }
      }
    } catch {
      // Offline fallback: preserve local state
    }
  }

  const syncUsers = async () => {
    if (!getAuthToken()) return
    if (currentRole === 'Complainant') return
    try {
      const remote = await fetchUsersApi()
      if (Array.isArray(remote)) {
        setUsers(remote)
        try {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(remote))
        } catch {
          // ignore
        }
      }
    } catch {
      // Offline fallback: preserve local state
    }
  }

  // Fetch fresh authorized complaints, overlaps, settings & users from backend when session user changes
  useEffect(() => {
    if (isLoggedIn && getAuthToken()) {
      syncComplaints()
      syncOverlaps()
      syncSettings()
      if (currentRole !== 'Complainant') {
        syncUsers()
      }
    }
  }, [isLoggedIn, currentUser?.id])

  // Re-sync overlaps whenever navigating to overlaps tab
  useEffect(() => {
    if (activePage === 'overlaps' && getAuthToken()) {
      syncOverlaps()
    }
  }, [activePage])

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    return loadUserNotifications(currentUser?.id)
  })

  // Reload user-namespaced notifications whenever authenticated user changes
  useEffect(() => {
    if (currentUser?.id) {
      setNotifications(loadUserNotifications(currentUser.id))
    }
  }, [currentUser?.id])

  // Filter notifications prior to rendering to enforce strict role-based access bounds
  const visibleNotifications = useMemo(() => {
    return notifications.filter((n) => isNotificationAuthorized(currentUser, n, complaints))
  }, [notifications, currentUser, complaints])

  const [overlapStates, setOverlapStates] = useState<Record<string, OverlapReviewState>>(() => {
    try {
      const stored = localStorage.getItem(OVERLAP_STORAGE_KEYS.STATES)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed && typeof parsed === 'object') return parsed
      }
    } catch {
      // fallback
    }
    return DEFAULT_OVERLAP_STATES
  })

  const [users, setUsers] = useState<UserProfile[]>(() => getStoredUsers())

  const handleUpdateOverlapState = async (
    id: string,
    state: OverlapReviewState | null,
    note?: string
  ): Promise<boolean> => {
    if (getAuthToken()) {
      try {
        const backendState = state || 'open'
        await updateOverlapDecisionApi(id, {
          state: backendState,
          justification: note || 'Decision recorded',
        })
        await Promise.all([syncOverlaps(), syncComplaints()])
        return true
      } catch (err) {
        console.error('Failed to update overlap decision on server:', err)
        return false
      }
    }

    // Local fallback when no server token
    setOverlapStates((prev) => {
      const updated = { ...prev }
      if (state === null) {
        delete updated[id]
      } else {
        updated[id] = state
      }
      return updated
    })
    return true
  }

  // Synchronize state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.IS_LOGGED_IN, JSON.stringify(isLoggedIn))
    } catch {
      // ignore
    }
  }, [isLoggedIn])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ROLE, currentRole)
    } catch {
      // ignore
    }
  }, [currentRole])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PAGE, activePage)
    } catch {
      // ignore
    }
  }, [activePage])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.COMPLAINTS, JSON.stringify(complaints))
    } catch {
      // ignore
    }
  }, [complaints])

  useEffect(() => {
    try {
      if (selectedCaseId) {
        localStorage.setItem(STORAGE_KEYS.CASE_ID, selectedCaseId)
      } else {
        localStorage.removeItem(STORAGE_KEYS.CASE_ID)
      }
    } catch {
      // ignore
    }
  }, [selectedCaseId])

  useEffect(() => {
    if (currentUser?.id) {
      try {
        const key = getNotificationStorageKey(currentUser.id)
        localStorage.setItem(key, JSON.stringify(notifications))
      } catch {
        // ignore
      }
    }
  }, [notifications, currentUser?.id])

  useEffect(() => {
    try {
      localStorage.setItem(OVERLAP_STORAGE_KEYS.STATES, JSON.stringify(overlapStates))
    } catch {
      // ignore
    }
  }, [overlapStates])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users))
    } catch {
      // ignore
    }
  }, [users])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser))
    } catch {
      // ignore
    }
  }, [currentUser])

  // Role switching authenticated via backend demo-login
  const handleSelectRole = async (newRole: Role, userId?: string) => {
    try {
      const payload: DemoLoginPayload = userId ? { role: newRole, userId } : { role: newRole }
      const res = await demoLoginApi(payload)
      setCurrentUser(res.user)
      const targetRole = res.user.role as Role
      const permitted = ROLE_PERMITTED_PAGES[targetRole]
      if (permitted && !permitted.includes(activePage)) {
        setActivePage(getDefaultLandingPage(targetRole))
      }
      await Promise.all([
        syncComplaints(),
        syncOverlaps(),
        syncSettings(),
        ...(targetRole !== 'Complainant' ? [syncUsers()] : []),
      ])
    } catch {
      const deniedNotif: AppNotification = {
        id: `notif-auth-denied-${Date.now()}`,
        type: 'alert',
        title: 'Role Switch Denied',
        message: `Failed to authenticate backend session for role '${newRole}'. Permissions cannot be escalated without server verification.`,
        timestamp: `${TODAY} 11:30`,
        read: false,
      }
      setNotifications((prev) => [deniedNotif, ...prev])
    }
  }

  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user)
    setIsLoggedIn(true)
    const role = (['Complainant', 'Officer', 'BureauAdmin', 'Admin'].includes(user.role)
      ? user.role
      : 'Admin') as Role
    setActivePage(getDefaultLandingPage(role))
    syncComplaints()
    syncOverlaps()
    syncSettings()
    if (role !== 'Complainant') {
      syncUsers()
    }
  }

  const handleUpdateSettings = async (
    newSettings: Partial<AppSettings>
  ): Promise<boolean | AppSettings> => {
    if (getAuthToken()) {
      try {
        const updated = await updateSettingsApi(newSettings)
        setAppSettings(updated)
        try {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated))
        } catch {
          // ignore
        }
        await syncOverlaps()
        return updated
      } catch (err) {
        console.error('Failed to update system settings on server:', err)
        throw err
      }
    }
    const merged: AppSettings = { ...appSettings, ...newSettings }
    setAppSettings(merged)
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged))
    } catch {
      // ignore
    }
    return merged
  }

  const handleResetSettings = async (): Promise<boolean | AppSettings> => {
    if (getAuthToken()) {
      try {
        const reset = await resetSettingsApi()
        setAppSettings(reset)
        try {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(reset))
        } catch {
          // ignore
        }
        await syncOverlaps()
        return reset
      } catch (err) {
        console.error('Failed to reset system settings on server:', err)
        throw err
      }
    }
    setAppSettings(DEFAULT_SETTINGS)
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS))
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS
  }

  const handleSignOut = () => {
    logoutAuth()
    setIsLoggedIn(false)
    try {
      localStorage.setItem(STORAGE_KEYS.IS_LOGGED_IN, 'false')
    } catch {
      // ignore
    }
  }

  // Handlers
  const handleOpenCase = (id: string) => {
    const target = complaints.find((c) => c.id.toUpperCase() === id.toUpperCase())
    if (target) {
      const access = canViewComplaint(currentUser, target)
      if (!access.allowed) {
        const deniedNotif: AppNotification = {
          id: `notif-denied-${Date.now()}`,
          type: 'alert',
          title: 'Access Restricted',
          message: access.reason || `You are not authorized to access docket ${id}.`,
          timestamp: `${TODAY} 11:30`,
          caseId: id,
          read: false,
        }
        setNotifications((prev) => [deniedNotif, ...prev])
        return
      }
    }
    setSelectedCaseId(id)
    setActivePage('details')
  }

  const handleStatusChange = async (
    id: string,
    newStatus: Status,
    noteText?: string,
    overrideReason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const target = complaints.find((c) => c.id === id)
    if (!target) return { success: false, error: 'Complaint not found.' }

    const check = canUpdateCaseStatus(currentUser, target, newStatus, overrideReason)
    if (!check.allowed) {
      const blockedNotif: AppNotification = {
        id: `notif-denied-${Date.now()}`,
        type: 'alert',
        title: 'Status Update Denied (HTTP 403)',
        message: check.reason || 'You do not have permission to execute this status transition.',
        timestamp: `${TODAY} 11:30`,
        caseId: id,
        read: false,
      }
      setNotifications((prev) => [blockedNotif, ...prev])
      return { success: false, error: check.reason || 'You do not have permission to execute this status transition.' }
    }

    let apiComplaint: Complaint | null = null
    // Call FastAPI backend to verify & persist status mutation if token exists
    try {
      if (getAuthToken()) {
        apiComplaint = await updateComplaintStatusApi(id, {
          status: newStatus,
          remarks: noteText,
          note: noteText,
          overrideReason: overrideReason?.trim() || undefined,
        })
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Server rejected status update.'
      const statusSuffix = err instanceof ApiError ? ` (HTTP ${err.status})` : ''
      const deniedNotif: AppNotification = {
        id: `notif-denied-${Date.now()}`,
        type: 'alert',
        title: `Status Update Blocked by Server${statusSuffix}`,
        message: errorMsg,
        timestamp: `${TODAY} 11:30`,
        caseId: id,
        read: false,
      }
      setNotifications((prev) => [deniedNotif, ...prev])
      return { success: false, error: errorMsg }
    }

    const isTransitionPermitted = (PERMITTED_STATUS_TRANSITIONS[target.status] || []).includes(newStatus)
    const isAdminOverride = currentUser.role === 'Admin' && (!isTransitionPermitted || target.status === 'Resolved')

    const actionText = isAdminOverride
      ? `[Admin Override] Status set to ${newStatus} from ${target.status}`
      : newStatus === 'Resolved'
      ? 'Case investigation concluded & Marked Resolved'
      : `Status transitioned to ${newStatus}`

    const noteParts: string[] = []
    if (noteText && noteText.trim()) {
      noteParts.push(noteText.trim())
    }
    if (isAdminOverride && overrideReason && overrideReason.trim()) {
      noteParts.push(`Admin Override Reason: ${overrideReason.trim()}`)
    }
    const finalNote = noteParts.length > 0 ? noteParts.join(' | ') : undefined

    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            ...(apiComplaint || {}),
            status: apiComplaint?.status || newStatus,
            lastActionDate: TODAY,
            timeline: apiComplaint?.timeline?.length
              ? apiComplaint.timeline
              : [
                  ...c.timeline,
                  {
                    label: actionText,
                    date: `${TODAY} 11:30`,
                    by: `${currentUser.name} (${currentUser.designation || currentRole})`,
                    role: currentRole,
                    note: finalNote,
                  },
                ],
          }
        }
        return c
      })
    )

    await syncComplaints()

    // Push notification for status advance
    const notif: AppNotification = {
      id: `notif-${Date.now()}`,
      type: newStatus === 'Resolved' ? 'success' : newStatus === 'Escalated' ? 'alert' : 'info',
      title: isAdminOverride ? `Docket ${id} Override: ${newStatus}` : `Docket ${id} Updated: ${newStatus}`,
      message: isAdminOverride
        ? `Status set to ${newStatus} under Admin override by ${currentUser.name} (${currentRole}). Reason: ${overrideReason}`
        : `Status updated to ${newStatus} by ${currentUser.name} (${currentRole}).`,
      timestamp: `${TODAY} 11:30`,
      caseId: id,
      read: false,
    }
    setNotifications((prev) => [notif, ...prev])
    return { success: true }
  }

  const handleAssignOfficer = async (id: string, newOfficer: string, reason?: string) => {
    const target = complaints.find((c) => c.id === id)
    if (!target) return

    const check = canAssignCase(currentUser, target)
    if (!check.allowed) {
      const blockedNotif: AppNotification = {
        id: `notif-denied-${Date.now()}`,
        type: 'alert',
        title: 'Assignment Blocked (HTTP 403)',
        message: check.reason || 'You do not have authorization to reassign this case.',
        timestamp: `${TODAY} 11:30`,
        caseId: id,
        read: false,
      }
      setNotifications((prev) => [blockedNotif, ...prev])
      return
    }

    const targetUser = users.find((u) => u.name === newOfficer) || userProfiles.find((u) => u.name === newOfficer)
    const targetUserId = targetUser?.id

    const currentResolved = resolveOfficerName(target, users)
    if (currentResolved === newOfficer && target.assignedUserId && target.assignedUserId === targetUserId) {
      return
    }

    const assignmentReason =
      reason?.trim() ||
      `Administrative officer reassignment within ${target.bureau} Bureau.`

    let apiComplaint: Complaint | null = null
    // Call FastAPI backend to verify & persist assignment if token exists
    try {
      if (getAuthToken()) {
        apiComplaint = await assignComplaintApi(id, {
          officer: newOfficer,
          userId: targetUserId,
          reason: assignmentReason,
          preserveBureau: true,
        })
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Server rejected officer reassignment.'
      const statusSuffix = err instanceof ApiError ? ` (HTTP ${err.status})` : ''
      const deniedNotif: AppNotification = {
        id: `notif-denied-${Date.now()}`,
        type: 'alert',
        title: `Assignment Blocked by Server${statusSuffix}`,
        message: errorMsg,
        timestamp: `${TODAY} 11:30`,
        caseId: id,
        read: false,
      }
      setNotifications((prev) => [deniedNotif, ...prev])
      return
    }

    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const prevOfficer = resolveOfficerName(c, users)
          const targetOfficerName = resolveOfficerName(
            apiComplaint || { officer: newOfficer, assignedUserId: targetUserId },
            users
          ) || newOfficer
          const assignedId = apiComplaint?.assignedUserId || targetUserId || c.assignedUserId
          return {
            ...c,
            ...(apiComplaint || {}),
            officer: targetOfficerName,
            assignedUserId: assignedId,
            bureau: (apiComplaint?.bureau || c.bureau) as Bureau,
            assignments: [
              ...c.assignments,
              {
                officer: targetOfficerName,
                previousOfficer: prevOfficer,
                date: TODAY,
                by: `${currentUser.name} (${currentUser.designation})`,
                byRole: currentRole,
                reason: assignmentReason,
                bureau: (apiComplaint?.bureau || c.bureau) as Bureau,
                type: 'reassignment',
              },
            ],
            timeline: apiComplaint?.timeline?.length
              ? apiComplaint.timeline
              : [
                  ...c.timeline,
                  {
                    label: `Investigating officer reassigned from ${prevOfficer} to ${targetOfficerName}`,
                    date: `${TODAY} 11:30`,
                    by: `${currentUser.name} (${currentRole})`,
                    role: currentRole,
                    note: `Administrative Justification: ${assignmentReason}`,
                  },
                ],
          }
        }
        return c
      })
    )

    await syncComplaints()

    const notif: AppNotification = {
      id: `notif-${Date.now()}`,
      type: 'info',
      title: `Docket ${id} Reassigned`,
      message: `Docket ${id} assigned to ${newOfficer} by ${currentUser.name}. Reason: ${assignmentReason}`,
      timestamp: `${TODAY} 11:30`,
      caseId: id,
      read: false,
    }
    setNotifications((prev) => [notif, ...prev])
  }

  const handleCrossBureauTransfer = async (
    id: string,
    newBureau: Bureau,
    newOfficer: string,
    reason: string
  ) => {
    const target = complaints.find((c) => c.id === id)
    if (!target) return

    const check = canTransferBureau(currentUser, target)
    if (!check.allowed) {
      const blockedNotif: AppNotification = {
        id: `notif-denied-${Date.now()}`,
        type: 'alert',
        title: 'Cross-Bureau Transfer Denied (FastAPI 403 Simulation)',
        message: check.reason || 'You are not authorized to transfer this case.',
        timestamp: `${TODAY} 11:30`,
        caseId: id,
        read: false,
      }
      setNotifications((prev) => [blockedNotif, ...prev])
      return
    }

    const targetUser = users.find((u) => u.name === newOfficer) || userProfiles.find((u) => u.name === newOfficer)
    const targetUserId = targetUser?.id

    let apiComplaint: Complaint | null = null
    // Call FastAPI backend to verify & persist transfer if token exists
    try {
      if (getAuthToken()) {
        apiComplaint = await assignComplaintApi(id, {
          bureau: newBureau,
          officer: newOfficer,
          userId: targetUserId,
          reason,
        })
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Server rejected cross-bureau transfer.'
      const statusSuffix = err instanceof ApiError ? ` (HTTP ${err.status})` : ''
      const deniedNotif: AppNotification = {
        id: `notif-denied-${Date.now()}`,
        type: 'alert',
        title: `Cross-Bureau Transfer Blocked by Server${statusSuffix}`,
        message: errorMsg,
        timestamp: `${TODAY} 11:30`,
        caseId: id,
        read: false,
      }
      setNotifications((prev) => [deniedNotif, ...prev])
      return
    }

    const prevBureau = target.bureau
    const prevOfficer = resolveOfficerName(target, users)
    const targetOfficerName = resolveOfficerName(
      apiComplaint || { officer: newOfficer, assignedUserId: targetUserId },
      users
    ) || newOfficer
    const assignedId = apiComplaint?.assignedUserId || targetUserId || target.assignedUserId

    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            ...(apiComplaint || {}),
            bureau: (apiComplaint?.bureau || newBureau) as Bureau,
            officer: targetOfficerName,
            assignedUserId: assignedId,
            lastActionDate: TODAY,
            assignments: [
              ...c.assignments,
              {
                officer: targetOfficerName,
                previousOfficer: prevOfficer,
                date: TODAY,
                by: `${currentUser.name} (${currentUser.designation})`,
                byRole: currentRole,
                reason,
                bureau: (apiComplaint?.bureau || newBureau) as Bureau,
                previousBureau: prevBureau,
                type: 'transfer',
              },
            ],
            timeline: apiComplaint?.timeline?.length
              ? apiComplaint.timeline
              : [
                  ...c.timeline,
                  {
                    label: `Cross-Bureau Transfer: Jurisdiction transferred from ${prevBureau} to ${newBureau}`,
                    date: `${TODAY} 11:30`,
                    by: `${currentUser.name} (${currentRole})`,
                    role: currentRole,
                    note: `Statutory Transfer Reason: ${reason}. Designated officer: ${targetOfficerName}.`,
                  },
                ],
          }
        }
        return c
      })
    )

    await syncComplaints()

    const notif: AppNotification = {
      id: `notif-${Date.now()}`,
      type: 'warning',
      title: `Cross-Bureau Transfer: ${id}`,
      message: `Docket ${id} transferred from ${prevBureau} to ${newBureau} by ${currentUser.name}. Reason: ${reason}`,
      timestamp: `${TODAY} 11:30`,
      caseId: id,
      read: false,
    }
    setNotifications((prev) => [notif, ...prev])
  }

  const handleRequestReassignment = (
    id: string,
    request: Omit<ReassignmentRequest, 'id' | 'requestDate' | 'requestedBy' | 'requestedByRole' | 'status'>
  ) => {
    const target = complaints.find((c) => c.id === id)
    if (!target) return

    const newRequest: ReassignmentRequest = {
      id: `req-${Date.now()}`,
      requestedBy: currentUser.name,
      requestedByRole: currentRole,
      requestDate: `${TODAY} 11:30`,
      status: 'Pending',
      ...request,
    }

    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const reqTypeLabel =
            request.type === 'bureau'
              ? `Formal Cross-Bureau Transfer Request to ${request.proposedBureau} Bureau`
              : `Formal Officer Reassignment Request to ${request.proposedOfficer || 'another officer'}`

          return {
            ...c,
            reassignmentRequests: [...(c.reassignmentRequests || []), newRequest],
            timeline: [
              ...c.timeline,
              {
                label: `${reqTypeLabel} submitted`,
                date: `${TODAY} 11:30`,
                by: `${currentUser.name} (${currentRole})`,
                role: currentRole,
                note: `Reason: ${request.reason}`,
              },
            ],
          }
        }
        return c
      })
    )

    const notif: AppNotification = {
      id: `notif-${Date.now()}`,
      type: 'info',
      title: `Reassignment Request Submitted: ${id}`,
      message: `${currentUser.name} requested ${
        request.type === 'bureau' ? `cross-bureau transfer to ${request.proposedBureau}` : 'officer reassignment'
      } for docket ${id}.`,
      timestamp: `${TODAY} 11:30`,
      caseId: id,
      read: false,
    }
    setNotifications((prev) => [notif, ...prev])
  }

  const handleReviewReassignmentRequest = (
    id: string,
    requestId: string,
    decision: 'Approved' | 'Rejected',
    reviewNote?: string
  ) => {
    const target = complaints.find((c) => c.id === id)
    if (!target) return

    const check = canReviewReassignmentRequest(currentUser, target)
    if (!check.allowed) {
      const blockedNotif: AppNotification = {
        id: `notif-denied-${Date.now()}`,
        type: 'alert',
        title: 'Review Action Blocked (FastAPI 403 Simulation)',
        message: check.reason || 'You do not have administrative authority to review this request.',
        timestamp: `${TODAY} 11:30`,
        caseId: id,
        read: false,
      }
      setNotifications((prev) => [blockedNotif, ...prev])
      return
    }

    const req = target.reassignmentRequests?.find((r) => r.id === requestId)
    if (!req) return

    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const updatedRequests = (c.reassignmentRequests || []).map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status: decision,
                  reviewedBy: currentUser.name,
                  reviewedByRole: currentRole,
                  reviewDate: `${TODAY} 11:30`,
                  reviewNote:
                    reviewNote ||
                    (decision === 'Approved'
                      ? 'Approved upon statutory review'
                      : 'Rejected after administrative review'),
                }
              : r
          )

          let updatedBureau = c.bureau
          let updatedOfficer = resolveOfficerName(c, users)
          let updatedAssignedUserId = c.assignedUserId
          const updatedAssignments = [...c.assignments]
          const newTimelineEvents = [...c.timeline]

          if (decision === 'Approved') {
            if (req.type === 'bureau' && req.proposedBureau) {
              const prevBureau = c.bureau
              const prevOfficer = resolveOfficerName(c, users)
              updatedBureau = req.proposedBureau
              const rawProposed = req.proposedOfficer || getOfficersForBureau(req.proposedBureau)[0]
              const proposedUser = users.find((u) => u.name === rawProposed) || userProfiles.find((u) => u.name === rawProposed)
              updatedAssignedUserId = proposedUser?.id
              updatedOfficer = resolveOfficerName({ officer: rawProposed, assignedUserId: updatedAssignedUserId }, users) || rawProposed

              updatedAssignments.push({
                officer: updatedOfficer,
                previousOfficer: prevOfficer,
                date: TODAY,
                by: `${currentUser.name} (${currentUser.designation})`,
                byRole: currentRole,
                reason: `Approved transfer request from ${req.requestedBy}: ${req.reason}`,
                bureau: updatedBureau,
                previousBureau: prevBureau,
                type: 'transfer',
              })

              newTimelineEvents.push({
                label: `Cross-Bureau Transfer Approved: Transferred from ${prevBureau} to ${updatedBureau}`,
                date: `${TODAY} 11:30`,
                by: `${currentUser.name} (${currentRole})`,
                role: currentRole,
                note: `Approved Request #${req.id}. Designated officer: ${updatedOfficer}. Note: ${
                  reviewNote || 'Approved.'
                }`,
              })
            } else if (req.type === 'officer' && req.proposedOfficer) {
              const prevOfficer = resolveOfficerName(c, users)
              const rawProposed = req.proposedOfficer
              const proposedUser = users.find((u) => u.name === rawProposed) || userProfiles.find((u) => u.name === rawProposed)
              updatedAssignedUserId = proposedUser?.id
              updatedOfficer = resolveOfficerName({ officer: rawProposed, assignedUserId: updatedAssignedUserId }, users) || rawProposed

              updatedAssignments.push({
                officer: updatedOfficer,
                previousOfficer: prevOfficer,
                date: TODAY,
                by: `${currentUser.name} (${currentUser.designation})`,
                byRole: currentRole,
                reason: `Approved reassignment request from ${req.requestedBy}: ${req.reason}`,
                bureau: c.bureau,
                type: 'reassignment',
              })

              newTimelineEvents.push({
                label: `Officer Reassignment Approved: Reassigned from ${prevOfficer} to ${updatedOfficer}`,
                date: `${TODAY} 11:30`,
                by: `${currentUser.name} (${currentRole})`,
                role: currentRole,
                note: `Approved Request #${req.id}. Note: ${reviewNote || 'Approved.'}`,
              })
            }
          } else {
            newTimelineEvents.push({
              label: `Reassignment / Transfer Request Rejected by ${currentUser.name}`,
              date: `${TODAY} 11:30`,
              by: `${currentUser.name} (${currentRole})`,
              role: currentRole,
              note: `Reason for Rejection: ${
                reviewNote || 'Request not aligned with statutory jurisdiction.'
              }`,
            })
          }

          return {
            ...c,
            bureau: updatedBureau,
            officer: updatedOfficer,
            assignedUserId: updatedAssignedUserId,
            assignments: updatedAssignments,
            reassignmentRequests: updatedRequests,
            timeline: newTimelineEvents,
          }
        }
        return c
      })
    )

    const notif: AppNotification = {
      id: `notif-${Date.now()}`,
      type: decision === 'Approved' ? 'success' : 'warning',
      title: `Reassignment Request ${decision}: ${id}`,
      message: `Request for docket ${id} was ${decision.toLowerCase()} by ${currentUser.name}.`,
      timestamp: `${TODAY} 11:30`,
      caseId: id,
      read: false,
    }
    setNotifications((prev) => [notif, ...prev])
  }

  const handleAddTimelineNote = async (id: string, noteText: string) => {
    const target = complaints.find((c) => c.id === id)
    if (!target) return

    const check = canAddCaseRemarks(currentUser, target)
    if (!check.allowed) {
      const blockedNotif: AppNotification = {
        id: `notif-denied-${Date.now()}`,
        type: 'alert',
        title: 'Action Remark Denied (FastAPI 403 Simulation)',
        message: check.reason || 'You do not have permission to post remarks on this docket.',
        timestamp: `${TODAY} 11:30`,
        caseId: id,
        read: false,
      }
      setNotifications((prev) => [blockedNotif, ...prev])
      return
    }

    const noteLabel =
      currentRole === 'Complainant'
        ? 'Supplementary Statement / Complainant Update Logged'
        : 'Investigation Action & Inquiry Milestone Logged'

    // Call FastAPI backend to verify & persist timeline remark if token exists
    try {
      if (getAuthToken()) {
        await addComplaintTimelineNoteApi(id, { note: noteText, label: noteLabel })
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Server rejected remark.'
      const statusSuffix = err instanceof ApiError ? ` (HTTP ${err.status})` : ''
      const deniedNotif: AppNotification = {
        id: `notif-denied-${Date.now()}`,
        type: 'alert',
        title: `Remark Blocked by Server${statusSuffix}`,
        message: errorMsg,
        timestamp: `${TODAY} 11:30`,
        caseId: id,
        read: false,
      }
      setNotifications((prev) => [deniedNotif, ...prev])
      return
    }

    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            lastActionDate: TODAY,
            timeline: [
              ...c.timeline,
              {
                label: noteLabel,
                date: `${TODAY} 11:30`,
                by: `${currentUser.name} (${currentUser.designation})`,
                role: currentRole,
                note: noteText,
              },
            ],
          }
        }
        return c
      })
    )
  }

  const handleAddDocument = async (id: string, newDoc: CaseDocument) => {
    const target = complaints.find((c) => c.id === id)
    if (!target) return

    const check = canUploadCaseDocument(currentUser, target)
    if (!check.allowed) {
      const blockedNotif: AppNotification = {
        id: `notif-denied-${Date.now()}`,
        type: 'alert',
        title: 'Document Upload Denied (FastAPI 403 Simulation)',
        message: check.reason || 'You do not have authorization to upload documents to this docket.',
        timestamp: `${TODAY} 11:30`,
        caseId: id,
        read: false,
      }
      setNotifications((prev) => [blockedNotif, ...prev])
      return
    }

    const docLabel = `Supporting record attached: ${newDoc.name}`
    const docNote = `Document (${newDoc.size}) uploaded with ${newDoc.visibility} visibility.`

    // Call FastAPI backend to verify & persist supporting document note if token exists
    try {
      if (getAuthToken()) {
        await addComplaintTimelineNoteApi(id, { note: docNote, label: docLabel })
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Server rejected document upload.'
      const statusSuffix = err instanceof ApiError ? ` (HTTP ${err.status})` : ''
      const deniedNotif: AppNotification = {
        id: `notif-denied-${Date.now()}`,
        type: 'alert',
        title: `Document Upload Blocked by Server${statusSuffix}`,
        message: errorMsg,
        timestamp: `${TODAY} 11:30`,
        caseId: id,
        read: false,
      }
      setNotifications((prev) => [deniedNotif, ...prev])
      return
    }

    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const existing = c.documents || []
          return {
            ...c,
            documents: [...existing, newDoc],
            attachmentsCount: existing.length + 1,
            timeline: [
              ...c.timeline,
              {
                label: docLabel,
                date: `${TODAY} 11:30`,
                by: `${currentUser.name} (${currentRole})`,
                role: currentRole,
                note: docNote,
              },
            ],
          }
        }
        return c
      })
    )

    const notif: AppNotification = {
      id: `notif-${Date.now()}`,
      type: 'info',
      title: `Document Uploaded: ${newDoc.name}`,
      message: `A new verification record has been attached to docket ${id}.`,
      timestamp: `${TODAY} 11:30`,
      caseId: id,
      read: false,
    }
    setNotifications((prev) => [notif, ...prev])
  }

  const handleAddComplaint = async (newComplaint: Complaint): Promise<Complaint | null> => {
    // Only Complainants can submit grievances in the current scope
    if (currentRole !== 'Complainant') {
      const blockedNotif: AppNotification = {
        id: `notif-denied-${Date.now()}`,
        type: 'alert',
        title: 'Grievance Submission Restricted',
        message: 'Only registered complainants may submit grievances in the current scope. Proxy registration is not permitted.',
        timestamp: `${TODAY} 11:00`,
        read: false,
      }
      setNotifications((prev) => [blockedNotif, ...prev])
      return null
    }

    if (!getAuthToken()) {
      const authNotif: AppNotification = {
        id: `notif-auth-required-${Date.now()}`,
        type: 'alert',
        title: 'Sign In Required',
        message: 'Your secure session is missing. Sign in again before submitting this complaint.',
        timestamp: `${TODAY} 11:00`,
        read: false,
      }
      setNotifications((prev) => [authNotif, ...prev])
      return null
    }

    let complaintToAdd = newComplaint
    try {
      const created = await createComplaintApi({
        title: newComplaint.title,
        description: newComplaint.description,
        bureau: newComplaint.bureau,
        category: newComplaint.category,
        priority: newComplaint.priority,
        institutionId: newComplaint.institutionId,
        complainantType: newComplaint.complainantType,
        complainantName: newComplaint.complainantName,
        complainantEmail: newComplaint.complainantEmail,
        complainantPhone: newComplaint.complainantPhone,
        institutionPermanentId: newComplaint.institutionPermanentId,
      })
      if (!created?.id) {
        throw new Error('The server did not return a saved complaint record.')
      }
      complaintToAdd = { ...newComplaint, ...created }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Server rejected complaint creation.'
      const statusSuffix = err instanceof ApiError ? ` (HTTP ${err.status})` : ''
      const deniedNotif: AppNotification = {
        id: `notif-denied-${Date.now()}`,
        type: 'alert',
        title: `Submission Blocked by Server${statusSuffix}`,
        message: errorMsg,
        timestamp: `${TODAY} 11:00`,
        caseId: newComplaint.id,
        read: false,
      }
      setNotifications((prev) => [deniedNotif, ...prev])
      return null
    }

    setComplaints((prev) => [complaintToAdd, ...prev])

    // Push system notification
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}`,
      type: 'info',
      title: `New Case Registered: ${complaintToAdd.id}`,
      message: `A new complaint has been filed against ${complaintToAdd.institutionPermanentId || complaintToAdd.institutionId} under ${complaintToAdd.bureau} bureau.`,
      timestamp: `${TODAY} 11:00`,
      caseId: complaintToAdd.id,
      read: false,
    }
    setNotifications((prev) => [newNotif, ...prev])
    return complaintToAdd
  }

  const handleMarkNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const handleMarkAllNotificationsRead = () => {
    const visibleIds = new Set(visibleNotifications.map((n) => n.id))
    setNotifications((prev) =>
      prev.map((n) => (visibleIds.has(n.id) ? { ...n, read: true } : n))
    )
  }

  // Session verification loader
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#0b2250] flex flex-col items-center justify-center text-white font-sans p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-400/30 flex items-center justify-center">
            <Landmark size={26} />
          </div>
          <div>
            <div className="font-bold text-lg tracking-wide uppercase">All India Council for Technical Education</div>
            <div className="text-xs text-navy-200">Abhigyan Complaint Monitoring Platform</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-teal-300 bg-white/5 border border-white/10 px-5 py-3 rounded-xl">
          <Loader2 size={18} className="animate-spin text-teal-300" />
          <span>Verifying secure session with FastAPI backend...</span>
        </div>
      </div>
    )
  }

  // If user is logged out, show the Login screen
  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} initialRole={currentRole} />
  }

  const selectedComplaint = complaints.find((c) => c.id === selectedCaseId) || initialComplaints.find((c) => c.id === selectedCaseId)
  const activeOverlaps = overlapsList || overlaps
  const activeThreshold = appSettings.similarityThreshold ?? 75
  const pendingOverlapsCount = activeOverlaps.filter((o) =>
    isOverlapActivePending(o, overlapStates, activeThreshold)
  ).length
  const isPagePermitted = ROLE_PERMITTED_PAGES[currentRole].includes(activePage)

  return (
    <AppLayout
      activePage={activePage}
      onNavigate={setActivePage}
      notifications={visibleNotifications}
      onMarkNotificationAsRead={handleMarkNotificationRead}
      onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
      currentUser={currentUser}
      currentRole={currentRole}
      onSelectRole={handleSelectRole}
      onSignOut={handleSignOut}
      pendingOverlapsCount={pendingOverlapsCount}
      onSelectCase={handleOpenCase}
    >
      {/* Route Protection: Unauthorized Access Fallback */}
      {!isPagePermitted ? (
        <Card className="border-l-4 border-l-rose-600 p-8 text-center max-w-xl mx-auto my-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <ShieldAlert size={28} />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">
            Access Restricted by Demo Role Permissions
          </h3>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            Your current demo role (<strong>{currentRole}</strong>) does not have access permissions for the &quot;{activePage}&quot; module. In production, this policy will be strictly verified and enforced by the FastAPI backend.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setActivePage(getDefaultLandingPage(currentRole))}
            >
              Return to Permitted View
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Dynamic Page Router */}
          {activePage === 'dashboard' && (
            <Dashboard
              complaints={complaints}
              onOpen={handleOpenCase}
              onStatus={handleStatusChange}
              onNavigate={setActivePage}
              currentRole={currentRole}
              currentUser={currentUser}
              pendingOverlapsCount={pendingOverlapsCount}
            />
          )}

          {activePage === 'complaints' && (
            <ComplaintsPage
              complaints={complaints}
              onOpen={handleOpenCase}
              onStatus={handleStatusChange}
              onAddComplaint={handleAddComplaint}
              onNavigateToSubmit={() => setActivePage('submit')}
              currentRole={currentRole}
              currentUser={currentUser}
            />
          )}

          {activePage === 'submit' && (
            <SubmitComplaint
              complaints={complaints}
              onSubmit={handleAddComplaint}
              onCancel={() => setActivePage(getDefaultLandingPage(currentRole))}
              onTrackCase={handleOpenCase}
              currentRole={currentRole}
              currentUser={currentUser}
            />
          )}

          {activePage === 'details' && (
            <DetailsPage
              complaint={selectedComplaint}
              onBack={() => setActivePage('complaints')}
              onOpenCase={handleOpenCase}
              onStatus={handleStatusChange}
              onAssign={handleAssignOfficer}
              onTransferBureau={handleCrossBureauTransfer}
              onRequestReassignment={handleRequestReassignment}
              onReviewReassignmentRequest={handleReviewReassignmentRequest}
              onAddNote={handleAddTimelineNote}
              onAddDocument={handleAddDocument}
              onNavigateToInstitution={(instId) => {
                handleSelectInstitution(instId)
                setActivePage('institutions')
              }}
              currentRole={currentRole}
              currentUser={currentUser}
            />
          )}

          {activePage === 'institutions' && (
            <Institutions
              complaints={complaints}
              onOpen={handleOpenCase}
              onStatus={handleStatusChange}
              currentRole={currentRole}
              currentUser={currentUser}
              selectedInstitutionId={selectedInstitutionId}
              onSelectInstitution={handleSelectInstitution}
              onNavigateToOverlaps={() => setActivePage('overlaps')}
            />
          )}

          {activePage === 'overlaps' && (
            <Overlaps
              complaints={complaints}
              overlaps={overlapsList}
              onOpen={handleOpenCase}
              currentRole={currentRole}
              currentUser={currentUser}
              overlapStates={overlapStates}
              similarityThreshold={appSettings.similarityThreshold}
              onUpdateOverlapState={handleUpdateOverlapState}
            />
          )}

          {activePage === 'tracking' && (
            <CaseTracking
              complaints={complaints}
              onOpen={handleOpenCase}
              onStatus={handleStatusChange}
              onAddNote={handleAddTimelineNote}
              currentRole={currentRole}
              currentUser={currentUser}
            />
          )}

          {activePage === 'reports' && (
            <Reports
              complaints={complaints}
              currentRole={currentRole}
              currentUser={currentUser}
            />
          )}

          {activePage === 'notifications' && (
            <NotificationsPage
              notifications={visibleNotifications}
              onMarkAsRead={handleMarkNotificationRead}
              onMarkAllAsRead={handleMarkAllNotificationsRead}
              onOpenCase={handleOpenCase}
            />
          )}

          {activePage === 'users' && (
            <UserManagement
              users={users}
              onUpdateUsers={setUsers}
              currentRole={currentRole}
              currentUser={currentUser}
            />
          )}

          {activePage === 'settings' && (
            <Settings
              currentRole={currentRole}
              currentUser={currentUser}
              settings={appSettings}
              onUpdateSettings={handleUpdateSettings}
              onResetSettings={handleResetSettings}
            />
          )}
        </>
      )}
    </AppLayout>
  )
}
