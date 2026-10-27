import { useState, useEffect } from 'react'
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Database,
  Globe,
  Loader2,
  Lock,
  RotateCcw,
  Save,
  Shield,
  Sliders,
  Sparkles,
  Users,
} from 'lucide-react'
import type { AppSettings, Role, UserProfile } from '../types'
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, TODAY, getAppSettings } from '../data'
import { Badge, Button, Card, CardHeader, PageTitle } from '../components/ui'

interface SettingsProps {
  currentRole?: Role
  currentUser?: UserProfile
  settings?: AppSettings
  onUpdateSettings?: (settings: Partial<AppSettings>) => Promise<boolean | AppSettings>
  onResetSettings?: () => Promise<boolean | AppSettings>
}

export default function Settings({
  currentRole = 'Admin',
  currentUser,
  settings: propSettings,
  onUpdateSettings,
  onResetSettings,
}: SettingsProps) {
  const [initialSettings] = useState<AppSettings>(() => propSettings || getAppSettings())
  const [similarityThreshold, setSimilarityThreshold] = useState(initialSettings.similarityThreshold)
  const [slaCritical, setSlaCritical] = useState(initialSettings.slaCritical)
  const [slaHigh, setSlaHigh] = useState(initialSettings.slaHigh)
  const [slaMedium, setSlaMedium] = useState(initialSettings.slaMedium)
  const [autoEscalate, setAutoEscalate] = useState(initialSettings.autoEscalate)
  const [emailAlerts, setEmailAlerts] = useState(initialSettings.emailAlerts)
  const [savedBanner, setSavedBanner] = useState<string | null>(null)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Sync state if propSettings changes from server
  useEffect(() => {
    if (propSettings) {
      setSimilarityThreshold(propSettings.similarityThreshold)
      setSlaCritical(propSettings.slaCritical)
      setSlaHigh(propSettings.slaHigh)
      setSlaMedium(propSettings.slaMedium)
      setAutoEscalate(propSettings.autoEscalate)
      setEmailAlerts(propSettings.emailAlerts)
    }
  }, [propSettings])

  const isAuthorized = currentRole === 'Admin' && (!currentUser?.bureau || currentUser.bureau === 'All')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorBanner(null)
    setSavedBanner(null)

    if (!isAuthorized) {
      setErrorBanner('Unauthorized: System and SLA configuration can only be modified by a System Administrator.')
      return
    }

    // Input validations
    if (isNaN(similarityThreshold) || similarityThreshold < 50 || similarityThreshold > 95) {
      setErrorBanner('Invalid threshold: Overlap similarity threshold must be an integer between 50% and 95%.')
      return
    }

    if (isNaN(slaCritical) || slaCritical < 1 || slaCritical > 30) {
      setErrorBanner('Invalid Critical SLA: Must be a positive business duration between 1 and 30 days.')
      return
    }

    if (isNaN(slaHigh) || slaHigh < 1 || slaHigh > 60) {
      setErrorBanner('Invalid High SLA: Must be a positive business duration between 1 and 60 days.')
      return
    }

    if (isNaN(slaMedium) || slaMedium < 1 || slaMedium > 90) {
      setErrorBanner('Invalid Standard SLA: Must be a positive business duration between 1 and 90 days.')
      return
    }

    if (slaCritical >= slaHigh) {
      setErrorBanner('SLA Logic Conflict: Critical severity SLA window must be shorter than High priority window.')
      return
    }

    if (slaHigh >= slaMedium) {
      setErrorBanner('SLA Logic Conflict: High priority SLA window must be shorter than Standard / Medium window.')
      return
    }

    const updatedSettings: AppSettings = {
      similarityThreshold,
      slaCritical,
      slaHigh,
      slaMedium,
      autoEscalate,
      emailAlerts,
      updatedAt: `${TODAY} 12:00`,
      updatedBy: currentUser?.name || 'System Admin',
    }

    if (onUpdateSettings) {
      setIsSaving(true)
      try {
        const res = await onUpdateSettings(updatedSettings)
        if (!res) {
          setErrorBanner('Save failed: Server rejected configuration update. Verify your System Admin credentials.')
          setIsSaving(false)
          return
        }
        setSavedBanner(
          `Settings saved successfully. SLA windows and overlap threshold (${similarityThreshold}%) are now active.`
        )
        setTimeout(() => setSavedBanner(null), 7000)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Server Error: Unable to save configuration.'
        setErrorBanner(msg)
      } finally {
        setIsSaving(false)
      }
      return
    }

    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings))
      setSavedBanner(
        `Settings saved successfully. SLA windows and overlap threshold (${similarityThreshold}%) are now active.`
      )
      setTimeout(() => setSavedBanner(null), 7000)
    } catch {
      setErrorBanner('Storage Error: Unable to save preferences.')
    }
  }

  const handleResetDefaults = async () => {
    setErrorBanner(null)
    setSavedBanner(null)
    if (!isAuthorized) {
      setErrorBanner('Unauthorized: System configuration can only be reset by a System Administrator.')
      return
    }

    if (onResetSettings) {
      setIsSaving(true)
      try {
        const res = await onResetSettings()
        if (res) {
          setSimilarityThreshold(DEFAULT_SETTINGS.similarityThreshold)
          setSlaCritical(DEFAULT_SETTINGS.slaCritical)
          setSlaHigh(DEFAULT_SETTINGS.slaHigh)
          setSlaMedium(DEFAULT_SETTINGS.slaMedium)
          setAutoEscalate(DEFAULT_SETTINGS.autoEscalate)
          setEmailAlerts(DEFAULT_SETTINGS.emailAlerts)
          setSavedBanner('Settings reset to defaults successfully.')
          setTimeout(() => setSavedBanner(null), 5000)
        } else {
          setErrorBanner('Reset failed: Server rejected settings reset.')
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Server Error: Unable to reset configuration.'
        setErrorBanner(msg)
      } finally {
        setIsSaving(false)
      }
      return
    }

    setSimilarityThreshold(DEFAULT_SETTINGS.similarityThreshold)
    setSlaCritical(DEFAULT_SETTINGS.slaCritical)
    setSlaHigh(DEFAULT_SETTINGS.slaHigh)
    setSlaMedium(DEFAULT_SETTINGS.slaMedium)
    setAutoEscalate(DEFAULT_SETTINGS.autoEscalate)
    setEmailAlerts(DEFAULT_SETTINGS.emailAlerts)

    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS))
      setSavedBanner('Settings reset to defaults successfully.')
      setTimeout(() => setSavedBanner(null), 5000)
    } catch {
      setErrorBanner('Storage Error: Unable to reset configuration.')
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <PageTitle
        title="System Settings"
        sub="Configure overlap detection thresholds, SLA rules, and alert preferences"
      />

      {!isAuthorized && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800 shadow-2xs">
          <Lock size={16} className="text-amber-600 shrink-0" />
          <span>
            Read-Only: Viewing settings as <strong>{currentRole}</strong>. Only System Administrators can modify system SLA windows and overlap thresholds.
          </span>
        </div>
      )}

      {errorBanner && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-rose-600 hover:text-rose-800 text-xs font-bold ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {savedBanner && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{savedBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSavedBanner(null)}
            className="text-emerald-600 hover:text-emerald-800 text-xs font-bold ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Overlap Engine Configuration */}
        <Card>
          <CardHeader
            title="AI Cross-Bureau Overlap Detection Engine"
            sub="Set sensitivity parameters for flagging parallel complaints between RB and PGRC"
            action={<Badge v="Core Engine" />}
          />

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                <span>Minimum Similarity Threshold to Flag Overlap:</span>
                <span className="font-mono text-sm text-navy-800 bg-navy-50 px-2 py-0.5 rounded border border-navy-100">
                  {similarityThreshold}%
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                value={similarityThreshold}
                disabled={!isAuthorized || isSaving}
                onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                className="w-full accent-navy-800 mt-2 disabled:opacity-50"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>50% (Permissive / Higher recall)</span>
                <span>75% (Recommended for SIH)</span>
                <span>95% (Strict / High precision)</span>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 border border-slate-100 leading-relaxed">
              When two complaints against the same institution match above{' '}
              <strong>{similarityThreshold}%</strong> based on institution ID, shared complaint category,
              and keyword overlap, Abhigyan flags an overlap alert in both the <strong>Regulation Bureau (RB)</strong>{' '}
              and <strong>Public Grievance Redressal Cell (PGRC)</strong> dockets.{' '}
              <span className="text-slate-400 italic">
                Unreviewed candidate pairs below this threshold are suppressed from active alert queues, while all historical review decisions remain intact.
              </span>
            </div>
          </div>
        </Card>

        {/* SLA Window Configuration */}
        <Card>
          <CardHeader
            title="Statutory Redressal SLA Windows (Authoritative Database Configuration)"
            sub="Configurable business day windows stored in backend system settings. New complaint filings calculate statutory SLA due dates from these values without altering existing case records."
            action={<Badge v="Database-Backed" />}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Critical Severity SLA (Days)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={slaCritical}
                disabled={!isAuthorized || isSaving}
                onChange={(e) => setSlaCritical(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-bold text-slate-800 focus:border-navy-600 focus:outline-none disabled:bg-slate-100 disabled:opacity-60"
              />
              <p className="mt-1 text-[10px] text-slate-400">Hostel hazard, ragging, unapproved courses</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                High Priority SLA (Days)
              </label>
              <input
                type="number"
                min="2"
                max="60"
                value={slaHigh}
                disabled={!isAuthorized || isSaving}
                onChange={(e) => setSlaHigh(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-bold text-slate-800 focus:border-navy-600 focus:outline-none disabled:bg-slate-100 disabled:opacity-60"
              />
              <p className="mt-1 text-[10px] text-slate-400">Excess fee collections, admission bypass</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Standard / Medium SLA (Days)
              </label>
              <input
                type="number"
                min="3"
                max="90"
                value={slaMedium}
                disabled={!isAuthorized || isSaving}
                onChange={(e) => setSlaMedium(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-bold text-slate-800 focus:border-navy-600 focus:outline-none disabled:bg-slate-100 disabled:opacity-60"
              />
              <p className="mt-1 text-[10px] text-slate-400">Equipment deficiency, syllabus dispute</p>
            </div>
          </div>
        </Card>

        {/* Automation & Escalation Rules */}
        <Card>
          <CardHeader
            title="Automated Surveillance &amp; Bureau Notification Rules"
            sub="Automatic escalation triggers upon statutory deadline breach"
            action={<Badge v="Demo Simulation" />}
          />

          <div className="space-y-4 text-xs">
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200 leading-relaxed flex items-start gap-2">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Unconfigured Background Services:</strong> External SMTP email delivery and background cron daemon workers for automatic SLA escalation are not active in this deployment. Toggling these options records policy preferences in the database but will not dispatch live emails or auto-escalate records without external service orchestration.
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900">Automatic Bureau Head Escalation</h4>
                <p className="text-slate-500 mt-0.5">
                  Escalate any case exceeding statutory SLA directly to Bureau Chief &amp; Member Secretary.
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoEscalate}
                disabled={!isAuthorized || isSaving}
                onChange={(e) => setAutoEscalate(e.target.checked)}
                className="h-4 w-4 rounded accent-navy-800 disabled:opacity-50"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900">Daily Digest Email Notifications</h4>
                <p className="text-slate-500 mt-0.5">
                  Send morning summary of pending files and overlap alerts to designated investigating officers.
                </p>
              </div>
              <input
                type="checkbox"
                checked={emailAlerts}
                disabled={!isAuthorized || isSaving}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="h-4 w-4 rounded accent-navy-800 disabled:opacity-50"
              />
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleResetDefaults}
            disabled={!isAuthorized || isSaving}
          >
            {isSaving ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
            <span>Reset Demo Defaults</span>
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!isAuthorized || isSaving}
          >
            {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>Save Configuration Preferences</span>
          </Button>
        </div>
      </form>
    </div>
  )
}
