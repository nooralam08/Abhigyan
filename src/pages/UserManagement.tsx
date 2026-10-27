import { useEffect, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Edit2,
  Key,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import type { Bureau, Role, UserProfile } from '../types'
import { BUREAUS, USER_STORAGE_KEY, userProfiles as initialProfiles } from '../data'
import { Badge, Button, Card, Modal, PageTitle, SearchBox } from '../components/ui'
import {
  fetchUsersApi,
  createUserApi,
  updateUserApi,
  updateUserStatusApi,
  type UserCreatePayload,
  type UserUpdatePayload,
} from '../api/users'
import { ApiError, getAuthToken } from '../api/client'

export { USER_STORAGE_KEY }

export function getStoredUsers(): UserProfile[] {
  try {
    const stored = localStorage.getItem(USER_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch {
    // fallback
  }
  return initialProfiles
}

export interface UserManagementProps {
  currentRole?: Role
  currentUser?: UserProfile
  users?: UserProfile[]
  onUpdateUsers?: React.Dispatch<React.SetStateAction<UserProfile[]>>
}

export default function UserManagement({
  currentRole = 'Admin',
  currentUser,
  users: externalUsers,
  onUpdateUsers,
}: UserManagementProps) {
  const [internalUsers, setInternalUsers] = useState<UserProfile[]>(() => getStoredUsers())
  const users = externalUsers ?? internalUsers

  const updateUsers = (updater: (prev: UserProfile[]) => UserProfile[]) => {
    if (onUpdateUsers) {
      onUpdateUsers((prev) => {
        const next = updater(prev)
        try {
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next))
        } catch {
          // ignore
        }
        return next
      })
    } else {
      setInternalUsers((prev) => {
        const next = updater(prev)
        try {
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next))
        } catch {
          // ignore
        }
        return next
      })
    }
  }

  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isStaleData, setIsStaleData] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [bureauFilter, setBureauFilter] = useState<string>('All')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [noticeBanner, setNoticeBanner] = useState<string | null>(null)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  // New Officer State
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newDesignation, setNewDesignation] = useState('')
  const [newBureau, setNewBureau] = useState<Bureau>('PGRC')
  const [newRole, setNewRole] = useState<Role>('Officer')
  const [newPhone, setNewPhone] = useState('')
  const [newPassword, setNewPassword] = useState('')

  // Edit Officer State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editDesignation, setEditDesignation] = useState('')
  const [editBureau, setEditBureau] = useState<Bureau>('PGRC')
  const [editRole, setEditRole] = useState<Role>('Officer')
  const [editPhone, setEditPhone] = useState('')
  const [editStatus, setEditStatus] = useState<'Active' | 'On Leave' | 'Inactive'>('Active')
  const [editPassword, setEditPassword] = useState('')

  const isAdmin = currentRole === 'Admin'

  // Fetch users from FastAPI backend on mount if authenticated
  const loadUsers = async () => {
    if (!getAuthToken()) {
      setIsStaleData(false)
      return
    }
    // Complainant does not have access to user directory API
    if (currentRole === 'Complainant') return

    setIsLoading(true)
    setErrorBanner(null)
    try {
      const remote = await fetchUsersApi()
      if (Array.isArray(remote)) {
        if (onUpdateUsers) {
          onUpdateUsers(remote)
        } else {
          setInternalUsers(remote)
        }
        try {
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(remote))
        } catch {
          // ignore
        }
        setIsStaleData(false)
        setLastSyncTime(new Date().toLocaleTimeString())
      }
    } catch (err: unknown) {
      console.warn('Could not sync users with FastAPI backend, using cached state:', err)
      setIsStaleData(true)
      const msg = err instanceof ApiError ? err.message : 'Unable to synchronize user directory with server.'
      if (err instanceof ApiError && err.status === 403) {
        setErrorBanner('Unauthorized: You do not have permission to view the personnel directory.')
      } else {
        setErrorBanner(
          `Server unreachable: ${msg}. Displaying cached offline personnel records. Cached data may not reflect recent server changes.`
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [currentRole])

  const filtered = users.filter((u) => {
    const text = `${u.name} ${u.email} ${u.designation} ${u.bureau}`.toLowerCase()
    const matchesSearch = !search.trim() || text.includes(search.toLowerCase().trim())
    const matchesBureau = bureauFilter === 'All' || u.bureau === bureauFilter
    return matchesSearch && matchesBureau
  })

  const handleAddOfficer = async (e: React.FormEvent) => {
    e.preventDefault()
    setNoticeBanner(null)
    setErrorBanner(null)

    if (!isAdmin) {
      setErrorBanner('Unauthorized: Only System Administrators can provision official accounts.')
      return
    }

    if (!newName.trim() || !newEmail.trim()) {
      setErrorBanner('Please provide both the official name and email address.')
      return
    }

    const emailCandidate = newEmail.trim().toLowerCase()
    const isDuplicate = users.some((u) => u.email.toLowerCase() === emailCandidate)
    if (isDuplicate) {
      setErrorBanner(`An officer with official email "${newEmail.trim()}" is already registered in the directory.`)
      return
    }

    if (!newPassword.trim() || newPassword.trim().length < 6) {
      setErrorBanner('Please provide an initial account password of at least 6 characters.')
      return
    }

    setIsSubmitting(true)

    // Backend-first integration
    if (getAuthToken()) {
      try {
        const payload: UserCreatePayload = {
          name: newName.trim(),
          email: newEmail.trim(),
          designation: newDesignation.trim() || 'Grievance Officer',
          bureau: newBureau,
          role: newRole,
          phone: newPhone.trim() || '+91 11 2958 0000',
          status: 'Active',
          password: newPassword.trim(),
        }
        const created = await createUserApi(payload)
        updateUsers((prev) => [created, ...prev])
        setNewName('')
        setNewEmail('')
        setNewDesignation('')
        setNewPhone('')
        setNewPassword('')
        setIsAddModalOpen(false)
        setNoticeBanner(
          `Official "${created.name}" (${created.role} - ${created.bureau}) successfully provisioned and synchronized with the database.`
        )
      } catch (err: unknown) {
        const errorMsg = err instanceof ApiError ? err.message : 'Server rejected user creation.'
        setErrorBanner(errorMsg)
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    // Offline / unauthenticated demo fallback
    const initials = newName
      .trim()
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

    const created: UserProfile = {
      id: `u-${Date.now()}`,
      name: newName.trim(),
      email: newEmail.trim(),
      designation: newDesignation.trim() || 'Grievance Officer',
      bureau: newBureau,
      role: newRole,
      avatarText: initials || 'OF',
      phone: newPhone.trim() || '+91 11 2958 0000',
      activeCasesCount: 0,
      status: 'Active',
    }

    updateUsers((prev) => [...prev, created])
    setNewName('')
    setNewEmail('')
    setNewDesignation('')
    setNewPhone('')
    setNewPassword('')
    setIsAddModalOpen(false)
    setIsSubmitting(false)
    setNoticeBanner(
      `Officer "${created.name}" (${created.bureau} Bureau) saved locally to ${USER_STORAGE_KEY}.`
    )
  }

  const toggleStatus = async (id: string) => {
    setNoticeBanner(null)
    setErrorBanner(null)

    if (!isAdmin) {
      setErrorBanner('Unauthorized: Only System Administrators can alter officer duty status.')
      return
    }

    const target = users.find((u) => u.id === id)
    if (!target) return

    const nextStatus = target.status === 'Active' ? 'On Leave' : 'Active'

    // Call backend API if authenticated
    if (getAuthToken()) {
      try {
        const updated = await updateUserStatusApi(id, nextStatus)
        updateUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: updated.status } : u)))
        setNoticeBanner(`Duty status for "${updated.name}" changed to ${updated.status} in the database.`)
      } catch (err: unknown) {
        const msg = err instanceof ApiError ? err.message : 'Failed to update duty status on server.'
        setErrorBanner(msg)
      }
      return
    }

    // Local fallback
    updateUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: nextStatus } : u))
    )
    setNoticeBanner(`Duty status for "${target.name}" changed to ${nextStatus} and saved to ${USER_STORAGE_KEY}.`)
  }

  const handleOpenEdit = (user: UserProfile) => {
    if (!isAdmin) {
      setErrorBanner('Unauthorized: Only System Administrators can edit official user profiles.')
      return
    }
    setEditingUser(user)
    setEditName(user.name)
    setEditEmail(user.email)
    setEditDesignation(user.designation || '')
    setEditBureau((user.bureau as Bureau) || 'PGRC')
    setEditRole((user.role as Role) || 'Officer')
    setEditPhone(user.phone || '')
    setEditStatus((user.status as 'Active' | 'On Leave' | 'Inactive') || 'Active')
    setEditPassword('')
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    if (!isAdmin) {
      setErrorBanner('Unauthorized: Only System Administrators can update user accounts.')
      return
    }

    if (!editName.trim() || !editEmail.trim()) {
      setErrorBanner('Full name and email are required.')
      return
    }

    setIsSubmitting(true)
    setErrorBanner(null)
    setNoticeBanner(null)

    const payload: UserUpdatePayload = {
      name: editName.trim(),
      email: editEmail.trim(),
      designation: editDesignation.trim(),
      bureau: editBureau,
      role: editRole,
      phone: editPhone.trim(),
      status: editStatus,
      ...(editPassword.trim() ? { password: editPassword.trim() } : {}),
    }

    if (getAuthToken()) {
      try {
        const updated = await updateUserApi(editingUser.id, payload)
        updateUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
        setNoticeBanner(`User profile for "${updated.name}" successfully updated in the database.`)
        setEditingUser(null)
      } catch (err: unknown) {
        const msg = err instanceof ApiError ? err.message : 'Server rejected profile update.'
        setErrorBanner(msg)
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    // Local fallback
    const updated: UserProfile = {
      ...editingUser,
      name: editName.trim(),
      email: editEmail.trim(),
      designation: editDesignation.trim(),
      bureau: editBureau,
      role: editRole,
      phone: editPhone.trim(),
      status: editStatus,
    }
    updateUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    setNoticeBanner(`User "${updated.name}" updated locally.`)
    setEditingUser(null)
    setIsSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="User Management"
        sub="Authorized officers, bureau administrators, and personnel directory"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadUsers}
              disabled={isLoading}
              title="Synchronize directory with server"
              className="text-xs"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              <span>{isLoading ? 'Syncing...' : 'Sync'}</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (!isAdmin) {
                  setErrorBanner('Unauthorized: Only System Administrators can provision new official accounts.')
                  return
                }
                setIsAddModalOpen(true)
              }}
              className="text-xs"
            >
              <UserPlus size={14} />
              <span>Add User</span>
            </Button>
          </div>
        }
      />

      {/* Non-blocking Notice Banner */}
      {noticeBanner && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-xs font-medium text-emerald-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
            <span>{noticeBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setNoticeBanner(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Non-blocking Error Banner */}
      {errorBanner && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-xs font-medium text-red-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-700 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-red-700 hover:text-red-900"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Offline / Stale Data Warning Banner */}
      {isStaleData && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs font-medium text-amber-900 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-amber-950">
                Warning: Offline / Cached Directory Displayed
              </div>
              <div className="text-amber-800 leading-relaxed">
                The personnel directory could not be synchronized with the backend database. You are currently viewing cached records from local browser storage{lastSyncTime ? ` (last verified at ${lastSyncTime})` : ''}. Changes cannot be saved to the database until the connection is restored.
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadUsers}
            disabled={isLoading}
            className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100 shrink-0 text-xs"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            <span>Retry Connection</span>
          </Button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-navy-50 p-3 text-navy-800">
            <Users size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{users.length}</div>
            <div className="text-xs text-slate-500">Total Authorised Personnel</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-teal-50 p-3 text-teal-700">
            <UserCheck size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {users.filter((u) => u.status === 'Active').length}
            </div>
            <div className="text-xs text-slate-500">Active on Duty</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-50 p-3 text-indigo-700">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {users.filter((u) => u.bureau === 'RB').length}
            </div>
            <div className="text-xs text-slate-500">Regulation Bureau Staff</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-sky-50 p-3 text-sky-700">
            <Building2 size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {users.filter((u) => u.bureau === 'PGRC').length}
            </div>
            <div className="text-xs text-slate-500">PGRC Cell Officers</div>
          </div>
        </Card>
      </div>

      {/* Filter and Search */}
      <Card padding="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search by officer name, email, designation, bureau..."
            className="flex-1 min-w-[240px]"
          />

          <select
            value={bureauFilter}
            onChange={(e) => setBureauFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="All">All Bureaus</option>
            {BUREAUS.map((b) => (
              <option key={b} value={b}>
                Bureau: {b}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Officers Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((user) => (
          <Card key={user.id} className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0b2250] text-sm font-bold text-white shadow-2xs">
                  {user.avatarText || user.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">{user.name}</h4>
                  <p className="text-xs text-slate-500">{user.designation || 'Staff Officer'}</p>
                </div>
              </div>

              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                  user.status === 'Active'
                    ? 'bg-emerald-100 text-emerald-800'
                    : user.status === 'On Leave'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {user.status || 'Active'}
              </span>
            </div>

            <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-xs border border-slate-100 text-slate-600">
              <div className="flex items-center justify-between">
                <span>Bureau:</span>
                <Badge v={user.bureau} />
              </div>
              <div className="flex items-center justify-between">
                <span>System Role:</span>
                <Badge v={user.role} />
              </div>
              <div className="flex items-center justify-between">
                <span>Active Assigned Cases:</span>
                <span className="font-bold text-navy-800">{user.activeCasesCount ?? 0} Active</span>
              </div>
            </div>

            <div className="space-y-1 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Mail size={13} className="text-slate-400 shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={13} className="text-slate-400 shrink-0" />
                <span>{user.phone || 'N/A'}</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleStatus(user.id)}
                  disabled={!isAdmin}
                  title={!isAdmin ? 'Only System Administrators can change duty status' : undefined}
                  className={`text-xs font-medium ${
                    isAdmin
                      ? 'text-slate-500 hover:text-navy-800 cursor-pointer'
                      : 'text-slate-400 cursor-not-allowed opacity-60'
                  }`}
                >
                  Toggle Status ({user.status === 'Active' ? 'Set On Leave' : 'Set Active'})
                </button>

                {isAdmin && (
                  <>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(user)}
                      className="text-xs font-medium text-navy-700 hover:text-navy-900 cursor-pointer flex items-center gap-1"
                    >
                      <Edit2 size={11} />
                      <span>Edit</span>
                    </button>
                  </>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-mono">ID: {user.id}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Officer Modal */}
      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add AICTE Official Account"
        subtitle="Provision an authorised officer or administrator into Abhigyan"
      >
        <form onSubmit={handleAddOfficer} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Official Name *
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Dr. Ramesh Chander"
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-navy-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Official Email *
              </label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="e.g. ramesh.chander@aicte-india.org"
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-navy-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Primary Bureau *
              </label>
              <select
                value={newBureau}
                onChange={(e) => setNewBureau(e.target.value as Bureau)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-navy-600 focus:outline-none"
              >
                {BUREAUS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Access Role *
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-navy-600 focus:outline-none"
              >
                <option value="Officer">Case Officer</option>
                <option value="BureauAdmin">Bureau Administrator</option>
                <option value="Admin">System Administrator</option>
                <option value="Complainant">Complainant / Citizen</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+91 11 2958 1000"
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-navy-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Designation Title
              </label>
              <input
                type="text"
                value={newDesignation}
                onChange={(e) => setNewDesignation(e.target.value)}
                placeholder="e.g. Scrutiny Officer, Fee Monitoring Cell"
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-navy-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Initial Account Password *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter secure initial password (min. 6 characters)"
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-navy-600 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                A secure initial password is required. The official can sign in with this password and it can be reset anytime.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Provisioning...</span>
                </>
              ) : (
                <>
                  <UserCheck size={14} />
                  <span>Confirm &amp; Provision User</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title="Edit User Profile & Permissions"
        subtitle={`Update details, role privileges, or duty status for ${editingUser?.name || ''}`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Official Name *
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-navy-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Official Email *
              </label>
              <input
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-navy-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Primary Bureau *
              </label>
              <select
                value={editBureau}
                onChange={(e) => setEditBureau(e.target.value as Bureau)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-navy-600 focus:outline-none"
              >
                {BUREAUS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                System Role *
              </label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as Role)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-navy-600 focus:outline-none"
              >
                <option value="Officer">Case Officer</option>
                <option value="BureauAdmin">Bureau Administrator</option>
                <option value="Admin">System Administrator</option>
                <option value="Complainant">Complainant / Citizen</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Duty Status *
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as 'Active' | 'On Leave' | 'Inactive')}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-navy-600 focus:outline-none"
              >
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Designation Title
              </label>
              <input
                type="text"
                value={editDesignation}
                onChange={(e) => setEditDesignation(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-navy-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-navy-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reset Password (leave empty to keep current password)
            </label>
            <input
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="Enter new password (minimum 6 characters)"
              className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-navy-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingUser(null)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <UserCheck size={14} />
                  <span>Save Changes</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
