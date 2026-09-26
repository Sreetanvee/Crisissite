import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api.js'
import { PriorityBadge, StatusBadge, DemoBadge } from '../components/Badges.jsx'
import ReviewBanner from '../components/ReviewBanner.jsx'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
const FILTERS = ['all', 'high', 'medium', 'low']

export default function ReviewQueue() {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [busyZone, setBusyZone] = useState(null)
  const [toast, setToast] = useState(null)

  const load = () => {
    api.getReviewQueue().then((data) => {
      setQueue(data)
      setLoading(false)
    })
  }

  useEffect(load, [])

  const act = async (zoneId, status, label) => {
    setBusyZone(zoneId)
    try {
      await api.postReview({ zone_id: zoneId, status, notes: '' })
      setToast(`${label} — Zone ${queue.find((q) => q.zone_id === zoneId)?.zone_code}`)
      load()
    } finally {
      setBusyZone(null)
      setTimeout(() => setToast(null), 3000)
    }
  }

  const filtered = queue
    .filter((q) => filter === 'all' || q.priority === filter)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.fusion_score - a.fusion_score)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Human review queue</h1>
        <p className="text-sm text-slate-400">Priority means "needs human attention" — not "automatically dangerous." <DemoBadge className="ml-1 align-middle" /></p>
        <div className="mt-3"><ReviewBanner compact /></div>
      </div>

      <div className="flex items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded border px-2.5 py-1 text-xs font-medium capitalize transition-colors focus-ring ${
              filter === f ? 'border-signal-teal/40 bg-signal-teal/10 text-teal-200' : 'border-ink-700 bg-ink-900 text-slate-500 hover:text-slate-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">Loading queue…</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((q) => (
            <div key={q.zone_id} className="rounded-lg border border-ink-700 bg-ink-900 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={q.priority} />
                    <StatusBadge status={q.status} />
                    {q.review_status !== 'pending' && (
                      <span className="rounded border border-flood-low/30 bg-flood-low/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
                        {q.review_status === 'reviewed' ? 'Reviewed' : 'More data requested'}
                      </span>
                    )}
                  </div>
                  <Link to={`/zones/${q.zone_id}`} className="text-base font-semibold text-slate-100 hover:text-teal-300">
                    Zone {q.zone_code} · {q.zone_name}
                  </Link>
                  <p className="text-[13px] text-slate-400">{q.priority_reason}</p>
                  <p className="mono text-xs text-slate-500">{q.main_evidence}</p>
                  <p className="text-[11px] text-slate-600">
                    Confidence: {q.confidence.toFixed(0)}% · Evidence score: {q.fusion_score.toFixed(0)}/100 · {new Date(q.timestamp).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <Link
                    to={`/zones/${q.zone_id}`}
                    className="whitespace-nowrap rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-ink-700 focus-ring"
                  >
                    Review evidence
                  </Link>
                  <button
                    disabled={busyZone === q.zone_id}
                    onClick={() => act(q.zone_id, 'reviewed', 'Marked reviewed')}
                    className="whitespace-nowrap rounded-md border border-flood-low/40 bg-flood-low/10 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-flood-low/20 focus-ring disabled:opacity-50"
                  >
                    Mark reviewed
                  </button>
                  <button
                    disabled={busyZone === q.zone_id}
                    onClick={() => act(q.zone_id, 'more_data_requested', 'Requested more data')}
                    className="whitespace-nowrap rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-ink-700 focus-ring disabled:opacity-50"
                  >
                    Request more data
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-16 text-center text-sm text-slate-500">No zones match this filter.</div>
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md border border-ink-600 bg-ink-800 px-4 py-2 text-sm text-slate-200 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
