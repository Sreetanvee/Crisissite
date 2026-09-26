import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api.js'
import ReviewBanner from '../components/ReviewBanner.jsx'
import { PriorityBadge, StatusBadge, DemoBadge } from '../components/Badges.jsx'

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold ${accent || 'text-slate-100'}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-500">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const [event, setEvent] = useState(null)
  const [zones, setZones] = useState([])
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([api.getEvents(), api.getZones(), api.getReviewQueue()]).then(
      ([events, zonesData, queueData]) => {
        if (!mounted) return
        setEvent(events[0] || null)
        setZones(zonesData)
        setQueue(queueData)
        setLoading(false)
      }
    )
    return () => { mounted = false }
  }, [])

  if (loading) {
    return <div className="py-24 text-center text-sm text-slate-500">Loading operational picture…</div>
  }

  const highPriority = queue.filter((q) => q.priority === 'high').length
  const avgConfidence = queue.length
    ? Math.round(queue.reduce((a, q) => a + q.confidence, 0) / queue.length)
    : 0
  const lastUpdated = event ? new Date(event.updated_at) : null
  const topQueue = queue.slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Disaster Intelligence &amp; Human Review Platform</h1>
            <p className="mt-1 text-sm text-slate-400">
              {event?.name} <DemoBadge className="ml-2 align-middle" />
            </p>
          </div>
          <Link
            to="/queue"
            className="rounded-md border border-signal-teal/40 bg-signal-teal/10 px-3.5 py-2 text-sm font-medium text-teal-200 transition-colors hover:bg-signal-teal/20 focus-ring"
          >
            Open review queue →
          </Link>
        </div>
        <div className="mt-4">
          <ReviewBanner />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Active event" value={event?.status === 'active' ? 'Active' : 'Resolved'} sub={event?.region} accent="text-emerald-300" />
        <StatCard label="Disaster type" value="Flood" sub="Wildfire out of scope for MVP" />
        <StatCard label="Last updated" value={lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'} sub={lastUpdated ? lastUpdated.toLocaleDateString() : ''} />
        <StatCard label="Potentially affected zones" value={zones.length} sub="of 10 monitored zones" />
        <StatCard label="High priority reviews" value={highPriority} accent={highPriority > 0 ? 'text-red-300' : 'text-slate-100'} sub="Needs immediate attention" />
        <StatCard label="Avg. model confidence" value={`${avgConfidence}%`} accent={avgConfidence < 60 ? 'text-amber-300' : 'text-slate-100'} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border border-ink-700 bg-ink-900">
          <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-200">Top human review priorities</h2>
            <Link to="/queue" className="text-xs font-medium text-teal-300 hover:text-teal-200">View all →</Link>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Zone</th>
                <th className="px-4 py-2 font-medium">Priority</th>
                <th className="px-4 py-2 font-medium">Evidence status</th>
                <th className="px-4 py-2 font-medium">Score</th>
                <th className="px-4 py-2 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {topQueue.map((q) => (
                <tr key={q.zone_id} className="border-t border-ink-800 hover:bg-ink-800/40">
                  <td className="px-4 py-2.5">
                    <Link to={`/zones/${q.zone_id}`} className="font-medium text-slate-100 hover:text-teal-300">
                      {q.zone_code} · {q.zone_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5"><PriorityBadge priority={q.priority} /></td>
                  <td className="px-4 py-2.5"><StatusBadge status={q.status} /></td>
                  <td className="px-4 py-2.5 mono text-slate-300">{q.fusion_score.toFixed(0)}/100</td>
                  <td className="px-4 py-2.5 mono text-slate-300">{q.confidence.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-ink-700 bg-ink-900 p-4">
          <h2 className="text-sm font-semibold text-slate-200">How to read this dashboard</h2>
          <ul className="mt-3 space-y-2.5 text-[13px] text-slate-400">
            <li><span className="font-medium text-slate-200">Multimodal Evidence Score</span> — a transparent, weighted combination of satellite, rainfall, water-level, and incident-report evidence. It is not a "guaranteed" flood probability.</li>
            <li><span className="font-medium text-slate-200">Priority</span> — means a zone needs human attention, not that it is automatically dangerous.</li>
            <li><span className="font-medium text-slate-200">Confidence</span> — reflects both evidence completeness and cross-modality agreement. Below 60% is flagged for mandatory review.</li>
          </ul>
          <Link to="/limitations" className="mt-4 inline-block text-xs font-medium text-teal-300 hover:text-teal-200">
            Read dataset &amp; model limitations →
          </Link>
        </div>
      </div>
    </div>
  )
}
