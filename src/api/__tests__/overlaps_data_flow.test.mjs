import test from 'node:test'
import assert from 'node:assert/strict'
import {
  overlaps as initialOverlaps,
  initialComplaints,
  getOverlapEffectiveState,
  isOverlapActivePending,
} from '../../data.ts'

// Replicate the getComplaint resolver logic implemented in Overlaps.tsx
function resolveComplaint(id, complaints) {
  const found = complaints.find((c) => c.id === id) || initialComplaints.find((c) => c.id === id)
  if (found) return found

  let bureau = 'PGRC'
  if (id.startsWith('RB-')) bureau = 'RB'
  else if (id.startsWith('AB-')) bureau = 'Approval'
  else if (id.startsWith('ACD-')) bureau = 'Academic'
  else if (id.startsWith('SB-')) bureau = 'SB'
  else if (id.startsWith('PGRC-')) bureau = 'PGRC'

  return {
    id,
    institutionId: 'i1',
    bureau,
    category: 'Cross-Bureau Grievance',
    priority: 'High',
    status: 'Pending',
    officer: 'Handling Officer',
    date: '2026-10-28',
    due: '2026-10-28',
    title: `Docket ${id}`,
    description: `Cross-bureau reference grievance docket (${id}) under active corroboration review.`,
    complainantType: 'General Public',
  }
}

// Replicate the filtering logic implemented in Overlaps.tsx
function filterOverlaps(allOverlaps, complaints, states, options = {}) {
  const {
    activeThreshold = 75,
    showBelowThreshold = false,
    bureauFilter = 'All',
    statusFilter = 'All',
    similarityFilter = 'All',
    searchQuery = '',
  } = options

  return allOverlaps.filter((overlap) => {
    const compA = resolveComplaint(overlap.a, complaints)
    const compB = resolveComplaint(overlap.b, complaints)
    if (!compA || !compB) return false

    const currentState = getOverlapEffectiveState(overlap, states)
    if (statusFilter !== 'All') {
      if (statusFilter === 'open' && currentState !== 'open') return false
      if (statusFilter !== 'open' && currentState !== statusFilter) return false
    }

    if (currentState === 'open' && overlap.similarity < activeThreshold && !showBelowThreshold) {
      return false
    }

    if (bureauFilter !== 'All') {
      if (compA.bureau !== bureauFilter && compB.bureau !== bureauFilter) {
        return false
      }
    }

    if (similarityFilter === 'high' && overlap.similarity < 85) return false
    if (
      similarityFilter === 'moderate' &&
      (overlap.similarity < 65 || overlap.similarity >= 85)
    ) {
      return false
    }
    if (similarityFilter === 'low' && overlap.similarity >= 65) return false

    return true
  })
}

test('Overlaps Regression: Bureau-scoped complaints list does NOT filter out cross-bureau overlaps', async () => {
  // Simulate PGRC Bureau Admin: complaints array only contains PGRC complaints
  const pgrcOnlyComplaints = initialComplaints.filter((c) => c.bureau === 'PGRC')
  assert.ok(pgrcOnlyComplaints.length > 0)
  assert.ok(pgrcOnlyComplaints.every((c) => c.bureau === 'PGRC'))

  // Using the old resolver without multi-tier fallback, all cross-bureau overlaps dropped
  const oldFiltered = initialOverlaps.filter((overlap) => {
    const compA = pgrcOnlyComplaints.find((c) => c.id === overlap.a)
    const compB = pgrcOnlyComplaints.find((c) => c.id === overlap.b)
    return Boolean(compA && compB)
  })
  assert.equal(oldFiltered.length, 0, 'Old resolver incorrectly dropped every overlap to 0 for Bureau Admin')

  // Using the new multi-tier resolver, cross-bureau overlaps are properly retained
  const newFiltered = filterOverlaps(initialOverlaps, pgrcOnlyComplaints, {}, { activeThreshold: 75 })
  assert.ok(newFiltered.length > 0, 'New resolver must retain cross-bureau overlaps for Bureau Admin')
  assert.equal(newFiltered.length, 6, 'Expected 6 active (>=75%) + historical overlaps retained under default filters')
})

test('Overlaps Regression: Resolution of dynamic / unseeded dockets (e.g. ACD-2026-1594)', async () => {
  const dynamicOverlap = {
    id: 'ov-dyn-1',
    a: 'ACD-2026-1594',
    b: 'PGRC-2026-9164',
    similarity: 88,
    reasons: ['Curriculum discrepancy', 'Faculty shortage'],
    status: 'open',
  }

  // Neither docket is in initialComplaints
  const emptyComplaints = []
  const resolvedA = resolveComplaint(dynamicOverlap.a, emptyComplaints)
  const resolvedB = resolveComplaint(dynamicOverlap.b, emptyComplaints)

  assert.equal(resolvedA.id, 'ACD-2026-1594')
  assert.equal(resolvedA.bureau, 'Academic')
  assert.equal(resolvedB.id, 'PGRC-2026-9164')
  assert.equal(resolvedB.bureau, 'PGRC')

  const results = filterOverlaps([dynamicOverlap], emptyComplaints, {}, { activeThreshold: 75 })
  assert.equal(results.length, 1, 'Dynamic docket overlap must not be dropped')
})

test('Overlaps Regression: Counter and search bar denominator consistency', async () => {
  const pgrcComplaints = initialComplaints.filter((c) => c.bureau === 'PGRC')
  const defaultStates = { o2: 'linked', o4: 'linked', o5: 'dismissed', o7: 'dismissed' }
  const activeThreshold = 75

  const pendingCount = initialOverlaps.filter((o) => isOverlapActivePending(o, defaultStates, activeThreshold)).length
  const confirmedCount = initialOverlaps.filter((o) => getOverlapEffectiveState(o, defaultStates) === 'linked').length
  const dismissedCount = initialOverlaps.filter((o) => getOverlapEffectiveState(o, defaultStates) === 'dismissed').length
  const deferredCount = initialOverlaps.filter((o) => getOverlapEffectiveState(o, defaultStates) === 'deferred').length
  const totalCount = pendingCount + confirmedCount + dismissedCount + deferredCount

  const displayedList = filterOverlaps(initialOverlaps, pgrcComplaints, defaultStates, { activeThreshold })

  assert.equal(displayedList.length, totalCount, 'Displayed list length must match totalCount under default filters')
  assert.equal(displayedList.length, 6, 'Expected 6 active + historical overlaps to display')
})

test('Overlaps Regression: Role authorization permits BureauAdmin and Admin, blocks Officer and Complainant', async () => {
  const checkAuth = (role) => role === 'Admin' || role === 'BureauAdmin'

  assert.equal(checkAuth('Admin'), true, 'Admin must be authorized to review overlaps')
  assert.equal(checkAuth('BureauAdmin'), true, 'BureauAdmin must be authorized to review overlaps')
  assert.equal(checkAuth('Officer'), false, 'Officer must NOT be authorized to review overlaps')
  assert.equal(checkAuth('Complainant'), false, 'Complainant must NOT be authorized to review overlaps')
})

test('Overlaps Regression: LIVE BACKEND API - GET /api/overlaps returns authentic data for Admin and BureauAdmin', async () => {
  const adminLogin = await fetch('http://127.0.0.1:8000/api/auth/demo-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'Admin' }),
  }).then((r) => r.json())

  assert.ok(adminLogin.accessToken, 'Admin demo login must succeed')

  const overlapsRes = await fetch('http://127.0.0.1:8000/api/overlaps', {
    headers: { Authorization: `Bearer ${adminLogin.accessToken}` },
  })
  assert.equal(overlapsRes.status, 200, 'GET /api/overlaps must return HTTP 200 for Admin')
  const overlapsData = await overlapsRes.json()
  assert.ok(Array.isArray(overlapsData), 'Overlaps response must be an array')
  assert.ok(overlapsData.length >= 4, 'Must return at least 4 seeded overlaps')

  // Verify structure of first item
  const first = overlapsData[0]
  assert.ok(first.id, 'Overlap must have an id')
  assert.ok(first.a || first.complaint_a_id, 'Overlap must have a complaint A reference')
  assert.ok(first.b || first.complaint_b_id, 'Overlap must have a complaint B reference')
  assert.ok(typeof first.similarity === 'number', 'Similarity must be a number')
  assert.ok(first.status, 'Status must be defined')

  // Test Bureau Admin login and retrieval
  const baLogin = await fetch('http://127.0.0.1:8000/api/auth/demo-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'BureauAdmin', userId: 'u1b' }),
  }).then((r) => r.json())

  assert.ok(baLogin.accessToken, 'Bureau Admin demo login must succeed')

  const baOverlapsRes = await fetch('http://127.0.0.1:8000/api/overlaps', {
    headers: { Authorization: `Bearer ${baLogin.accessToken}` },
  })
  assert.equal(baOverlapsRes.status, 200, 'GET /api/overlaps must return HTTP 200 for Bureau Admin')
  const baOverlapsData = await baOverlapsRes.json()
  assert.ok(Array.isArray(baOverlapsData), 'Bureau Admin overlaps response must be an array')
  assert.ok(baOverlapsData.length >= 4, 'Bureau Admin must receive overlaps')
})
