import type {
  Complaint,
  Institution,
  Overlap,
  Bureau,
  Priority,
  Status,
  AppNotification,
  AppSettings,
  UserProfile,
} from './types'

export const TODAY = '2026-10-25'
export const OFFICERS = ['Anita Verma', 'Rajesh Kumar', 'Meera Iyer', 'Suresh Patel', 'Dr. Arun Sharma']
export const CURRENT_OFFICER = 'Rajesh Kumar'
export const STATUSES: Status[] = ['Pending', 'In Progress', 'Escalated', 'Resolved']
export const BUREAUS: Bureau[] = ['RB', 'PGRC', 'Approval', 'Academic', 'SB', 'EO']

export const BUREAU_INFO: Record<Bureau, { name: string; desc: string; badgeClass: string }> = {
  RB: {
    name: 'Regulation Bureau (RB)',
    desc: 'Ensures compliance with AICTE regulatory norms, fee structures, and intake limits.',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  PGRC: {
    name: 'Public Grievance Redressal Cell (PGRC)',
    desc: 'Handles student, parent, and faculty complaints, mistreatment, and fee grievances.',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  Approval: {
    name: 'Approval Bureau',
    desc: 'Manages institution approvals, extension of approvals (EoA), and infrastructure criteria.',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  Academic: {
    name: 'Academic Bureau',
    desc: 'Oversees model curricula, faculty standards, academic calendar, and syllabus.',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  SB: {
    name: 'Skill Bureau (SB)',
    desc: 'Coordinates vocational training, apprenticeships, and skill accreditation.',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  EO: {
    name: 'Executive Office (EO)',
    desc: 'Deals with high-priority statutory oversight, legal inquiries, and ministry references.',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
}

export const institutions: Institution[] = [
  {
    id: 'i1',
    name: 'Sunrise Institute of Technology',
    city: 'Pune',
    state: 'Maharashtra',
    type: 'Engineering',
    aicteId: '1-4821039',
    approved: '2009',
    contactEmail: 'principal@sunrise-tech.edu.in',
    contactPhone: '+91 20 2748 9901',
    totalComplaints: 6,
    activeComplaints: 3,
    riskLevel: 'High',
  },
  {
    id: 'i2',
    name: 'Bharat College of Engineering',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    type: 'Engineering',
    aicteId: '1-3390412',
    approved: '2004',
    contactEmail: 'director@bharatengg.ac.in',
    contactPhone: '+91 522 289 1102',
    totalComplaints: 5,
    activeComplaints: 2,
    riskLevel: 'Moderate',
  },
  {
    id: 'i3',
    name: 'Vidya Polytechnic Institute',
    city: 'Jaipur',
    state: 'Rajasthan',
    type: 'Polytechnic',
    aicteId: '1-5120987',
    approved: '2012',
    contactEmail: 'admin@vidyapoly.edu.in',
    contactPhone: '+91 141 298 3341',
    totalComplaints: 4,
    activeComplaints: 1,
    riskLevel: 'Moderate',
  },
  {
    id: 'i4',
    name: 'National Institute of Management Studies',
    city: 'Bengaluru',
    state: 'Karnataka',
    type: 'Management',
    aicteId: '1-2784561',
    approved: '2001',
    contactEmail: 'registrar@nims-blr.ac.in',
    contactPhone: '+91 80 4123 7789',
    totalComplaints: 5,
    activeComplaints: 2,
    riskLevel: 'High',
  },
  {
    id: 'i5',
    name: 'Gyan Jyoti Institute of Pharmacy',
    city: 'Ghaziabad',
    state: 'Uttar Pradesh',
    type: 'Pharmacy',
    aicteId: '1-6045123',
    approved: '2015',
    contactEmail: 'info@gyanjyotipharma.org',
    contactPhone: '+91 120 488 2011',
    totalComplaints: 3,
    activeComplaints: 0,
    riskLevel: 'Low',
  },
  {
    id: 'i6',
    name: 'Himalaya Technical University',
    city: 'Dehradun',
    state: 'Uttarakhand',
    type: 'University',
    aicteId: '1-7210045',
    approved: '2018',
    contactEmail: 'vc-office@himalayatech.ac.in',
    contactPhone: '+91 135 277 8890',
    totalComplaints: 4,
    activeComplaints: 2,
    riskLevel: 'High',
  },
  {
    id: 'i7',
    name: 'Kalinga School of Architecture',
    city: 'Bhubaneswar',
    state: 'Odisha',
    type: 'Architecture',
    aicteId: '1-8930124',
    approved: '2011',
    contactEmail: 'dean@kalinga-arch.edu.in',
    contactPhone: '+91 674 233 4455',
    totalComplaints: 2,
    activeComplaints: 1,
    riskLevel: 'Low',
  },
]

const addDays = (d: string, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x.toISOString().slice(0, 10)
}

type RowData = [
  string, // id
  string, // instId
  Bureau, // bureau
  string, // category
  Priority, // priority
  string, // officer
  Status, // status
  string, // date
  string, // due
  string, // title
  string, // description
  'Student' | 'Faculty' | 'Parent' | 'Whistleblower' | 'General Public', // complainantType
]

const rawRows: RowData[] = [
  [
    'RB-2026-0141',
    'i1',
    'RB',
    'Fee Regulation',
    'Critical',
    'Anita Verma',
    'Pending',
    '2026-09-28',
    '2026-10-12',
    'Excess tuition fee collected above approved regulatory cap',
    'Parents allege the institute collects tuition roughly 40% above the fee approved by the state Fee Regulatory Committee, with no formal receipts issued for the additional amount.',
    'Parent',
  ],
  [
    'PGRC-2026-0873',
    'i1',
    'PGRC',
    'Fee Regulation',
    'High',
    'Rajesh Kumar',
    'In Progress',
    '2026-10-02',
    '2026-10-30',
    'Students report compulsory "development charges" exceeding fee norm',
    'A group of third-year B.Tech students submitted a formal grievance stating the 2026-27 fee notice exceeds the approved schedule by Rs 35,000 under mandatory development charges.',
    'Student',
  ],
  [
    'RB-2026-0152',
    'i2',
    'RB',
    'Faculty Norms',
    'High',
    'Meera Iyer',
    'In Progress',
    '2026-10-01',
    '2026-10-25',
    'Severe faculty shortage in Computer Science Department',
    'Whistleblower complaint with staff roster stating the CSE department operates at only 42% of required cadre ratio; ghost faculty signatures observed in biometric submissions.',
    'Whistleblower',
  ],
  [
    'PGRC-2026-0890',
    'i2',
    'PGRC',
    'Faculty Norms',
    'Medium',
    'Rajesh Kumar',
    'Pending',
    '2026-10-05',
    '2026-11-02',
    'Core subjects skipped due to unavailability of qualified faculty',
    'CSE 5th semester students petition that AI and Cloud Computing lab sessions have been stalled for over 6 weeks due to resignations not filled by the management.',
    'Student',
  ],
  [
    'AB-2026-0310',
    'i3',
    'Approval',
    'Infrastructure',
    'Medium',
    'Suresh Patel',
    'Resolved',
    '2026-08-14',
    '2026-09-14',
    'Laboratory machinery and licensed software shortfall',
    'Scrutiny committee found deficiencies in CAD software licenses and CNC machines versus declared figures. Institute has procured licenses and submitted compliance evidence.',
    'General Public',
  ],
  [
    'RB-2026-0166',
    'i3',
    'RB',
    'Infrastructure',
    'Critical',
    'Anita Verma',
    'Escalated',
    '2026-10-08',
    '2026-10-20',
    'Hostel fire safety non-compliance and overcrowding',
    'Municipal fire clearance was revoked in August 2026. The boys hostel houses 180 students beyond structural design limit with obstructed fire escape staircases.',
    'Whistleblower',
  ],
  [
    'PGRC-2026-0902',
    'i4',
    'PGRC',
    'Admission Irregularity',
    'High',
    'Rajesh Kumar',
    'Pending',
    '2026-10-10',
    '2026-11-05',
    'Direct MBA admissions bypassing centralised state counselling',
    'Candidate claims management demanded Rs 2.5 Lakh cash donation for an MBA seat outside the designated CAT/CMAT institutional round.',
    'Student',
  ],
  [
    'RB-2026-0171',
    'i4',
    'RB',
    'Admission Irregularity',
    'High',
    'Meera Iyer',
    'Pending',
    '2026-10-11',
    '2026-10-22',
    'Management quota seat intake exceeded sanctioned threshold',
    'Investigation referral that total sanctioned intake of 120 seats was breached, with 148 candidates enrolled in the 2026 MBA batch.',
    'Whistleblower',
  ],
  [
    'PGRC-2026-0915',
    'i5',
    'PGRC',
    'Certificate Delay',
    'Low',
    'Suresh Patel',
    'Resolved',
    '2026-09-20',
    '2026-10-10',
    'Withholding of B.Pharm provisional degree and migration documents',
    'Graduate was denied clearance certificates citing pending alumni association contribution. Notice served; institute has released all credentials.',
    'Student',
  ],
  [
    'ACD-2026-0044',
    'i5',
    'Academic',
    'Curriculum',
    'Low',
    'Meera Iyer',
    'Resolved',
    '2026-09-02',
    '2026-10-02',
    'Failure to implement AICTE Model Curriculum 2024 revision',
    'Faculty complaint that college continues teaching outdated 2019 syllabus ignoring PCI and AICTE revised elective modules. Syllabus alignment verified.',
    'Faculty',
  ],
  [
    'RB-2026-0180',
    'i6',
    'RB',
    'Unapproved Courses',
    'Critical',
    'Anita Verma',
    'In Progress',
    '2026-10-15',
    '2026-10-28',
    'Operating unapproved M.Tech in Data Science & Cyber Security',
    'Admissions enrolled 45 candidates for an M.Tech program without obtaining approval in the current approval process handbook cycle.',
    'Whistleblower',
  ],
  [
    'PGRC-2026-0921',
    'i6',
    'PGRC',
    'Unapproved Courses',
    'High',
    'Rajesh Kumar',
    'In Progress',
    '2026-10-16',
    '2026-11-08',
    'Enrolled students demand refund and transfer for unapproved degree',
    'Students discovered their course is not listed on the AICTE portal and petitioned PGRC for immediate refund of first semester tuition and migration assistance.',
    'Student',
  ],
  [
    'PGRC-2026-0930',
    'i2',
    'PGRC',
    'Harassment & Ragging',
    'Critical',
    'Dr. Arun Sharma',
    'Escalated',
    '2026-10-18',
    '2026-10-23',
    'Failure of Institutional Anti-Ragging Committee to respond to complaint',
    'First-year student submitted police report extract alleging systemic harassment in hostel block 3 without action by the college anti-ragging squad.',
    'Student',
  ],
  [
    'AB-2026-0322',
    'i1',
    'Approval',
    'Infrastructure',
    'Low',
    'Rajesh Kumar',
    'Pending',
    '2026-10-19',
    '2026-11-12',
    'Library digital access and volume count below mandatory norm',
    'Complaint notes e-journal subscriptions expired in June and reading hall area does not meet 400 sq. meter requirement.',
    'Faculty',
  ],
  [
    'SB-2026-0051',
    'i7',
    'SB',
    'Skill Certification',
    'Medium',
    'Anita Verma',
    'In Progress',
    '2026-10-14',
    '2026-11-04',
    'B.Des interior design apprenticeship stipend deduction grievance',
    'Trainees under the NEAT initiative report unauthorized deduction of 30% from the mandated monthly government stipend.',
    'Student',
  ],
]

const defaultNextAction = (status: Status, bureau: Bureau): string => {
  if (status === 'Pending') return `Jurisdiction verification and preliminary scrutiny by ${bureau} Cell`
  if (status === 'In Progress') return 'Examine institution counter-affidavit and verify official registers'
  if (status === 'Escalated') return 'Convene expedited joint hearing with institution management'
  return 'Final compliance order signed and archived'
}

const getSampleDocuments = (id: string, complainantType: string, officer: string): import('./types').CaseDocument[] => [
  {
    id: `doc-${id}-1`,
    name: 'Grievance_Affidavit_and_Supporting_Facts.pdf',
    size: '1.4 MB',
    uploadDate: '2026-10-18',
    uploadedBy: complainantType === 'Student' ? 'Rohit Sharma (Complainant)' : `${complainantType} Complainant`,
    uploaderRole: 'Complainant',
    visibility: 'Public',
    fileType: 'application/pdf',
  },
  {
    id: `doc-${id}-2`,
    name: 'Institution_Notice_or_Fee_Circular.pdf',
    size: '850 KB',
    uploadDate: '2026-10-19',
    uploadedBy: complainantType === 'Student' ? 'Rohit Sharma (Complainant)' : `${complainantType} Complainant`,
    uploaderRole: 'Complainant',
    visibility: 'Public',
    fileType: 'application/pdf',
  },
  {
    id: `doc-${id}-3`,
    name: 'Bureau_Internal_Scrutiny_Memo.pdf',
    size: '340 KB',
    uploadDate: '2026-10-21',
    uploadedBy: `${officer} (Handling Officer)`,
    uploaderRole: 'Officer',
    visibility: 'Internal',
    fileType: 'application/pdf',
  },
]

export const initialComplaints: Complaint[] = rawRows.map(
  ([id, institutionId, bureau, category, priority, officer, status, date, due, title, description, complainantType]) => {
    const timeline: import('./types').TimelineEvent[] = [
      { label: 'Complaint registered and verified on AICTE portal', date, by: 'System / Portal', role: 'Complainant' },
      { label: `Assigned to ${officer} (${bureau} Bureau)`, date: addDays(date, 1), by: 'Admin (Dr. S. Mehta)', role: 'Admin' },
    ]
    if (status !== 'Pending') {
      timeline.push({
        label: status === 'Resolved' ? 'Investigation complete & Marked Resolved' : `Case status updated to ${status}`,
        date: addDays(date, 3),
        by: officer,
        role: 'Officer',
        note: status === 'Escalated' ? 'Escalated to Bureau Head due to SLA breach and severity.' : undefined,
      })
    }
    const inst = institutions.find((i) => i.id === institutionId)
    const instAicteId = inst?.aicteId || '1-4821039'
    const docs = getSampleDocuments(id, complainantType, officer)

    return {
      id,
      institutionId,
      institutionPermanentId: instAicteId,
      bureau,
      category,
      priority,
      officer,
      assignedUserId:
        officer === 'Anita Verma'
          ? 'u3'
          : officer === 'Rajesh Kumar'
          ? 'u2'
          : officer === 'Meera Iyer'
          ? 'u4'
          : officer === 'Suresh Patel'
          ? 'u5'
          : officer === 'Dr. Arun Sharma'
          ? 'u6'
          : undefined,
      status,
      date,
      due,
      title,
      description,
      complainantType,
      complainantName:
        complainantType === 'Student'
          ? 'Rohit Sharma'
          : complainantType === 'Faculty'
          ? 'Dr. K. Ramanathan'
          : complainantType === 'Parent'
          ? 'S. Sundaram'
          : 'Verified Whistleblower',
      complainantEmail:
        complainantType === 'Student' ? 'rohit.sharma@student.edu.in' : 'citizen.grievance@aicte-portal.in',
      attachmentsCount: docs.length,
      documents: docs,
      timeline,
      assignments: [
        {
          officer,
          previousOfficer: 'Intake Registration Cell',
          date: addDays(date, 1),
          by: 'Dr. S. Mehta',
          byRole: 'Admin',
          reason: `Initial statutory assignment to ${bureau} Bureau based on subject classification.`,
          bureau,
          type: 'initial',
        },
      ],
      reassignmentRequests:
        id === 'PGRC-2026-0873'
          ? [
              {
                id: 'req-2026-001',
                requestedBy: 'Rajesh Kumar',
                requestedByRole: 'Officer',
                requestDate: '2026-10-24 15:30',
                type: 'bureau',
                currentOfficer: 'Rajesh Kumar',
                currentBureau: 'PGRC',
                proposedBureau: 'RB',
                proposedOfficer: 'Anita Verma',
                reason:
                  'Investigation confirms institutional fee schedule violates state FRC notification cap; statutory determination falls under Regulation Bureau jurisdiction.',
                status: 'Pending',
              },
            ]
          : undefined,
      nextAction: defaultNextAction(status, bureau),
      lastActionDate: timeline[timeline.length - 1]?.date || date,
    }
  }
)

export type OverlapReviewState = 'linked' | 'dismissed' | 'deferred'

/**
 * Resolves the effective review state of an overlap, prioritizing session/persisted state,
 * followed by any authoritative backend or initial decision, defaulting to 'open'.
 */
export function getOverlapEffectiveState(
  overlap: Overlap,
  states?: Record<string, OverlapReviewState | undefined>
): OverlapReviewState | 'open' {
  if (states && states[overlap.id]) {
    return states[overlap.id]!
  }
  if (overlap.status && overlap.status !== 'open' && overlap.status !== 'pending') {
    return overlap.status as OverlapReviewState
  }
  return 'open'
}

/**
 * Determines whether an overlap represents a historical decision (Confirmed Related, Dismissed, or Deferred).
 */
export function isOverlapHistorical(
  overlap: Overlap,
  states?: Record<string, OverlapReviewState | undefined>
): boolean {
  const effective = getOverlapEffectiveState(overlap, states)
  return effective === 'linked' || effective === 'dismissed' || effective === 'deferred'
}

/**
 * Determines whether an overlap is an active pending candidate in the review queue.
 * Historical decisions NEVER count as pending. Only unreviewed open candidates meeting the threshold qualify.
 */
export function isOverlapActivePending(
  overlap: Overlap,
  states: Record<string, OverlapReviewState | undefined> | undefined,
  threshold: number
): boolean {
  const effective = getOverlapEffectiveState(overlap, states)
  return effective === 'open' && overlap.similarity >= threshold
}

export const overlaps: Overlap[] = [
  {
    id: 'o1',
    a: 'RB-2026-0141',
    b: 'PGRC-2026-0873',
    similarity: 94,
    reasons: [
      'Same Institution: Sunrise Institute of Technology (Pune)',
      'Both complaints cite excessive tuition fee demands and unapproved development levies',
      'Both submitted within 4 calendar days of each other',
      'Matching keywords: "tuition fee", "approved fee cap", "development charges"',
    ],
    status: 'pending',
    notes: 'Recommend joint inquiry by RB and PGRC to issue a consolidated show-cause notice.',
  },
  {
    id: 'o2',
    a: 'RB-2026-0152',
    b: 'PGRC-2026-0890',
    similarity: 88,
    reasons: [
      'Same Institution: Bharat College of Engineering (Lucknow)',
      'Shared Department: Computer Science & Engineering (CSE)',
      'RB complaint concerns faculty roster/cadre shortfall; PGRC complaint details stalled lab lectures caused by that exact vacancy',
      'Direct causal link between regulatory non-compliance and student grievance',
    ],
    status: 'linked',
    notes: 'Linked as Joint Docket #JD-2026-88. Inquiry officer assigned to verify biometric records.',
  },
  {
    id: 'o3',
    a: 'RB-2026-0171',
    b: 'PGRC-2026-0902',
    similarity: 91,
    reasons: [
      'Same Institution: National Institute of Management Studies (Bengaluru)',
      'Shared Category: Admission Irregularities in MBA program',
      'Matching evidence: Unapproved intake extension coincides with direct donation demands',
      'Filed within 24 hours of each other',
    ],
    status: 'pending',
    notes: 'Urgent overlap: Possible unauthorised admissions racket.',
  },
  {
    id: 'o4',
    a: 'RB-2026-0180',
    b: 'PGRC-2026-0921',
    similarity: 92,
    reasons: [
      'Same Institution: Himalaya Technical University (Dehradun)',
      'Identical course: M.Tech in Data Science & Cyber Security',
      'RB filed by staff whistleblower regarding lack of approval; PGRC filed by enrolled students demanding fee refund',
      'Critical risk: Degrees at jeopardy for 45 students',
    ],
    status: 'linked',
    notes: 'Consolidated into single hearing committee scheduled for 28-Oct-2026.',
  },
  {
    id: 'o5',
    a: 'RB-2026-0141',
    b: 'AB-2026-0322',
    similarity: 52,
    reasons: [
      'Same Institution: Sunrise Institute of Technology',
      'Different subject matter: Tuition fee vs library infrastructure criteria',
      'May indicate overall institutional governance stress',
    ],
    status: 'dismissed',
    notes: 'Different bureaus and unrelated topics; kept as separate case files.',
  },
  {
    id: 'o6',
    a: 'AB-2026-0310',
    b: 'RB-2026-0166',
    similarity: 74,
    reasons: [
      'Same Institution: Vidya Polytechnic Institute (Jaipur)',
      'Approval scrutiny and Regulation Bureau complaint both cite physical campus infrastructure deficiencies',
      'Filings occurred within 55 calendar days of each other',
      'Corroborates campus-wide physical infrastructure deficit',
    ],
    status: 'pending',
    notes: 'Moderate overlap: Recommend cross-bureau inspection sharing between Approval Bureau and Regulation Bureau.',
  },
  {
    id: 'o7',
    a: 'PGRC-2026-0930',
    b: 'RB-2026-0152',
    similarity: 34,
    reasons: [
      'Same Institution: Bharat College of Engineering (Lucknow)',
      'Distinct subject matter: Hostel anti-ragging squad inaction vs Computer Science faculty roster vacancies',
      'Different departments, timelines, and reporting stakeholders',
    ],
    status: 'dismissed',
    notes: 'Independent incidents with unrelated fact patterns. Kept strictly separate.',
  },
]

export const initialNotifications: AppNotification[] = [
  {
    id: 'notif-1',
    type: 'alert',
    title: 'High-Risk Overlap Flagged (94% Match)',
    message: 'Abhigyan detected overlapping fee complaints for Sunrise Institute of Technology in RB and PGRC.',
    timestamp: '2026-10-24 16:30',
    caseId: 'RB-2026-0141',
    read: false,
  },
  {
    id: 'notif-2',
    type: 'warning',
    title: 'SLA Alert: Case RB-2026-0141 Overdue',
    message:
      'Case RB-2026-0141 has exceeded the configured 14-day resolution window (demonstration threshold) by 13 days.',
    timestamp: '2026-10-24 11:15',
    caseId: 'RB-2026-0141',
    read: false,
  },
  {
    id: 'notif-3',
    type: 'alert',
    title: 'Escalation: Anti-Ragging Cell Intervention',
    message: 'Case PGRC-2026-0930 at Bharat College of Engineering escalated directly to Bureau Head.',
    timestamp: '2026-10-23 18:45',
    caseId: 'PGRC-2026-0930',
    read: false,
  },
  {
    id: 'notif-4',
    type: 'success',
    title: 'Compliance Verified: Lab shortfalls rectified',
    message: 'Institution Vidya Polytechnic submitted verified receipts and licenses for AB-2026-0310.',
    timestamp: '2026-10-22 14:10',
    caseId: 'AB-2026-0310',
    read: true,
  },
  {
    id: 'notif-5',
    type: 'info',
    title: 'Monthly AICTE Bureau Performance Report Generated',
    message: 'October 2026 complaint resolution analytics now compiled across RB, PGRC, Approval, and Academic bureaus.',
    timestamp: '2026-10-21 09:00',
    read: true,
  },
]

export const userProfiles: UserProfile[] = [
  {
    id: 'u0',
    name: 'Rohit Sharma',
    email: 'rohit.sharma@student.edu.in',
    role: 'Complainant',
    designation: 'Student Complainant (Citizen User)',
    bureau: 'PGRC',
    avatarText: 'RS',
    phone: '+91 98765 43210',
    activeCasesCount: 2,
    status: 'Active',
    department: 'Complainant / Citizen Portal',
  },
  {
    id: 'u1b',
    name: 'Dr. Priya Nair',
    email: 'priya.nair@aicte-india.org',
    role: 'BureauAdmin',
    designation: 'Bureau Chief & Cell Admin (PGRC)',
    bureau: 'PGRC',
    avatarText: 'PN',
    phone: '+91 11 2958 1020',
    activeCasesCount: 6,
    status: 'Active',
    department: 'Public Grievance Redressal Cell',
  },
  {
    id: 'u2',
    name: 'Rajesh Kumar',
    email: 'rajesh.kumar@aicte-india.org',
    role: 'Officer',
    designation: 'Senior Grievance Officer, PGRC',
    bureau: 'PGRC',
    avatarText: 'RK',
    phone: '+91 11 2958 1042',
    activeCasesCount: 5,
    status: 'Active',
    department: 'PGRC Scrutiny Cell',
  },
  {
    id: 'u1',
    name: 'Dr. S. Mehta',
    email: 'member-sec@aicte-india.org',
    role: 'Admin',
    designation: 'Member Secretary & System Admin',
    bureau: 'All',
    avatarText: 'SM',
    phone: '+91 11 2958 1000',
    activeCasesCount: 15,
    status: 'Active',
    department: 'Executive Administration',
  },
  {
    id: 'u3',
    name: 'Anita Verma',
    email: 'anita.verma@aicte-india.org',
    role: 'Officer',
    designation: 'Director & Bureau Chief, RB',
    bureau: 'RB',
    avatarText: 'AV',
    phone: '+91 11 2958 1077',
    activeCasesCount: 4,
    status: 'Active',
  },
  {
    id: 'u4',
    name: 'Meera Iyer',
    email: 'meera.iyer@aicte-india.org',
    role: 'Officer',
    designation: 'Legal Counsel & Officer, RB / Academic',
    bureau: 'RB',
    avatarText: 'MI',
    phone: '+91 11 2958 1091',
    activeCasesCount: 3,
    status: 'Active',
  },
  {
    id: 'u5',
    name: 'Suresh Patel',
    email: 'suresh.patel@aicte-india.org',
    role: 'Officer',
    designation: 'Scrutiny Officer, Approval Bureau',
    bureau: 'Approval',
    avatarText: 'SP',
    phone: '+91 11 2958 1115',
    activeCasesCount: 2,
    status: 'Active',
  },
  {
    id: 'u6',
    name: 'Dr. Arun Sharma',
    email: 'arun.sharma@aicte-india.org',
    role: 'Officer',
    designation: 'Special Inquiries Officer, PGRC',
    bureau: 'PGRC',
    avatarText: 'AS',
    phone: '+91 11 2958 1130',
    activeCasesCount: 1,
    status: 'Active',
  },
]

// Helper functions
export const fmt = (d: string) => {
  try {
    const parts = d.split('-')
    if (parts.length === 3) {
      const year = parts[0]
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const month = monthNames[parseInt(parts[1], 10) - 1] || parts[1]
      const day = parts[2]
      return `${day} ${month} ${year}`
    }
    return d
  } catch {
    return d
  }
}

export const instName = (id: string) => institutions.find((i) => i.id === id)?.name ?? 'Unknown Institute'
export const getInstitution = (id: string) => institutions.find((i) => i.id === id)

export const isOverdue = (c: Complaint) => {
  if (c.status === 'Resolved') return false
  return c.due < TODAY
}

export const getDaysRemaining = (due: string) => {
  const target = new Date(due).getTime()
  const current = new Date(TODAY).getTime()
  const diffDays = Math.round((target - current) / (1000 * 3600 * 24))
  return diffDays
}

// Storage keys for settings and users
export const SETTINGS_STORAGE_KEY = 'abhigyan_settings'
export const USER_STORAGE_KEY = 'abhigyan_users'

export const DEFAULT_SETTINGS: AppSettings = {
  similarityThreshold: 75,
  slaCritical: 3,
  slaHigh: 7,
  slaMedium: 14,
  autoEscalate: true,
  emailAlerts: true,
}

export const getAppSettings = (): AppSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
      }
    }
  } catch {}
  return DEFAULT_SETTINGS
}

export const getSlaDaysForPriority = (priority: Priority, customSettings?: AppSettings): number => {
  const cfg = customSettings || getAppSettings()
  switch (priority) {
    case 'Critical':
      return Math.max(1, cfg.slaCritical)
    case 'High':
      return Math.max(1, cfg.slaHigh)
    case 'Medium':
      return Math.max(1, cfg.slaMedium)
    case 'Low':
    default:
      return Math.max(cfg.slaMedium + 7, 21)
  }
}

// Bureau Officer Rosters
export const BUREAU_OFFICERS: Record<Bureau, string[]> = {
  RB: ['Anita Verma', 'Meera Iyer'],
  PGRC: ['Rajesh Kumar', 'Dr. Arun Sharma', 'Dr. Priya Nair'],
  Approval: ['Suresh Patel'],
  Academic: ['Meera Iyer'],
  SB: ['Suresh Patel'],
  EO: ['Dr. S. Mehta'],
}

export const getOfficersForBureau = (bureau: Bureau | 'All'): string[] => {
  let customOfficers: string[] = []
  try {
    const stored = localStorage.getItem(USER_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        customOfficers = parsed
          .filter((u: UserProfile) => u.status !== 'On Leave')
          .filter((u: UserProfile) => bureau === 'All' || u.bureau === bureau)
          .map((u: UserProfile) => u.name)
      }
    }
  } catch {}

  const base = bureau === 'All' ? OFFICERS : (BUREAU_OFFICERS[bureau] || OFFICERS)
  return Array.from(new Set([...base, ...customOfficers]))
}

/**
 * Fair automatic least-loaded officer selection.
 * Selects an eligible active handling officer for the specified bureau.
 * - Counts active, unresolved complaints (status !== 'Resolved') for each eligible officer.
 * - Chooses the officer with the lowest workload.
 * - Deterministic tie-breaker: officer least recently assigned a case, then officer.id.
 * - Excludes inactive / on-leave officers and wrong-bureau officers.
 * - Never defaults to Rajesh Kumar.
 * - Returns { officer: 'Unassigned', assignedUserId: undefined } if no eligible officer exists.
 */
export const getLeastLoadedOfficer = (
  bureau: Bureau | string,
  complaintsList: Complaint[] = [],
  usersList: UserProfile[] = userProfiles
): { officer: string; assignedUserId?: string } => {
  const normBureau = bureau.trim().toUpperCase()

  // 1. Filter eligible active handling officers for this bureau
  const eligible = usersList.filter(
    (u) =>
      u.role === 'Officer' &&
      u.status === 'Active' &&
      (u.bureau === 'All' || u.bureau.toUpperCase() === normBureau)
  )

  if (eligible.length === 0) {
    return { officer: 'Unassigned', assignedUserId: undefined }
  }

  // 2. Count unresolved complaints and latest assignment timestamp for each eligible officer
  const officerStats = eligible.map((officer) => {
    let workload = 0
    let lastAssignedTime = -1

    if (complaintsList.length > 0) {
      const assignedComplaints = complaintsList.filter((c) => {
        if (c.assignedUserId) {
          return c.assignedUserId === officer.id
        }
        return (
          (c.officer && c.officer.toLowerCase() === officer.name.toLowerCase()) ||
          resolveOfficerName(c, usersList).toLowerCase() === officer.name.toLowerCase()
        )
      })

      const unresolved = assignedComplaints.filter((c) => c.status !== 'Resolved')
      workload = unresolved.length

      for (const c of assignedComplaints) {
        const d = c.date ? new Date(c.date).getTime() : 0
        if (d > lastAssignedTime) {
          lastAssignedTime = d
        }
      }
    } else {
      workload = officer.activeCasesCount || 0
    }

    return {
      officer,
      workload,
      lastAssignedTime,
    }
  })

  // 3. Sort: lowest workload first, then earliest lastAssignedTime (least recently assigned), then deterministic officer.id
  officerStats.sort((a, b) => {
    if (a.workload !== b.workload) {
      return a.workload - b.workload
    }
    if (a.lastAssignedTime !== b.lastAssignedTime) {
      return a.lastAssignedTime - b.lastAssignedTime
    }
    return a.officer.id.localeCompare(b.officer.id)
  })

  const chosen = officerStats[0].officer
  return { officer: chosen.name, assignedUserId: chosen.id }
}

// Permitted status transitions per workflow rules
export const PERMITTED_STATUS_TRANSITIONS: Record<Status, Status[]> = {
  Pending: ['In Progress', 'Escalated'],
  'In Progress': ['Escalated', 'Resolved'],
  Escalated: ['In Progress', 'Resolved'],
  Resolved: [],
}

export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
}

/**
 * Rule 1 & 2: System Admin manages across system. Bureau Admin only within authorized Bureau.
 * Rule 3: Handling Officers cannot directly assign or reassign cases.
 */
export const canAssignCase = (
  user: UserProfile | undefined,
  complaint: Complaint
): PermissionCheckResult => {
  if (!user) {
    return { allowed: false, reason: 'Authentication required. No active user profile.' }
  }
  if (user.role === 'Admin') {
    return { allowed: true }
  }
  if (user.role === 'BureauAdmin') {
    if (user.bureau === 'All' || complaint.bureau === user.bureau) {
      return { allowed: true }
    }
    return {
      allowed: false,
      reason: `Restricted: Bureau Admin is authorized only for ${user.bureau} cases. Docket ${complaint.id} belongs to ${complaint.bureau}.`,
    }
  }
  if (user.role === 'Officer') {
    return {
      allowed: false,
      reason: 'Handling Officers cannot directly reassign cases. Submit an explicit reassignment request through the workflow.',
    }
  }
  return {
    allowed: false,
    reason: 'Complainants do not hold administrative case assignment permissions.',
  }
}

/**
 * Rule 5: Cross-Bureau transfers require an authorized decision (Admin or current Bureau Admin).
 */
export const canTransferBureau = (
  user: UserProfile | undefined,
  complaint: Complaint
): PermissionCheckResult => {
  if (!user) {
    return { allowed: false, reason: 'Authentication required. No active user profile.' }
  }
  if (user.role === 'Admin') {
    return { allowed: true }
  }
  if (user.role === 'BureauAdmin') {
    if (user.bureau === 'All' || complaint.bureau === user.bureau) {
      return { allowed: true }
    }
    return {
      allowed: false,
      reason: `Restricted: Bureau Admin can only transfer cases originating in their authorized Bureau (${user.bureau}).`,
    }
  }
  if (user.role === 'Officer') {
    return {
      allowed: false,
      reason: 'Handling Officers cannot directly transfer bureaus. Submit a cross-bureau transfer request for administrative approval.',
    }
  }
  return {
    allowed: false,
    reason: 'Complainants do not hold cross-Bureau transfer permissions.',
  }
}

/**
 * Rule 4: Officers can update status only through permitted status transitions on authorized cases.
 */
export const canUpdateCaseStatus = (
  user: UserProfile | undefined,
  complaint: Complaint,
  targetStatus: Status,
  overrideReason?: string
): PermissionCheckResult => {
  if (!user) {
    return { allowed: false, reason: 'Authentication required.' }
  }
  if (user.role === 'Complainant') {
    return {
      allowed: false,
      reason: 'Complainants cannot modify official docket status.',
    }
  }

  if (complaint.status === targetStatus) {
    return {
      allowed: false,
      reason: `Complaint is already in '${targetStatus}' status.`,
    }
  }

  const permitted = PERMITTED_STATUS_TRANSITIONS[complaint.status] || []
  const isPermitted = permitted.includes(targetStatus)

  if (user.role === 'Admin') {
    // Normal permitted transitions are allowed without override
    if (isPermitted && complaint.status !== 'Resolved') {
      return { allowed: true }
    }
    // Re-opening from Resolved or non-permitted transitions require explicit override justification
    const cleanOverride = (overrideReason || '').trim()
    if (cleanOverride) {
      return { allowed: true }
    }
    return {
      allowed: false,
      reason: `Status transition from "${complaint.status}" to "${targetStatus}" is not permitted under normal workflow rules. System Admin may override by providing an explicit override reason.`,
    }
  }

  if (user.role === 'BureauAdmin') {
    if (user.bureau !== 'All' && complaint.bureau !== user.bureau) {
      return {
        allowed: false,
        reason: `Restricted: Docket belongs to ${complaint.bureau}; your administrative jurisdiction is ${user.bureau}.`,
      }
    }
    if (complaint.status === 'Resolved') {
      return {
        allowed: false,
        reason: 'Case is Resolved and closed. Status transitions from "Resolved" are not permitted under normal workflow rules.',
      }
    }
    if (!isPermitted) {
      return {
        allowed: false,
        reason: `Status transition from "${complaint.status}" to "${targetStatus}" is not permitted. Permitted transitions: ${
          permitted.length > 0 ? permitted.join(', ') : 'None (Case Closed)'
        }.`,
      }
    }
    return { allowed: true }
  }

  if (user.role === 'Officer') {
    // 1. Authorized case check - Officer can only mutate explicitly assigned cases
    const isAssigned = complaint.assignedUserId
      ? Boolean(user.id && complaint.assignedUserId === user.id)
      : (
          complaint.officer === user.name ||
          resolveOfficerName(complaint) === user.name
        )
    if (!isAssigned) {
      return {
        allowed: false,
        reason: `Restricted: Handling Officer is neither assigned to docket ${complaint.id} nor authorized to access unassigned cases.`,
      }
    }

    if (complaint.status === 'Resolved') {
      return {
        allowed: false,
        reason: 'Case is Resolved and closed. Status transitions from "Resolved" are not permitted.',
      }
    }

    // 2. Permitted transition check
    if (!isPermitted) {
      return {
        allowed: false,
        reason: `Status transition from "${complaint.status}" to "${targetStatus}" is not permitted for Handling Officers. Allowed next: ${
          permitted.length > 0 ? permitted.join(', ') : 'None (Case Closed)'
        }.`,
      }
    }
    return { allowed: true }
  }
  return { allowed: false, reason: 'Unauthorized role.' }
}

/**
 * Resolves the authoritative display name of the assigned investigating officer.
 * Uses persisted assignedUserId and authoritative user profiles as source of truth.
 * Returns safe neutral fallbacks ('Unassigned' or 'Unknown Officer').
 * Explicitly prevents falling back to 'Reassigned Officer'.
 */
export const resolveOfficerName = (
  complaint?: { officer?: string; assignedUserId?: string } | null,
  users: UserProfile[] = userProfiles
): string => {
  if (!complaint) return 'Unassigned'

  // 1. Authoritative resolution via assignedUserId
  if (complaint.assignedUserId && complaint.assignedUserId.trim()) {
    const uid = complaint.assignedUserId.trim()
    const matched =
      users.find((u) => u.id === uid) ||
      userProfiles.find((u) => u.id === uid)
    if (matched?.name) return matched.name

    // If assignedUserId was explicitly set but does not match any known profile
    const rawOfficer = complaint.officer?.trim()
    if (rawOfficer) {
      const lower = rawOfficer.toLowerCase()
      if (lower !== 'reassigned officer' && lower !== 'unassigned' && lower !== 'unknown officer') {
        const matchedByName =
          users.find((u) => u.name.toLowerCase() === lower) ||
          userProfiles.find((u) => u.name.toLowerCase() === lower)
        if (matchedByName?.name) return matchedByName.name
      }
    }
    return 'Unknown Officer'
  }

  // 2. Resolution via officer name string
  const raw = complaint.officer?.trim()
  if (raw) {
    const lower = raw.toLowerCase()
    if (lower !== 'reassigned officer' && lower !== 'unassigned' && lower !== 'unknown officer') {
      const matchedByName =
        users.find((u) => u.name.toLowerCase() === lower) ||
        userProfiles.find((u) => u.name.toLowerCase() === lower)
      if (matchedByName?.name) return matchedByName.name
      return raw
    }
  }

  return 'Unassigned'
}

/**
 * Rule 0: Dossier read access authorization.
 */
export const canViewComplaint = (
  user: UserProfile | undefined,
  complaint: Complaint
): PermissionCheckResult => {
  if (!user) return { allowed: false, reason: 'Authentication required.' }
  if (user.role === 'Admin') return { allowed: true }
  if (user.role === 'BureauAdmin') {
    if (user.bureau === 'All' || complaint.bureau.toUpperCase() === user.bureau.toUpperCase()) return { allowed: true }
    return {
      allowed: false,
      reason: `Restricted: Docket belongs to ${complaint.bureau}; your administrative jurisdiction is ${user.bureau}.`,
    }
  }
  if (user.role === 'Officer') {
    if (complaint.assignedUserId) {
      if (user.id && complaint.assignedUserId === user.id) return { allowed: true }
      return {
        allowed: false,
        reason: `Handling Officer is not assigned to docket ${complaint.id}.`,
      }
    }
    if (
      complaint.officer === user.name ||
      resolveOfficerName(complaint) === user.name
    ) {
      return { allowed: true }
    }
    return {
      allowed: false,
      reason: `Handling Officer is neither assigned to docket ${complaint.id} nor authorized to access unassigned cases.`,
    }
  }
  if (user.role === 'Complainant') {
    if (
      user.email &&
      complaint.complainantEmail &&
      complaint.complainantEmail.trim().toLowerCase() === user.email.trim().toLowerCase()
    ) {
      return { allowed: true }
    }
    return {
      allowed: false,
      reason: 'Complainants are only authorized to access complaints submitted by themselves.',
    }
  }
  return { allowed: false, reason: 'Unauthorized.' }
}

/**
 * Rule 4: Action remarks authorization
 */
export const canAddCaseRemarks = (
  user: UserProfile | undefined,
  complaint: Complaint
): PermissionCheckResult => {
  if (!user) return { allowed: false, reason: 'Authentication required.' }
  if (user.role === 'Admin') return { allowed: true }
  if (user.role === 'BureauAdmin') {
    if (user.bureau === 'All' || complaint.bureau.toUpperCase() === user.bureau.toUpperCase()) return { allowed: true }
    return {
      allowed: false,
      reason: `Case belongs to ${complaint.bureau}; your administrative jurisdiction is ${user.bureau}.`,
    }
  }
  if (user.role === 'Officer') {
    if (complaint.assignedUserId) {
      if (user.id && complaint.assignedUserId === user.id) return { allowed: true }
      return {
        allowed: false,
        reason: `Restricted: Handling Officer is not assigned to docket ${complaint.id}.`,
      }
    }
    if (
      complaint.officer === user.name ||
      resolveOfficerName(complaint) === user.name
    ) {
      return { allowed: true }
    }
    return {
      allowed: false,
      reason: `Restricted: Handling Officer is neither assigned to docket ${complaint.id} nor authorized to add remarks to unassigned cases.`,
    }
  }
  if (user.role === 'Complainant') {
    if (
      user.email &&
      complaint.complainantEmail &&
      complaint.complainantEmail.trim().toLowerCase() === user.email.trim().toLowerCase()
    ) {
      return { allowed: true }
    }
    return { allowed: false, reason: 'You can only add updates to your own grievance filings.' }
  }
  return { allowed: false, reason: 'Unauthorized.' }
}

/**
 * Rule 4: Document upload authorization
 */
export const canUploadCaseDocument = (
  user: UserProfile | undefined,
  complaint: Complaint
): PermissionCheckResult => {
  return canAddCaseRemarks(user, complaint)
}

/**
 * Authority to review reassignment and transfer requests
 */
export const canReviewReassignmentRequest = (
  user: UserProfile | undefined,
  complaint: Complaint
): PermissionCheckResult => {
  if (!user) return { allowed: false, reason: 'Authentication required.' }
  if (user.role === 'Admin') return { allowed: true }
  if (user.role === 'BureauAdmin') {
    if (user.bureau === 'All' || complaint.bureau === user.bureau) return { allowed: true }
    return {
      allowed: false,
      reason: `Only ${complaint.bureau} Bureau Admin or System Admin can review reassignment requests for this case.`,
    }
  }
  return { allowed: false, reason: 'Handling Officers and Complainants cannot decide reassignment requests.' }
}

/**
 * Scopes notifications prior to rendering.
 * Prevents unauthorized notification exposure, wrong unread counts, and cross-user leaks.
 *
 * Rules:
 * - Complainants: only explicitly addressed to their authenticated user ID/email or linked to an authorized complaint.
 * - Officers: only cases assigned to them, plus permitted internal notices within their Bureau.
 * - Bureau Admins: only notifications for their authorized Bureau.
 * - System Admin: system-wide notifications.
 */
export const isNotificationAuthorized = (
  user: UserProfile | undefined | null,
  notification: AppNotification,
  complaints: Complaint[]
): boolean => {
  if (!user) return false

  // 1. Explicit user/email targeting checks
  if (notification.recipientUserId && notification.recipientUserId !== user.id) {
    return false
  }
  if (
    notification.recipientEmail &&
    user.email &&
    notification.recipientEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()
  ) {
    return false
  }

  // 2. Explicit targetRole check
  if (notification.targetRole && notification.targetRole !== 'All' && user.role !== notification.targetRole) {
    return false
  }

  // 3. If notification relates to a specific complaint caseId
  if (notification.caseId) {
    const targetComplaint = complaints.find((c) => c.id.toUpperCase() === notification.caseId?.toUpperCase())
    if (targetComplaint) {
      return canViewComplaint(user, targetComplaint).allowed
    }
    // Case not found in active complaints: only System Admin can view orphan system notifications
    return user.role === 'Admin'
  }

  // 4. Non-case notifications
  // System Admin receives all system-wide notifications
  if (user.role === 'Admin') return true

  // Complainants must only see notifications explicitly addressed to their authenticated user ID/email
  if (user.role === 'Complainant') {
    return Boolean(
      (notification.recipientUserId && notification.recipientUserId === user.id) ||
      (notification.recipientEmail && user.email && notification.recipientEmail.trim().toLowerCase() === user.email.trim().toLowerCase())
    )
  }

  // Bureau Admins must only see notifications for their authorized Bureau
  if (user.role === 'BureauAdmin') {
    if (user.bureau === 'All') return true
    if (notification.bureau && notification.bureau !== 'All') {
      return notification.bureau.toUpperCase() === user.bureau.toUpperCase()
    }
    return false
  }

  // Officers must only see permitted internal notices within their Bureau
  if (user.role === 'Officer') {
    if (user.bureau && user.bureau !== 'All' && notification.bureau && notification.bureau !== 'All') {
      return notification.bureau.toUpperCase() === user.bureau.toUpperCase()
    }
    return false
  }

  return false
}

export const getNotificationStorageKey = (userId?: string): string => {
  return userId ? `abhigyan_notifications_${userId}` : 'abhigyan_notifications_anonymous'
}

export const loadUserNotifications = (userId?: string): AppNotification[] => {
  if (!userId) return initialNotifications
  try {
    const key = getNotificationStorageKey(userId)
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch {
    // Malformed JSON fallback
  }
  return initialNotifications
}

export const saveUserNotifications = (userId: string, notifs: AppNotification[]): void => {
  if (!userId || typeof localStorage === 'undefined') return
  try {
    const key = getNotificationStorageKey(userId)
    localStorage.setItem(key, JSON.stringify(notifs))
  } catch {
    // ignore
  }
}
