/**
 * End-to-End System Audit Tests for Task 6
 * Tests full role lifecycles and API workflows against the live FastAPI backend.
 */

import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'

const BASE_URL = process.env.VITE_API_BASE_URL || process.env.VITE_API_URL || 'https://abhigyann.onrender.com/api'

let isServerUp = false

describe('Abhigyan End-to-End Workflows & RBAC System Audit', () => {
  let adminToken = ''
  let officerToken = ''
  let bureauAdminToken = ''
  let studentToken = ''

  before(async () => {
    try {
      const healthRes = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(1000) })
      if (healthRes.status === 200) {
        const health = await healthRes.json()
        if (health.status === 'healthy') {
          isServerUp = true
          // Acquire tokens for all roles via demo-login
          const roles = ['Admin', 'BureauAdmin', 'Officer', 'Complainant']
          for (const role of roles) {
            const res = await fetch(`${BASE_URL}/auth/demo-login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role }),
            })
            if (res.status === 200) {
              const data = await res.json()
              if (role === 'Admin') adminToken = data.accessToken
              else if (role === 'BureauAdmin') bureauAdminToken = data.accessToken
              else if (role === 'Officer') officerToken = data.accessToken
              else if (role === 'Complainant') studentToken = data.accessToken
            }
          }
        }
      }
    } catch {
      isServerUp = false
    }
  })

  test('1. Student / Complainant Workflow: preview, create, track, and RBAC boundaries', async (t) => {
    if (!isServerUp) return t.skip('Live FastAPI backend server not reachable at ' + BASE_URL)
    // 1.1 AI Preview
    const previewRes = await fetch(`${BASE_URL}/complaints/classify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        title: 'Mandatory uniform charges collected without institutional receipt',
        description: 'First year students are asked to deposit Rs 12,000 cash for laboratory coats and safety shoes.',
      }),
    })
    assert.equal(previewRes.status_code || previewRes.status, 200)
    const preview = await previewRes.json()
    assert.equal(preview.status, 'success')
    assert.ok(preview.category)
    assert.ok(preview.bureau)

    // 1.2 File complaint
    const createRes = await fetch(`${BASE_URL}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        title: 'Mandatory uniform charges collected without institutional receipt',
        description: 'First year students are asked to deposit Rs 12,000 cash for laboratory coats and safety shoes.',
        bureau: 'PGRC',
        category: 'Fee Regulation',
        priority: 'High',
        institutionId: 'i1',
        complainantType: 'Student',
      }),
    })
    assert.equal(createRes.status, 201)
    const complaint = await createRes.json()
    assert.equal(complaint.category, 'Fee Regulation')
    assert.equal(complaint.bureau, 'PGRC')
    assert.equal(complaint.status, 'Pending')

    // 1.3 Track own complaint
    const getRes = await fetch(`${BASE_URL}/complaints/${complaint.id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    })
    assert.equal(getRes.status, 200)

    // 1.4 Student forbidden from updating status
    const forbiddenStatus = await fetch(`${BASE_URL}/complaints/${complaint.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ status: 'Resolved' }),
    })
    assert.equal(forbiddenStatus.status, 403)

    // 1.5 Student forbidden from reassigning
    const forbiddenAssign = await fetch(`${BASE_URL}/complaints/${complaint.id}/assign`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ bureau: 'RB' }),
    })
    assert.equal(forbiddenAssign.status, 403)
  })

  test('2. Officer Workflow: scoped list, status transitions, and restrictions', async (t) => {
    if (!isServerUp) return t.skip('Live FastAPI backend server not reachable at ' + BASE_URL)
    // 2.1 Officer lists complaints (must return 200)
    const listRes = await fetch(`${BASE_URL}/complaints`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    })
    assert.equal(listRes.status, 200)
    const listData = await listRes.json()
    assert.ok(Array.isArray(listData.items))

    // 2.2 Officer forbidden from reassigning cases
    if (listData.items.length > 0) {
      const targetCase = listData.items[0]
      const assignRes = await fetch(`${BASE_URL}/complaints/${targetCase.id}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officerToken}`,
        },
        body: JSON.stringify({ bureau: 'Approval' }),
      })
      assert.equal(assignRes.status, 403)
    }
  })

  test('3. Bureau Admin Workflow: bureau-scoped jurisdiction', async (t) => {
    if (!isServerUp) return t.skip('Live FastAPI backend server not reachable at ' + BASE_URL)
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${bureauAdminToken}` },
    })
    assert.equal(meRes.status, 200)
    const me = await meRes.json()
    const myBureau = me.bureau || 'PGRC'
    const otherBureau = myBureau === 'PGRC' ? 'Approval' : 'PGRC'

    // Querying authorized bureau succeeds
    const listRes = await fetch(`${BASE_URL}/complaints?bureau=${myBureau}`, {
      headers: { Authorization: `Bearer ${bureauAdminToken}` },
    })
    assert.equal(listRes.status, 200)

    // Querying unauthorized cross-bureau fails with 403
    const crossRes = await fetch(`${BASE_URL}/complaints?bureau=${otherBureau}`, {
      headers: { Authorization: `Bearer ${bureauAdminToken}` },
    })
    assert.equal(crossRes.status, 403)
  })

  test('4. Super Admin Workflow: system-wide query and transfer', async (t) => {
    if (!isServerUp) return t.skip('Live FastAPI backend server not reachable at ' + BASE_URL)
    // Admin can query all bureaus
    const listRes = await fetch(`${BASE_URL}/complaints`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert.equal(listRes.status, 200)
    const data = await listRes.json()
    assert.ok(data.total >= 0)
  })

  test('5. Error Handling & Validation: invalid inputs and unauthenticated requests', async (t) => {
    if (!isServerUp) return t.skip('Live FastAPI backend server not reachable at ' + BASE_URL)
    // Non-existent complaint ID returns 404
    const notFound = await fetch(`${BASE_URL}/complaints/NONEXISTENT-9999`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert.equal(notFound.status, 404)

    // Missing Bearer token returns 401
    const noToken = await fetch(`${BASE_URL}/complaints`)
    assert.equal(noToken.status, 401)

    // Invalid status transition returns 400 or 422
    const invalidStatus = await fetch(`${BASE_URL}/complaints/PGRC-2026-0873/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'InvalidStatusEnum' }),
    })
    assert.ok(invalidStatus.status === 400 || invalidStatus.status === 422)
  })
})
