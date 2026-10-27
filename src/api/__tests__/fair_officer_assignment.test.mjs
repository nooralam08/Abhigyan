import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getLeastLoadedOfficer,
  canViewComplaint,
  canAddCaseRemarks,
  canUpdateCaseStatus,
  resolveOfficerName,
  userProfiles,
} from '../../data.ts'

test('Fair Officer Assignment & Authoritative ID Scoping Suite', async (t) => {
  const officerRajesh = {
    id: 'u2',
    name: 'Rajesh Kumar',
    email: 'rajesh.kumar@aicte-india.org',
    role: 'Officer',
    designation: 'Senior Grievance Officer, PGRC',
    bureau: 'PGRC',
    status: 'Active',
  }

  const officerArun = {
    id: 'u6',
    name: 'Dr. Arun Sharma',
    email: 'arun.sharma@aicte-india.org',
    role: 'Officer',
    designation: 'Ombudsman & Grievance Officer, PGRC',
    bureau: 'PGRC',
    status: 'Active',
  }

  const officerPriya = {
    id: 'u7',
    name: 'Dr. Priya Nair',
    email: 'priya.nair@aicte-india.org',
    role: 'Officer',
    designation: 'Grievance Officer, PGRC',
    bureau: 'PGRC',
    status: 'Active',
  }

  const officerInactive = {
    id: 'u_inactive',
    name: 'Inactive Officer',
    email: 'inactive@aicte-india.org',
    role: 'Officer',
    designation: 'Former Officer',
    bureau: 'PGRC',
    status: 'Inactive',
  }

  const officerApproval = {
    id: 'u5',
    name: 'Suresh Patel',
    email: 'suresh.patel@aicte-india.org',
    role: 'Officer',
    designation: 'Scrutiny Officer, Approval Bureau',
    bureau: 'Approval',
    status: 'Active',
  }

  await t.test('1. Least-loaded officer is selected when workloads differ', () => {
    // Rajesh has 3 unresolved complaints
    const complaints = [
      { id: 'C1', bureau: 'PGRC', status: 'Pending', assignedUserId: 'u2', officer: 'Rajesh Kumar' },
      { id: 'C2', bureau: 'PGRC', status: 'In Progress', assignedUserId: 'u2', officer: 'Rajesh Kumar' },
      { id: 'C3', bureau: 'PGRC', status: 'Under Review', assignedUserId: 'u2', officer: 'Rajesh Kumar' },
      // Arun has 1 unresolved complaint
      { id: 'C4', bureau: 'PGRC', status: 'Pending', assignedUserId: 'u6', officer: 'Dr. Arun Sharma' },
      // Priya has 2 unresolved complaints
      { id: 'C5', bureau: 'PGRC', status: 'In Progress', assignedUserId: 'u7', officer: 'Dr. Priya Nair' },
      { id: 'C6', bureau: 'PGRC', status: 'Escalated', assignedUserId: 'u7', officer: 'Dr. Priya Nair' },
    ]

    const users = [officerRajesh, officerArun, officerPriya]
    const assigned = getLeastLoadedOfficer('PGRC', complaints, users)

    assert.equal(assigned.officer, 'Dr. Arun Sharma', 'Arun Sharma must be selected as lowest workload (1 case)')
    assert.equal(assigned.assignedUserId, 'u6', 'Must persist authoritative user ID u6')
  })

  await t.test('2. Rajesh Kumar is NOT preferentially selected when other officers are less loaded', () => {
    // Seed condition: Rajesh has 4 active cases, Arun has 1 active case
    const complaints = [
      { id: 'C1', bureau: 'PGRC', status: 'Pending', assignedUserId: 'u2', officer: 'Rajesh Kumar' },
      { id: 'C2', bureau: 'PGRC', status: 'In Progress', assignedUserId: 'u2', officer: 'Rajesh Kumar' },
      { id: 'C3', bureau: 'PGRC', status: 'Under Review', assignedUserId: 'u2', officer: 'Rajesh Kumar' },
      { id: 'C4', bureau: 'PGRC', status: 'Pending', assignedUserId: 'u2', officer: 'Rajesh Kumar' },
      { id: 'C5', bureau: 'PGRC', status: 'In Progress', assignedUserId: 'u6', officer: 'Dr. Arun Sharma' },
    ]

    const users = [officerRajesh, officerArun]
    const assigned = getLeastLoadedOfficer('PGRC', complaints, users)

    assert.notEqual(assigned.officer, 'Rajesh Kumar', 'Rajesh Kumar must not be selected')
    assert.equal(assigned.officer, 'Dr. Arun Sharma')
    assert.equal(assigned.assignedUserId, 'u6')
  })

  await t.test('3. Resolved cases do not count towards active workload', () => {
    // Rajesh has 10 resolved cases and 1 active case
    const complaints = [
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `CR-${i}`,
        bureau: 'PGRC',
        status: 'Resolved',
        assignedUserId: 'u2',
        officer: 'Rajesh Kumar',
      })),
      { id: 'CA-1', bureau: 'PGRC', status: 'Pending', assignedUserId: 'u2', officer: 'Rajesh Kumar' },
      // Arun has 2 active cases
      { id: 'CA-2', bureau: 'PGRC', status: 'Pending', assignedUserId: 'u6', officer: 'Dr. Arun Sharma' },
      { id: 'CA-3', bureau: 'PGRC', status: 'In Progress', assignedUserId: 'u6', officer: 'Dr. Arun Sharma' },
    ]

    const users = [officerRajesh, officerArun]
    const assigned = getLeastLoadedOfficer('PGRC', complaints, users)

    assert.equal(assigned.officer, 'Rajesh Kumar', 'Rajesh has active workload 1 vs Arun active workload 2')
    assert.equal(assigned.assignedUserId, 'u2')
  })

  await t.test('4. Rotating tie-breaker distributes ties fairly across repeated submissions', () => {
    let complaints = []
    const users = [officerRajesh, officerArun, officerPriya]
    const assignments = []

    for (let i = 0; i < 6; i++) {
      const assigned = getLeastLoadedOfficer('PGRC', complaints, users)
      assignments.push(assigned.assignedUserId)
      complaints.push({
        id: `NEW-${i}`,
        bureau: 'PGRC',
        status: 'Pending',
        assignedUserId: assigned.assignedUserId,
        officer: assigned.officer,
        date: `2026-10-${String(10 + i).padStart(2, '0')}`,
      })
    }

    const countRajesh = assignments.filter((id) => id === 'u2').length
    const countArun = assignments.filter((id) => id === 'u6').length
    const countPriya = assignments.filter((id) => id === 'u7').length

    assert.equal(countRajesh, 2, 'Rajesh receives exactly 2 cases over 6 submissions')
    assert.equal(countArun, 2, 'Arun receives exactly 2 cases over 6 submissions')
    assert.equal(countPriya, 2, 'Priya receives exactly 2 cases over 6 submissions')
  })

  await t.test('5. Inactive and wrong-bureau officers are strictly excluded', () => {
    const users = [
      officerInactive, // status: 'Inactive'
      officerApproval, // bureau: 'Approval'
      officerRajesh,   // bureau: 'PGRC', status: 'Active', workload: 5
    ]
    const complaints = Array.from({ length: 5 }, (_, i) => ({
      id: `C-${i}`,
      bureau: 'PGRC',
      status: 'Pending',
      assignedUserId: 'u2',
      officer: 'Rajesh Kumar',
    }))

    const assigned = getLeastLoadedOfficer('PGRC', complaints, users)
    assert.equal(assigned.officer, 'Rajesh Kumar', 'Rajesh is the only eligible active PGRC officer')
    assert.equal(assigned.assignedUserId, 'u2')
  })

  await t.test('6. Unassigned fallback when no active officer exists for bureau', () => {
    const users = [officerRajesh, officerArun] // Both PGRC
    const assigned = getLeastLoadedOfficer('SB', [], users) // SB bureau has no officers

    assert.equal(assigned.officer, 'Unassigned', 'Must return Unassigned')
    assert.equal(assigned.assignedUserId, undefined, 'assignedUserId must be undefined')
  })

  await t.test('7. Authoritative ID access enforcement in canViewComplaint & canAddCaseRemarks', () => {
    // Case reassigned to Dr. Arun Sharma, but old display name lingering
    const complaint = {
      id: 'PGRC-2026-9999',
      bureau: 'PGRC',
      category: 'Fee Regulation',
      priority: 'High',
      officer: 'Rajesh Kumar',      // Stale name
      assignedUserId: 'u6',          // Authoritative ID: Dr. Arun Sharma
      status: 'In Progress',
      date: '2026-10-10',
      due: '2026-10-30',
      title: 'Fee dispute',
      description: 'Fee regulation grievance',
      complainantName: 'Citizen',
      complainantEmail: 'citizen@gov.in',
    }

    // 1. New officer Arun Sharma (u6) has view and remark access
    const arunView = canViewComplaint(officerArun, complaint)
    assert.equal(arunView.allowed, true, 'Dr. Arun Sharma (u6) must be granted access')

    const arunRemarks = canAddCaseRemarks(officerArun, complaint)
    assert.equal(arunRemarks.allowed, true, 'Dr. Arun Sharma (u6) must be allowed to add remarks')

    // 2. Old officer Rajesh Kumar (u2) is strictly FORBIDDEN access despite name matching
    const rajeshView = canViewComplaint(officerRajesh, complaint)
    assert.equal(rajeshView.allowed, false, 'Old officer Rajesh Kumar must be denied view access')
    assert.match(rajeshView.reason, /not assigned to docket/i)

    const rajeshRemarks = canAddCaseRemarks(officerRajesh, complaint)
    assert.equal(rajeshRemarks.allowed, false, 'Old officer Rajesh Kumar must be denied remarks access')
    assert.match(rajeshRemarks.reason, /not assigned to docket/i)

    // 3. Status updates: Rajesh is blocked, Arun can update permitted transitions ('Escalated')
    const rajeshStatus = canUpdateCaseStatus(officerRajesh, complaint, 'Escalated')
    assert.equal(rajeshStatus.allowed, false, 'Old officer Rajesh Kumar cannot update status')

    const arunStatus = canUpdateCaseStatus(officerArun, complaint, 'Escalated')
    assert.equal(arunStatus.allowed, true, 'Authorized officer Dr. Arun Sharma can update status')
  })

  await t.test('8. Display name resolution preserves authoritative officer from assignedUserId', () => {
    const complaint = {
      id: 'PGRC-2026-9999',
      assignedUserId: 'u6',
      officer: 'Rajesh Kumar', // Stale
    }
    const resolved = resolveOfficerName(complaint, [officerRajesh, officerArun])
    assert.equal(resolved, 'Dr. Arun Sharma', 'Must resolve name to authoritative user corresponding to assignedUserId')
  })
})
