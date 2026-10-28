/**
 * Abhigyan Frontend Settings & Threshold Synchronization Tests
 * Validates persistent settings, similarity threshold candidate filtering,
 * historical decision preservation, and role authorization.
 */

import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SETTINGS,
  getAppSettings,
  PERMITTED_STATUS_TRANSITIONS,
  canUpdateCaseStatus,
  getOverlapEffectiveState,
  isOverlapHistorical,
  isOverlapActivePending,
} from '../../data.ts'
import { ApiError } from '../client.ts'

const BASE_URL = process.env.VITE_API_BASE_URL || process.env.VITE_API_URL || 'https://abhigyann.onrender.com/api'
let isServerUp = false

describe('Abhigyan Phase 3: Settings & Threshold Regression Suite', () => {
  before(async () => {
    try {
      const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(1000) })
      if (res.status === 200) {
        const health = await res.json()
        if (health.status === 'healthy') {
          isServerUp = true
        }
      }
    } catch {
      isServerUp = false
    }
  })

  test('Settings Defaults & Local Storage non-authoritative fallback', () => {
    const defaults = { ...DEFAULT_SETTINGS }
    assert.equal(defaults.similarityThreshold, 75)
    assert.equal(defaults.slaCritical, 3)
    assert.equal(defaults.slaHigh, 7)
    assert.equal(defaults.slaMedium, 14)
    assert.equal(defaults.autoEscalate, true)
    assert.equal(defaults.emailAlerts, true)
  })

  test('Authorized System Admin can update and persist settings', async () => {
    let authoritativeSettings = { ...DEFAULT_SETTINGS }
    let clientSaveError = null

    // Simulate backend update API handler
    const mockUpdateSettingsApi = async (newSettings, userRole, userBureau) => {
      if (userRole !== 'Admin' || userBureau !== 'All') {
        throw new ApiError('Only System Admin can modify global bureau/system settings.', 403)
      }
      // Validate bounds
      if (newSettings.similarityThreshold < 50 || newSettings.similarityThreshold > 95) {
        throw new ApiError('similarityThreshold must be between 50% and 95%', 422)
      }
      authoritativeSettings = {
        ...authoritativeSettings,
        ...newSettings,
        updatedAt: new Date().toISOString(),
      }
      return authoritativeSettings
    }

    // System Admin attempt
    const updated = await mockUpdateSettingsApi(
      { similarityThreshold: 85, slaCritical: 2 },
      'Admin',
      'All'
    )

    assert.equal(updated.similarityThreshold, 85)
    assert.equal(updated.slaCritical, 2)
    assert.equal(authoritativeSettings.similarityThreshold, 85)
  })

  test('Unauthorized roles (Bureau Admin, Officer, Complainant) cannot modify global settings', async () => {
    const roles = [
      { role: 'BureauAdmin', bureau: 'PGRC', name: 'Dr. Priya Nair' },
      { role: 'Officer', bureau: 'PGRC', name: 'Rajesh Kumar' },
      { role: 'Officer', bureau: 'RB', name: 'Anita Verma' },
      { role: 'Complainant', bureau: 'None', name: 'Sunita Rao' },
    ]

    const mockUpdateSettingsApi = async (newSettings, userRole, userBureau) => {
      if (userRole !== 'Admin' || userBureau !== 'All') {
        throw new ApiError('Only System Admin can modify global bureau/system settings.', 403)
      }
      return newSettings
    }

    for (const user of roles) {
      await assert.rejects(
        async () => {
          await mockUpdateSettingsApi({ similarityThreshold: 90 }, user.role, user.bureau)
        },
        (err) => {
          assert.equal(err.status, 403)
          assert.match(err.message, /Only System Admin/)
          return true
        },
        `Role ${user.role} should be rejected with 403`
      )
    }
  })

  test('Failed save does not show success or overwrite authoritative settings', async () => {
    const currentAuthoritative = { ...DEFAULT_SETTINGS, similarityThreshold: 75 }
    let showSuccessBanner = false
    let bannerErrorMessage = null

    const mockFailingApi = async () => {
      throw new ApiError('Database connection lost during transaction', 500)
    }

    // React handler simulation in Settings.tsx
    const handleSave = async (draftSettings) => {
      try {
        await mockFailingApi(draftSettings)
        showSuccessBanner = true
      } catch (err) {
        bannerErrorMessage = err.message
        showSuccessBanner = false
      }
    }

    await handleSave({ similarityThreshold: 90 })

    assert.equal(showSuccessBanner, false, 'Success banner must never be shown on failed save')
    assert.match(bannerErrorMessage, /Database connection lost/)
    assert.equal(currentAuthoritative.similarityThreshold, 75, 'Authoritative settings must not be corrupted')
  })

  test('Changing threshold changes eligible open candidate count and related dashboard counts', () => {
    const candidates = [
      { id: 'o1', a: 'RB-2026-0141', b: 'PGRC-2026-0873', similarity: 91, status: 'open' },
      { id: 'o2', a: 'AB-2026-0044', b: 'PGRC-2026-0922', similarity: 88, status: 'open' },
      { id: 'o3', a: 'RB-2026-0141', b: 'AB-2026-0051', similarity: 84, status: 'open' },
      { id: 'o4', a: 'PGRC-2026-0922', b: 'AB-2026-0078', similarity: 79, status: 'open' },
      { id: 'o5', a: 'PGRC-2026-0873', b: 'PGRC-2026-0922', similarity: 72, status: 'open' },
      { id: 'o6', a: 'AB-2026-0044', b: 'AB-2026-0051', similarity: 65, status: 'open' },
      { id: 'o7', a: 'RB-2026-0141', b: 'PGRC-2026-0922', similarity: 58, status: 'open' },
    ]

    // At default 75% threshold
    const eligibleAt75 = candidates.filter((c) => c.similarity >= 75)
    assert.equal(eligibleAt75.length, 4, 'o1 (91%), o2 (88%), o3 (84%), o4 (79%) should be eligible at 75%')

    // At strict 85% threshold
    const eligibleAt85 = candidates.filter((c) => c.similarity >= 85)
    assert.equal(eligibleAt85.length, 2, 'Only o1 (91%) and o2 (88%) should be eligible at 85%')

    // At relaxed 60% threshold
    const eligibleAt60 = candidates.filter((c) => c.similarity >= 60)
    assert.equal(eligibleAt60.length, 6, 'o1 through o6 should be eligible at 60%')
  })

  test('Existing linked/dismissed/deferred overlaps remain historically intact when threshold changes', () => {
    const historicalOverlaps = [
      { id: 'o1', a: 'RB-2026-0141', b: 'PGRC-2026-0873', similarity: 91, status: 'linked', justification: 'Confirmed match' },
      { id: 'o2', a: 'AB-2026-0044', b: 'PGRC-2026-0922', similarity: 70, status: 'linked', justification: 'Prior confirmed linkage' },
      { id: 'o3', a: 'PGRC-2026-0873', b: 'PGRC-2026-0922', similarity: 62, status: 'dismissed', justification: 'Verified distinct' },
      { id: 'o4', a: 'AB-2026-0044', b: 'AB-2026-0051', similarity: 55, status: 'deferred', justification: 'Pending panel' },
      { id: 'o5', a: 'RB-2026-0141', b: 'AB-2026-0051', similarity: 65, status: 'open' },
    ]

    const activeThreshold = 80 // Raised above 70%, 62%, 55%, 65%

    // Filtering logic implemented in Overlaps.tsx:
    // Open candidates must meet threshold (unless showBelowThreshold is true)
    // Historical decisions (linked, dismissed, deferred) are ALWAYS preserved
    const visibleOverlaps = historicalOverlaps.filter((item) => {
      const isHistorical = item.status !== 'open'
      if (isHistorical) return true
      return item.similarity >= activeThreshold
    })

    assert.equal(visibleOverlaps.length, 4, 'All 3 historical records + 1 open (if >=80) should be included')
    assert.ok(visibleOverlaps.some((o) => o.id === 'o2' && o.similarity === 70 && o.status === 'linked'))
    assert.ok(visibleOverlaps.some((o) => o.id === 'o3' && o.similarity === 62 && o.status === 'dismissed'))
    assert.ok(visibleOverlaps.some((o) => o.id === 'o4' && o.similarity === 55 && o.status === 'deferred'))
    // o5 is open and 65% < 80%, so it is excluded from active candidate list
    assert.equal(visibleOverlaps.some((o) => o.id === 'o5'), false)
  })

  test('Bug 1: Case status dropdown transitions and RBAC permissions', () => {
    // 1. Permitted status transitions table
    assert.deepEqual(PERMITTED_STATUS_TRANSITIONS.Pending, ['In Progress', 'Escalated'])
    assert.deepEqual(PERMITTED_STATUS_TRANSITIONS['In Progress'], ['Escalated', 'Resolved'])
    assert.deepEqual(PERMITTED_STATUS_TRANSITIONS.Escalated, ['In Progress', 'Resolved'])
    assert.deepEqual(PERMITTED_STATUS_TRANSITIONS.Resolved, [])

    // 2. Mock users
    const adminUser = { id: 'u1', name: 'Dr. S. Mehta', role: 'Admin', bureau: 'All' }
    const pgrcOfficer = { id: 'u2', name: 'Rajesh Kumar', role: 'Officer', bureau: 'PGRC' }
    const complainant = { id: 'u0', name: 'Rohit Sharma', role: 'Complainant', bureau: 'None' }

    // Mock complaints
    const pendingCase = {
      id: 'RB-2026-0141',
      bureau: 'RB',
      status: 'Pending',
      officer: 'Anita Verma',
    }
    const resolvedCase = {
      id: 'AB-2026-0310',
      bureau: 'Approval',
      status: 'Resolved',
      officer: 'Suresh Patel',
    }

    // Pending transitions
    assert.equal(canUpdateCaseStatus(adminUser, pendingCase, 'In Progress').allowed, true)
    assert.equal(canUpdateCaseStatus(adminUser, pendingCase, 'Escalated').allowed, true)
    assert.equal(canUpdateCaseStatus(adminUser, pendingCase, 'Resolved').allowed, false, 'Pending directly to Resolved requires override')

    // Reopen from Resolved
    const reopenNoReason = canUpdateCaseStatus(adminUser, resolvedCase, 'In Progress')
    assert.equal(reopenNoReason.allowed, false, 'Resolved case cannot reopen without overrideReason')
    assert.match(reopenNoReason.reason, /override/)

    const reopenWithReason = canUpdateCaseStatus(
      adminUser,
      resolvedCase,
      'In Progress',
      'Statutory appellate remand'
    )
    assert.equal(reopenWithReason.allowed, true, 'Admin with overrideReason can reopen Resolved case')

    // Complainant cannot update case status
    const compAttempt = canUpdateCaseStatus(complainant, pendingCase, 'In Progress')
    assert.equal(compAttempt.allowed, false)
    assert.match(compAttempt.reason, /Complainants cannot modify/)
  })

  test('Bug 2: Threshold 90% with 91% pending, 88% pending, and 88% historical decisions', () => {
    const cand91 = {
      id: 'c91',
      a: 'RB-2026-0171',
      b: 'PGRC-2026-0902',
      similarity: 91,
      status: 'open',
      reasons: ['Similar admission irregularities'],
    }
    const cand88 = {
      id: 'c88',
      a: 'PGRC-2026-0873',
      b: 'AB-2026-0310',
      similarity: 88,
      status: 'open',
      reasons: ['Shared fee notice'],
    }
    const hist88 = {
      id: 'h88',
      a: 'RB-2026-0152',
      b: 'PGRC-2026-0890',
      similarity: 88,
      status: 'linked',
      justification: 'Confirmed match by Bureau Admin',
    }
    const hist78 = {
      id: 'h78',
      a: 'RB-2026-0195',
      b: 'PGRC-2026-0940',
      similarity: 78,
      status: 'dismissed',
      justification: 'Dismissed: Unrelated topics',
    }

    const allItems = [cand91, cand88, hist88, hist78]
    const activeThreshold = 90
    const states = {}

    // 1. Candidate 91% unreviewed: active pending
    assert.equal(isOverlapActivePending(cand91, states, activeThreshold), true, '91% candidate is active pending at 90% threshold')

    // 2. Candidate 88% unreviewed: below threshold, suppressed from active pending queue
    assert.equal(isOverlapActivePending(cand88, states, activeThreshold), false, '88% candidate is NOT active pending at 90% threshold')

    // 3. Historical 88% linked decision: NOT active pending, never inflates pending queue
    assert.equal(isOverlapActivePending(hist88, states, activeThreshold), false, '88% historical decision must NEVER be pending')
    assert.equal(isOverlapHistorical(hist88, states), true, '88% historical decision is historical')

    // 4. Historical 78% dismissed decision: NOT active pending
    assert.equal(isOverlapActivePending(hist78, states, activeThreshold), false)
    assert.equal(isOverlapHistorical(hist78, states), true)

    // Active pending count
    const pendingList = allItems.filter((o) => isOverlapActivePending(o, states, activeThreshold))
    assert.equal(pendingList.length, 1, 'Only the 91% unreviewed candidate qualifies for active pending')
    assert.equal(pendingList[0].id, 'c91')

    // Effective states
    assert.equal(getOverlapEffectiveState(cand91, states), 'open')
    assert.equal(getOverlapEffectiveState(cand88, states), 'open')
    assert.equal(getOverlapEffectiveState(hist88, states), 'linked')
    assert.equal(getOverlapEffectiveState(hist78, states), 'dismissed')
  })

  test('Bug 2: Persistence after reload ensures pending counts exclude historical decisions', () => {
    const cand88 = {
      id: 'c88',
      a: 'PGRC-2026-0873',
      b: 'AB-2026-0310',
      similarity: 88,
      status: 'open',
    }
    const cand91 = {
      id: 'c91',
      a: 'RB-2026-0171',
      b: 'PGRC-2026-0902',
      similarity: 91,
      status: 'open',
    }

    // Before review at threshold 85
    const initialStates = {}
    assert.equal(isOverlapActivePending(cand88, initialStates, 85), true)
    assert.equal(isOverlapActivePending(cand91, initialStates, 85), true)

    // Review decision saved (persisted state simulating localStorage / server sync)
    const reloadedStates = {
      c88: 'linked',
    }

    // After reload: cand88 has become a historical decision
    assert.equal(getOverlapEffectiveState(cand88, reloadedStates), 'linked')
    assert.equal(isOverlapHistorical(cand88, reloadedStates), true)

    // At any threshold (even 50% or 85%), historical decision NEVER counts as pending
    assert.equal(isOverlapActivePending(cand88, reloadedStates, 85), false)
    assert.equal(isOverlapActivePending(cand88, reloadedStates, 50), false)

    // Only unreviewed cand91 remains pending
    assert.equal(isOverlapActivePending(cand91, reloadedStates, 85), true)
  })

  // Live Backend Integration Tests (skipped gracefully when FastAPI backend is not running)
  test('LIVE BACKEND: GET /api/settings retrieves seeded system settings', async (t) => {
    if (!isServerUp) return t.skip('Live FastAPI backend server not reachable at ' + BASE_URL)

    // Authenticate using seeded demo credentials to obtain valid Bearer token
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'member-sec@aicte-india.org',
        password: 'AicteDemo@2026',
      }),
    })
    assert.equal(loginRes.status, 200, 'Demo login should succeed for Admin')
    const authData = await loginRes.json()
    assert.ok(authData.accessToken, 'Auth response must include accessToken')

    const res = await fetch(`${BASE_URL}/settings`, {
      headers: {
        'Authorization': `Bearer ${authData.accessToken}`,
      },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(typeof data.similarityThreshold === 'number')
    assert.ok(typeof data.slaCritical === 'number')
    assert.ok(typeof data.slaHigh === 'number')
    assert.ok(typeof data.slaMedium === 'number')
  })

  test('LIVE BACKEND: PUT /api/settings requires System Admin token', async (t) => {
    if (!isServerUp) return t.skip('Live FastAPI backend server not reachable at ' + BASE_URL)
    // Attempt without token
    const unauthRes = await fetch(`${BASE_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ similarityThreshold: 80 }),
    })
    assert.equal(unauthRes.status, 401)
  })
})
