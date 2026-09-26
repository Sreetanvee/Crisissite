import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import api from '../services/api.js'
import { DemoBadge } from '../components/Badges.jsx'

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Timeline() {
  const [zones, setZones] = useState([])
  const [params, setParams] = useSearchParams()
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(true)

  const zoneId = params.get('zone')

  useEffect(() => {
    api.getZones().then((z) => {
      setZones(z)
      if (!zoneId && z.length) {
        setParams({ zone: z[0].id })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!zoneId) return
    setLoading(true)
    api.getTimeline(zoneId).then((data) => {
      setPoints(data)
      setLoading(false)
    })
  }, [zoneId])

  const currentZone = zones.find((z) => String(z.id) === String(zoneId))
  const chartData = points.map((p) => ({
    time: fmtTime(p.timestamp),
    Rainfall: p.rainfall_mm,
    'Water level': p.water_level_m,
    'Evidence score': p.fusion_score,
    'Confidence': p.confidence,
    label: p.label,
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Timeline</h1>
          <p className="text-sm text-slate-400">How conditions changed over the simulated event <DemoBadge className="ml-1 align-middle" /></p>
        </div>
        <select
          value={zoneId || ''}
          onChange={(e) => setParams({ zone: e.target.value })}
          className="rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-slate-200 focus-ring"
        >
          {zones.map((z) => (
            <option key={z.id} value={z.id}>{z.zone_code} · {z.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">Loading timeline…</div>
      ) : (
        <>
          <div className="rounded-lg border border-ink-700 bg-ink-900 p-4">
            <h3 className="mb-4 text-sm font-semibold text-slate-200">Rainfall &amp; water level</h3>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#212b3a" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
                <YAxis yAxisId="left" stroke="#64748b" fontSize={12} label={{ value: 'mm', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} label={{ value: 'm', angle: 90, position: 'insideRight', fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#171f2c', border: '1px solid #2c3a4d', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="left" type="monotone" dataKey="Rainfall" stroke="#8a94a6" strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="right" type="monotone" dataKey="Water level" stroke="#3f8f8a" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border border-ink-700 bg-ink-900 p-4">
            <h3 className="mb-4 text-sm font-semibold text-slate-200">Fusion score &amp; confidence</h3>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#212b3a" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ background: '#171f2c', border: '1px solid #2c3a4d', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Evidence score" stroke="#e0a63c" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Confidence" stroke="#c4553a" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border border-ink-700 bg-ink-900 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">Event log</h3>
            <ol className="space-y-2 text-sm">
              {points.map((p, i) => (
                <li key={i} className="flex items-center gap-3 border-l-2 border-ink-600 pl-3">
                  <span className="mono w-14 shrink-0 text-slate-500">{fmtTime(p.timestamp)}</span>
                  <span className="text-slate-300">→ {p.label}</span>
                  <span className="mono ml-auto shrink-0 text-xs text-slate-500">score {p.fusion_score?.toFixed(0)} · conf {p.confidence?.toFixed(0)}%</span>
                </li>
              ))}
            </ol>
          </div>

          {currentZone && (
            <Link to={`/zones/${currentZone.id}`} className="self-start text-xs font-medium text-teal-300 hover:text-teal-200">
              Inspect full evidence for {currentZone.zone_code} →
            </Link>
          )}
        </>
      )}
    </div>
  )
}
