import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api, { staticUrl } from '../services/api.js'
import { PriorityBadge, StatusBadge, DemoBadge } from '../components/Badges.jsx'
import ConfidenceMeter from '../components/ConfidenceMeter.jsx'
import ReviewBanner from '../components/ReviewBanner.jsx'
import { computeBreakdown } from '../utils/fusion.js'

function EvidenceCard({ title, children, badge }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        {badge}
      </div>
      {children}
    </div>
  )
}

function highlightRefs(text) {
  const parts = text.split(/(\[[A-Z]+-\d+\])/g)
  return parts.map((part, i) =>
    /^\[[A-Z]+-\d+\]$/.test(part) ? (
      <span key={i} className="mono rounded bg-ink-700 px-1 py-0.5 text-[11px] font-medium text-teal-300">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

export default function ZoneDetail() {
  const { zoneId } = useParams()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)

  const load = () => {
    api.getZoneDetail(zoneId).then(setData)
  }

  useEffect(load, [zoneId])

  if (!data) {
    return <div className="py-24 text-center text-sm text-slate-500">Loading zone evidence…</div>
  }

  const { zone, latest_detection: det, satellite_images, weather_readings, sensor_readings, incident_reports } = data
  const breakdown = computeBreakdown(det)
  const latestWeather = weather_readings[weather_readings.length - 1]
  const latestSensor = sensor_readings[sensor_readings.length - 1]

  const act = async (status, label) => {
    setBusy(true)
    try {
      await api.postReview({ zone_id: zone.id, status, notes: '' })
      setToast(label)
      setTimeout(() => setToast(null), 2500)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">{zone.zone_code}</p>
          <h1 className="text-xl font-semibold text-slate-100">{zone.name}</h1>
          <p className="mt-1 text-sm text-slate-400">{zone.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {det && <PriorityBadge priority={det.priority} />}
            {det && <StatusBadge status={det.status} />}
            <DemoBadge />
          </div>
        </div>
        <Link to="/map" className="rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-ink-700 focus-ring">
          ← Back to map
        </Link>
      </div>

      <ReviewBanner compact />

      {!det ? (
        <div className="rounded-lg border border-ink-700 bg-ink-900 p-8 text-center text-sm text-slate-500">
          No detection evidence has been generated for this zone yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="flex flex-col gap-5 lg:col-span-2">
            <EvidenceCard title="Situation summary" badge={<span className="text-[11px] text-slate-500">as of {new Date(det.timestamp).toLocaleString()}</span>}>
              <p className="text-sm leading-relaxed text-slate-300">{highlightRefs(det.summary_text)}</p>
            </EvidenceCard>

            <EvidenceCard title="Multimodal evidence fusion — how this score was produced">
              <div className="mb-3 flex items-end gap-3">
                <p className="text-3xl font-semibold text-slate-100">{det.fusion_score.toFixed(0)}<span className="text-base text-slate-500">/100</span></p>
                <p className="pb-1 text-xs text-slate-500">Multimodal Evidence Score (not a guaranteed flood probability)</p>
              </div>
              <div className="space-y-2">
                {breakdown.map((b) => (
                  <div key={b.key} className="flex items-center gap-3 text-xs">
                    <span className="w-36 shrink-0 text-slate-400">{b.label}</span>
                    <span className="mono w-14 shrink-0 text-slate-300">{(b.rawScore * 100).toFixed(0)}%</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                      <div className="h-1.5 rounded-full bg-signal-teal" style={{ width: `${b.contribution}%` }} />
                    </div>
                    <span className="mono w-16 shrink-0 text-right text-slate-500">+{b.contribution.toFixed(1)} pts</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                Weight for each present modality: image ×0.40, rainfall ×0.25, sensor ×0.25, incident ×0.10 (missing
                modalities' weight is redistributed proportionally among the ones available, and this is disclosed
                as "limited evidence" rather than hidden).
              </p>
            </EvidenceCard>

            <EvidenceCard
              title="Satellite / aerial imagery"
              badge={<span className="rounded border border-ink-500 bg-ink-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">SYNTHETIC DEMO IMAGERY</span>}
            >
              {satellite_images.length === 0 ? (
                <p className="text-sm text-slate-500">No imagery available for this zone — limited evidence.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {satellite_images.map((img) => (
                    <div key={img.id} className="overflow-hidden rounded-md border border-ink-700">
                      <img src={staticUrl(img.filename)} alt={img.image_code} className="h-40 w-full object-cover" />
                      <div className="space-y-1 p-2.5">
                        <p className="mono text-xs text-slate-400">{img.image_code} · {new Date(img.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-sm font-medium text-slate-200">Flood likelihood: {(img.flood_probability * 100).toFixed(0)}%</p>
                        <p className="text-[11px] text-slate-500">Classifier confidence: {(img.analysis_confidence * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-[11px] text-slate-600">
                Generated from a lightweight color-index heuristic classifier, not a trained deep-learning model. See Model Evaluation for methodology.
              </p>
            </EvidenceCard>

            <EvidenceCard title="Incident reports" badge={<span className="text-[11px] text-slate-500">{incident_reports.length} report(s)</span>}>
              {incident_reports.length === 0 ? (
                <p className="text-sm text-slate-500">No incident reports for this zone — limited evidence.</p>
              ) : (
                <ul className="space-y-3">
                  {incident_reports.map((ir) => (
                    <li key={ir.id} className="border-l-2 border-ink-600 pl-3">
                      <p className="text-sm text-slate-300">"{ir.text}"</p>
                      <p className="mono mt-0.5 text-[11px] text-slate-500">
                        {ir.report_code} · {ir.source.replace('_', ' ')} · {new Date(ir.timestamp).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </EvidenceCard>
          </div>

          <div className="flex flex-col gap-5">
            <EvidenceCard title="Confidence &amp; uncertainty">
              <ConfidenceMeter confidence={det.confidence} uncertainty={det.uncertainty} />
              <p className="mt-3 text-[11px] text-slate-500">{det.priority_reason}</p>
            </EvidenceCard>

            <EvidenceCard title="Latest weather">
              {latestWeather ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-[11px] text-slate-500">Rainfall</p><p className="font-medium text-slate-100">{latestWeather.rainfall_mm.toFixed(0)} mm</p></div>
                  <div><p className="text-[11px] text-slate-500">Temperature</p><p className="font-medium text-slate-100">{latestWeather.temperature_c.toFixed(0)}°C</p></div>
                  <div><p className="text-[11px] text-slate-500">Humidity</p><p className="font-medium text-slate-100">{latestWeather.humidity_pct.toFixed(0)}%</p></div>
                  <div><p className="text-[11px] text-slate-500">Wind</p><p className="font-medium text-slate-100">{latestWeather.wind_kmh.toFixed(0)} km/h</p></div>
                  <p className="mono col-span-2 text-[11px] text-slate-600">{latestWeather.reading_code} · {new Date(latestWeather.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              ) : <p className="text-sm text-slate-500">No weather data.</p>}
            </EvidenceCard>

            <EvidenceCard title="Latest sensor reading">
              {latestSensor ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-[11px] text-slate-500">Water level</p><p className="font-medium text-slate-100">{latestSensor.water_level_m.toFixed(1)} m</p></div>
                  <div><p className="text-[11px] text-slate-500">Change</p><p className={`font-medium ${latestSensor.change_m_per_hr > 0.5 ? 'text-red-300' : 'text-slate-100'}`}>{latestSensor.change_m_per_hr >= 0 ? '+' : ''}{latestSensor.change_m_per_hr.toFixed(1)} m/hr</p></div>
                  <p className="mono col-span-2 text-[11px] text-slate-600">{latestSensor.sensor_code} · {new Date(latestSensor.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              ) : <p className="text-sm text-slate-500">No sensor data.</p>}
            </EvidenceCard>

            <EvidenceCard title="Review this zone">
              <div className="flex flex-col gap-2">
                <button disabled={busy} onClick={() => act('reviewed', 'Marked reviewed')} className="rounded-md border border-flood-low/40 bg-flood-low/10 px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-flood-low/20 focus-ring disabled:opacity-50">
                  Mark reviewed
                </button>
                <button disabled={busy} onClick={() => act('more_data_requested', 'Requested more data')} className="rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-ink-700 focus-ring disabled:opacity-50">
                  Request more data
                </button>
                <Link to="/timeline" className="rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-center text-sm font-medium text-slate-300 hover:bg-ink-700 focus-ring">
                  View timeline →
                </Link>
              </div>
              {toast && <p className="mt-2 text-xs font-medium text-emerald-300">{toast}</p>}
            </EvidenceCard>
          </div>
        </div>
      )}
    </div>
  )
}
