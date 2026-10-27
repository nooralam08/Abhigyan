import { useState } from 'react'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Landmark,
  Loader2,
  LogIn,
  Mail,
  Phone,
  Shield,
  User,
  UserCheck,
  UserPlus,
} from 'lucide-react'
import type { Role, UserProfile } from '../types'
import { loginApi, registerApi, demoLoginApi } from '../api/auth'

interface LoginProps {
  onLogin: (user: UserProfile, token: string) => void
  initialRole?: Role
}

interface DemoRoleConfig {
  role: Role
  label: string
  title: string
  user: string
  email: string
  scope: string
  icon: typeof Shield
  accent: string
}

const IS_DEMO_AUTH_ENABLED = Boolean(import.meta.env.DEV || import.meta.env.VITE_DEMO_AUTH === 'true')

const DEMO_ROLES: DemoRoleConfig[] = [
  {
    role: 'Complainant',
    label: 'Citizen / Student',
    title: 'Complainant / User',
    user: 'Rohit Sharma',
    email: 'rohit.sharma@student.edu.in',
    scope: 'Submit grievances, track personal docket timeline, upload supporting evidence',
    icon: User,
    accent: 'border-emerald-500 bg-emerald-50/70 text-emerald-900',
  },
  {
    role: 'BureauAdmin',
    label: 'Bureau Head',
    title: 'Bureau / Cell Admin',
    user: 'Dr. Priya Nair',
    email: 'priya.nair@aicte-india.org',
    scope: 'Manage PGRC/RB dockets, assign officers, review bureau workload and SLA queues',
    icon: Building2,
    accent: 'border-sky-500 bg-sky-50/70 text-sky-900',
  },
  {
    role: 'Officer',
    label: 'Case Officer',
    title: 'Handling Officer (PGRC)',
    user: 'Rajesh Kumar',
    email: 'rajesh.kumar@aicte-india.org',
    scope: 'Investigate assigned cases, record inquiry notes, update status, review overlaps',
    icon: UserCheck,
    accent: 'border-teal-500 bg-teal-50/70 text-teal-900',
  },
  {
    role: 'Officer',
    label: 'RB Officer',
    title: 'Handling Officer (RB)',
    user: 'Anita Verma',
    email: 'anita.verma@aicte-india.org',
    scope: 'Regulation Bureau investigations, institutional compliance, fee and admission norms',
    icon: UserCheck,
    accent: 'border-indigo-500 bg-indigo-50/70 text-indigo-900',
  },
  {
    role: 'Admin',
    label: 'System Admin',
    title: 'System Admin',
    user: 'Dr. S. Mehta',
    email: 'member-sec@aicte-india.org',
    scope: 'All bureaus oversight, user directory, institution master data, SLA thresholds',
    icon: Shield,
    accent: 'border-navy-800 bg-navy-50/70 text-navy-900',
  },
]

export default function Login({ onLogin, initialRole = 'Admin' }: LoginProps) {
  const defaultRoleConfig = DEMO_ROLES.find((r) => r.role === initialRole) || DEMO_ROLES[4]
  const [selectedRole, setSelectedRole] = useState<Role>(initialRole)
  const [email, setEmail] = useState(defaultRoleConfig.email)
  const [password, setPassword] = useState('AicteDemo@2026')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Registration state & submission
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regComplainantType, setRegComplainantType] = useState('Student')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')
  const [regShowPassword, setRegShowPassword] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match. Please verify your password confirmation.')
      setIsLoading(false)
      return
    }

    if (regPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters in length.')
      setIsLoading(false)
      return
    }

    try {
      const res = await registerApi({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        phone: regPhone.trim(),
        complainantType: regComplainantType,
      })
      onLogin(res.user, res.accessToken)
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Registration failed. Please check your details or try again.'
      setErrorMessage(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectRole = (r: DemoRoleConfig) => {
    setSelectedRole(r.role)
    setEmail(r.email)
    setPassword('AicteDemo@2026')
    setErrorMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    try {
      // Primary path: authenticate credentials against POST /api/auth/login
      const res = await loginApi({ email: email.trim(), password })
      onLogin(res.user, res.accessToken)
    } catch (err: unknown) {
      // Invalid credentials must remain invalid credentials. Never fall back to demo login.
      const msg =
        err instanceof Error
          ? err.message
          : 'Authentication failed. Please verify credentials or server connectivity.'
      setErrorMessage(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickLogin = async (r: DemoRoleConfig) => {
    setSelectedRole(r.role)
    setEmail(r.email)
    setPassword('AicteDemo@2026')
    setIsLoading(true)
    setErrorMessage(null)

    try {
      // Use demoLoginApi for rapid 1-click role testing
      const res = await demoLoginApi({ role: r.role, email: r.email })
      onLogin(res.user, res.accessToken)
    } catch {
      // Fallback to standard login
      try {
        const res = await loginApi({ email: r.email, password: 'AicteDemo@2026' })
        onLogin(res.user, res.accessToken)
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : `Failed to authenticate as ${r.title}.`
        setErrorMessage(msg)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const activeRoleConfig =
    DEMO_ROLES.find((r) => r.email.toLowerCase() === email.trim().toLowerCase()) ||
    DEMO_ROLES.find((r) => r.role === selectedRole) ||
    DEMO_ROLES[4]

  return (
    <div className="grid min-h-screen lg:grid-cols-12 bg-slate-100 font-sans">
      {/* Left Branding & Context Panel */}
      <div className="hidden lg:flex lg:col-span-5 flex-col justify-between bg-[#0b2250] p-8 xl:p-10 text-white relative overflow-hidden">
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-400/30 flex items-center justify-center shrink-0">
              <Landmark size={24} />
            </div>
            <div>
              <div className="font-bold text-sm tracking-wide uppercase">All India Council for Technical Education</div>
              <div className="text-xs text-navy-200">Ministry of Education, Government of India</div>
            </div>
          </div>

          <div className="pt-4">
            <span className="inline-block px-2.5 py-1 rounded bg-teal-500/20 text-teal-200 text-xs font-semibold uppercase tracking-wider border border-teal-400/30 mb-3">
              Abhigyan Platform
            </span>
            <h1 className="text-2xl xl:text-3xl font-bold leading-tight text-white">
              Integrated Complaint Monitoring &amp; Cross-Bureau Redressal System
            </h1>
            <p className="mt-3 text-xs xl:text-sm text-slate-300 leading-relaxed">
              Unified surveillance and dispute resolution across the Regulation Bureau (RB), Public Grievance Redressal Cell (PGRC), and Approval Bureau. Detect duplicate dockets early, enforce statutory SLA windows, and streamline inter-bureau coordination.
            </p>
          </div>

          {/* 4 Roles Overview */}
          <div className="pt-2 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-teal-300">
              Role-Based Access Matrix
            </div>
            <div className="grid gap-2 text-xs">
              <div className="rounded-lg bg-white/5 p-2.5 border border-white/10">
                <span className="font-semibold text-white">Complainant / Citizen:</span>
                <span className="text-slate-300 ml-1.5">Direct grievance filing and secure tracking of personal dockets.</span>
              </div>
              <div className="rounded-lg bg-white/5 p-2.5 border border-white/10">
                <span className="font-semibold text-white">Bureau / Cell Admin:</span>
                <span className="text-slate-300 ml-1.5">Workload distribution, docket assignment, and SLA enforcement.</span>
              </div>
              <div className="rounded-lg bg-white/5 p-2.5 border border-white/10">
                <span className="font-semibold text-white">Handling Officer:</span>
                <span className="text-slate-300 ml-1.5">Field inquiry hearings, action notes, and overlap validation.</span>
              </div>
              <div className="rounded-lg bg-white/5 p-2.5 border border-white/10">
                <span className="font-semibold text-white">System Admin:</span>
                <span className="text-slate-300 ml-1.5">Cross-bureau governance, master data, and institutional registry.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span>AICTE Redressal Portal</span>
          <span>Official Portal</span>
        </div>
      </div>

      {/* Right Login / Demo Role Selection Form */}
      <div className="lg:col-span-7 flex flex-col justify-center px-4 py-6 sm:px-8 lg:px-10 xl:px-14 max-w-2xl mx-auto w-full my-auto">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center gap-3 mb-4 p-3.5 rounded-xl bg-[#0b2250] text-white">
          <Landmark size={22} className="text-teal-300 shrink-0" />
          <div>
            <div className="font-bold text-sm">Abhigyan • AICTE</div>
            <div className="text-[11px] text-slate-300">Complaint Monitoring Portal</div>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-4.5">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {authMode === 'login' ? 'Sign In to Abhigyan' : 'Citizen Grievance Registration'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {authMode === 'login'
                ? 'Select a role perspective or enter your official credentials.'
                : 'Create an official complainant account to submit and track AICTE institution grievances.'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex rounded-xl bg-slate-200/80 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login')
                setErrorMessage(null)
              }}
              className={`flex-1 py-2 px-3 rounded-lg transition text-center flex items-center justify-center gap-1.5 ${
                authMode === 'login'
                  ? 'bg-white text-navy-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn size={14} />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register')
                setErrorMessage(null)
              }}
              className={`flex-1 py-2 px-3 rounded-lg transition text-center flex items-center justify-center gap-1.5 ${
                authMode === 'register'
                  ? 'bg-white text-teal-800 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus size={14} />
              <span>Register Complainant</span>
            </button>
          </div>

          {authMode === 'login' ? (
            <>



          {/* Backend Authentication Notice */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3 text-xs text-sky-950 flex items-start gap-2.5">
            <Info size={16} className="text-sky-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="font-semibold text-sky-900">Secure Access:</strong> Role credentials and permissions are validated against central authority records.
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="font-semibold">Authentication Error:</strong> {errorMessage}
              </div>
            </div>
          )}

          {/* Step 1: Select Demo Role Cards */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Step 1: Choose Role Perspective
              </label>
              <span className="text-[11px] text-slate-400 font-medium">Server-Verified RBAC</span>
            </div>
            <div
              role="radiogroup"
              aria-label="Select demo role perspective"
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              {DEMO_ROLES.map((r, index) => {
                const Icon = r.icon
                const isSelected = selectedRole === r.role && (r.role !== 'Officer' || r.email === email)
                return (
                  <button
                    key={r.email}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={isLoading}
                    onClick={() => handleSelectRole(r)}
                    className={`text-left p-2.5 sm:p-3 rounded-xl border-2 transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 ${
                      isSelected
                        ? `${r.accent} shadow-xs ring-1 ring-slate-400/20`
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    } ${index === DEMO_ROLES.length - 1 && DEMO_ROLES.length % 2 === 1 ? 'sm:col-span-2 sm:w-1/2 sm:justify-self-center' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon size={15} className="shrink-0" />
                        <span className="font-bold text-xs truncate">{r.title}</span>
                      </div>
                      {isSelected && (
                        <CheckCircle2 size={15} className="text-current shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-800 mt-1 truncate">
                      {r.user}
                    </div>
                    <div className="text-[10px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                      {r.scope}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Step 2: Form & Sign In */}
          <form
            onSubmit={handleSubmit}
            className="space-y-3.5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-xs font-bold text-slate-800">
                Step 2: Sign In as <span className="text-teal-700 font-extrabold">{activeRoleConfig.title}</span>
              </span>
              <span className="text-[11px] font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {activeRoleConfig.label}
              </span>
            </div>

            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Account Email
              </label>
              <div className="relative">
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  disabled={isLoading}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  placeholder="name@aicte-india.org"
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-navy-700 focus:ring-1 focus:ring-navy-700 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 transition"
                />
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  disabled={isLoading}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="Enter password"
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-10 py-2 text-xs sm:text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-navy-700 focus:ring-1 focus:ring-navy-700 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 transition"
                />
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 focus:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 rounded transition"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Demo credential hint: displayed strictly in demo/dev mode */}
              {IS_DEMO_AUTH_ENABLED && (
                <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0"></span>
                  <span>
                    Demo seed accounts password: <span className="font-mono font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">AicteDemo@2026</span>
                  </span>
                </p>
              )}
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[42px] sm:min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-[#0b2250] hover:bg-navy-800 active:bg-navy-950 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2.5 text-xs sm:text-sm font-bold text-white transition shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0b2250]"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin shrink-0" />
                    <span>Authenticating with FastAPI...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={16} className="shrink-0" />
                    <span>Sign in as {activeRoleConfig.title}</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick 1-click login pills (development / demo mode only) */}
            {IS_DEMO_AUTH_ENABLED && (
              <div className="pt-2.5 border-t border-slate-100">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Quick 1-Click Role Access (Dev/Demo):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DEMO_ROLES.map((r) => (
                    <button
                      key={r.email}
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleQuickLogin(r)}
                      className="rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 active:bg-slate-200 disabled:opacity-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition focus:outline-none focus-visible:ring-1 focus-visible:ring-navy-700"
                    >
                      {r.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="pt-2 text-center border-t border-slate-100">
              <span className="text-xs text-slate-500">Need to file a student or citizen complaint? </span>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register')
                  setErrorMessage(null)
                }}
                className="text-xs font-bold text-teal-700 hover:text-teal-900 underline ml-1"
              >
                Register Complainant Account
              </button>
            </div>
          </form>
            </>
          ) : (
            <>
              {/* Registration View */}
              <div className="rounded-xl border border-teal-200 bg-teal-50/80 p-3 text-xs text-teal-950 flex items-start gap-2.5">
                <Info size={16} className="text-teal-700 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="font-semibold text-teal-900">Complainant Account Registration:</strong> Public registration automatically assigns the Complainant role. You can immediately file formal grievances, track statutory SLA resolution timelines, and submit evidence directly.
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="font-semibold">Registration Error:</strong> {errorMessage}
                  </div>
                </div>
              )}

              <form
                onSubmit={handleRegister}
                className="space-y-3.5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs"
              >
                <div className="border-b border-slate-100 pb-2.5">
                  <span className="text-xs font-bold text-slate-800">
                    Complainant Profile Details
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Your account will be registered and assigned an official Complainant ID.
                  </p>
                </div>

                <div>
                  <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <input
                      id="reg-name"
                      type="text"
                      value={regName}
                      disabled={isLoading}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                      placeholder="e.g. Rohit Sharma"
                      className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-navy-700 focus:ring-1 focus:ring-navy-700 focus:outline-none disabled:bg-slate-50 transition"
                    />
                    <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reg-type" className="block text-xs font-semibold text-slate-700 mb-1">
                      Complainant Category *
                    </label>
                    <select
                      id="reg-type"
                      value={regComplainantType}
                      disabled={isLoading}
                      onChange={(e) => setRegComplainantType(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs sm:text-sm font-medium text-slate-900 focus:border-navy-700 focus:ring-1 focus:ring-navy-700 focus:outline-none disabled:bg-slate-50 transition"
                    >
                      <option value="Student">Enrolled Student</option>
                      <option value="Faculty">Teaching Faculty</option>
                      <option value="Parent">Parent / Guardian</option>
                      <option value="Whistleblower">Whistleblower / Staff</option>
                      <option value="General Public">General Public</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="reg-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                      Contact Phone (Optional)
                    </label>
                    <div className="relative">
                      <input
                        id="reg-phone"
                        type="tel"
                        value={regPhone}
                        disabled={isLoading}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-navy-700 focus:ring-1 focus:ring-navy-700 focus:outline-none disabled:bg-slate-50 transition"
                      />
                      <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <div className="relative">
                    <input
                      id="reg-email"
                      type="email"
                      value={regEmail}
                      disabled={isLoading}
                      onChange={(e) => setRegEmail(e.target.value)}
                      autoComplete="email"
                      required
                      placeholder="complainant@example.com"
                      className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-navy-700 focus:ring-1 focus:ring-navy-700 focus:outline-none disabled:bg-slate-50 transition"
                    />
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700 mb-1">
                      Password (min 6 chars) *
                    </label>
                    <div className="relative">
                      <input
                        id="reg-password"
                        type={regShowPassword ? 'text' : 'password'}
                        value={regPassword}
                        disabled={isLoading}
                        onChange={(e) => setRegPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                        placeholder="Create password"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-10 py-2 text-xs sm:text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-navy-700 focus:ring-1 focus:ring-navy-700 focus:outline-none disabled:bg-slate-50 transition"
                      />
                      <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => setRegShowPassword((prev) => !prev)}
                        aria-label={regShowPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded transition"
                      >
                        {regShowPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-confirm" className="block text-xs font-semibold text-slate-700 mb-1">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <input
                        id="reg-confirm"
                        type={regShowPassword ? 'text' : 'password'}
                        value={regConfirmPassword}
                        disabled={isLoading}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                        placeholder="Repeat password"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs sm:text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-navy-700 focus:ring-1 focus:ring-navy-700 focus:outline-none disabled:bg-slate-50 transition"
                      />
                      <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full min-h-[42px] sm:min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-teal-700 hover:bg-teal-800 active:bg-teal-900 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2.5 text-xs sm:text-sm font-bold text-white transition shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-700"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin shrink-0" />
                        <span>Registering Account...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} className="shrink-0" />
                        <span>Register &amp; Sign In</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="pt-2 text-center border-t border-slate-100">
                  <span className="text-xs text-slate-500">Already have an account? </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login')
                      setErrorMessage(null)
                    }}
                    className="text-xs font-bold text-[#0b2250] hover:text-navy-900 underline ml-1"
                  >
                    Sign in here
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Footer Metadata */}
          <div className="text-center text-[11px] text-slate-400">
            All India Council for Technical Education (AICTE) • 2026
          </div>
        </div>
      </div>
    </div>
  )
}
