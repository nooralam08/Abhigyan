/**
 * Abhigyan Citizen Registration Integration Tests (Phase 1)
 * Validates public complainant registration, role restriction, validation,
 * and immediate sign-in capability.
 */

import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'

const BASE_URL = process.env.VITE_API_BASE_URL || process.env.VITE_API_URL || 'https://abhigyann.onrender.com/api'

let isServerUp = false

describe('Abhigyan Citizen Registration Client Integration (Phase 1)', () => {
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

  test('POST /api/auth/register creates citizen account and returns Complainant JWT', async (t) => {
    if (!isServerUp) return t.skip('Live FastAPI backend server not reachable at ' + BASE_URL)
    const uniqueEmail = `testcitizen_${Date.now()}@example.edu.in`
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ananya Deshmukh',
        email: uniqueEmail,
        password: 'SecurePass@2026',
        phone: '+91 98765 22222',
        complainantType: 'Student',
      }),
    })

    assert.equal(res.status, 201, 'Should return 201 Created')
    const data = await res.json()
    assert.ok(data.accessToken, 'Must return JWT accessToken')
    assert.equal(data.tokenType, 'bearer')
    assert.equal(data.user.name, 'Ananya Deshmukh')
    assert.equal(data.user.email, uniqueEmail)
    assert.equal(data.user.role, 'Complainant', 'Server must enforce Complainant role')
    assert.equal(data.user.bureau, 'All')
    assert.ok(data.user.id.startsWith('c-'), 'User ID must start with c- prefix')

    // Verify login with newly registered citizen account
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'SecurePass@2026',
      }),
    })
    assert.equal(loginRes.status, 200, 'Newly registered account must authenticate successfully')
    const loginData = await loginRes.json()
    assert.ok(loginData.accessToken)
    assert.equal(loginData.user.email, uniqueEmail)
    assert.equal(loginData.user.role, 'Complainant')
  })

  test('POST /api/auth/register prevents privilege escalation (ignores Admin/BureauAdmin requests)', async (t) => {
    if (!isServerUp) return t.skip('Live FastAPI backend server not reachable at ' + BASE_URL)
    const attackEmail = `attacker_${Date.now()}@example.com`
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Privilege Attacker',
        email: attackEmail,
        password: 'AttackerPassword@2026',
        role: 'Admin',
        bureau: 'RB',
      }),
    })

    assert.equal(res.status, 201)
    const data = await res.json()
    assert.equal(data.user.role, 'Complainant', 'Role MUST strictly be Complainant regardless of client input')
    assert.equal(data.user.bureau, 'All', 'Bureau MUST strictly be All')
  })

  test('POST /api/auth/register rejects duplicate email with 409 Conflict', async (t) => {
    if (!isServerUp) return t.skip('Live FastAPI backend server not reachable at ' + BASE_URL)
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rohit Sharma Duplicate',
        email: 'rohit.sharma@student.edu.in',
        password: 'ValidPassword123!',
      }),
    })

    assert.equal(res.status, 409, 'Should return 409 Conflict for duplicate email')
    const data = await res.json()
    assert.match(data.detail.toLowerCase(), /already registered/)
  })

  test('POST /api/auth/register rejects invalid input (invalid email, short password)', async (t) => {
    if (!isServerUp) return t.skip('Live FastAPI backend server not reachable at ' + BASE_URL)
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Valid Name',
        email: 'not-valid-email',
        password: '123',
      }),
    })

    assert.equal(res.status, 422, 'Should return 422 Unprocessable Entity')
  })
})
