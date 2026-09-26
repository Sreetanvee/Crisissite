const PRIORITY_STYLES = {
  high: 'bg-signal-rust/15 text-red-300 border-signal-rust/40',
  medium: 'bg-signal-amber/15 text-amber-200 border-signal-amber/40',
  low: 'bg-flood-low/15 text-emerald-300 border-flood-low/40',
}

export function PriorityBadge({ priority }) {
  const p = (priority || 'low').toLowerCase()
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[p] || PRIORITY_STYLES.low}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {p === 'high' ? 'High priority' : p === 'medium' ? 'Medium priority' : 'Low priority'}
    </span>
  )
}

const STATUS_STYLES = {
  OK: 'bg-ink-700 text-slate-300 border-ink-600',
  LOW_CONFIDENCE: 'bg-signal-amber/15 text-amber-200 border-signal-amber/40',
  CONFLICTING_EVIDENCE: 'bg-signal-rust/15 text-red-300 border-signal-rust/40',
  LIMITED_EVIDENCE: 'bg-ink-600 text-slate-300 border-ink-500',
}

const STATUS_LABELS = {
  OK: 'Evidence consistent',
  LOW_CONFIDENCE: 'Low confidence — review required',
  CONFLICTING_EVIDENCE: 'Conflicting evidence',
  LIMITED_EVIDENCE: 'Limited evidence',
}

export function StatusBadge({ status }) {
  const s = status || 'OK'
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[s] || STATUS_STYLES.OK}`}>
      {STATUS_LABELS[s] || s}
    </span>
  )
}

export function DemoBadge({ className = '' }) {
  return (
    <span className={`inline-flex items-center rounded border border-ink-500 bg-ink-800 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-400 ${className}`}>
      DEMO DATA
    </span>
  )
}
