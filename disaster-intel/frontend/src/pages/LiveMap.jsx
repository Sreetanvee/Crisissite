import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, Popup } from 'react-leaflet'
import { Link } from 'react-router-dom'
import api from '../services/api.js'
import { PriorityBadge, StatusBadge, DemoBadge } from '../components/Badges.jsx'
import ConfidenceMeter from '../components/ConfidenceMeter.jsx'

const PRIORITY_COLOR = { high: '#c4553a', medium: '#e0a63c', low: '#4c9a7b' }

const LAYER_OPTIONS = [
  { key: 'zones', label: 'Affected zones' },
  { key: 'sensors', label: 'Sensors' },
  { key: 'incidents', label: 'Incident reports' },
  { key: 'weather', label: 'Weather stations' },
]

export default function LiveMap() {
  const [zones, setZones] = useState([])
  const [queueByZone, setQueueByZone] = useState({})
  const [details, setDetails] = useState({}) // zoneId -> zone detail
  const [selectedZoneId, setSelectedZoneId] = useState(null)
  const [layers, setLayers] = useState({ zones: true, sensors: true, incidents: true, weather: false })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([api.getZones(), api.getReviewQueue()]).then(async ([zonesData, queueData]) => {
      if (!mounted) return
      setZones(zonesData)
      const qMap = {}
      queueData.forEach((q) => { qMap[q.zone_id] = q })
      setQueueByZone(qMap)
      const detailPairs = await Promise.all(zonesData.map((z) => api.getZoneDetail(z.id).then((d) => [z.id, d])))
      if (!mounted) return
      const dMap = {}
      detailPairs.forEach(([id, d]) => { dMap[id] = d })
      setDetails(dMap)
      setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  const center = useMemo(() => {
    if (!zones.length) return [17.4, 78.45]
    const lat = zones.reduce((a, z) => a + z.lat, 0) / zones.length
    const lon = zones.reduce((a, z) => a + z.lon, 0) / zones.length
    return [lat, lon]
  }, [zones])

  const selected = selectedZoneId ? details[selectedZoneId] : null
  const selectedQueue = selectedZoneId ? queueByZone[selectedZoneId] : null

  const toggleLayer = (key) => setLayers((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Live map</h1>
          <p className="text-sm text-slate-400">Affected zones, sensors, incident reports, and weather stations <DemoBadge className="ml-1 align-middle" /></p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LAYER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => toggleLayer(opt.key)}
              className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors focus-ring ${
                layers[opt.key]
                  ? 'border-signal-teal/40 bg-signal-teal/10 text-teal-200'
                  : 'border-ink-700 bg-ink-900 text-slate-500 hover:text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="h-[600px] overflow-hidden rounded-lg border border-ink-700">
          {!loading && (
            <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap contributors &copy; CARTO'
              />
              {layers.zones && zones.map((z) => {
                const q = queueByZone[z.id]
                const color = PRIORITY_COLOR[q?.priority] || '#3d4f68'
                return (
                  <Circle
                    key={`zone-${z.id}`}
                    center={[z.lat, z.lon]}
                    radius={z.radius_m}
                    pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: selectedZoneId === z.id ? 0.35 : 0.18 }}
                    eventHandlers={{ click: () => setSelectedZoneId(z.id) }}
                  >
                    <Popup>
                      <p className="font-semibold">{z.zone_code} · {z.name}</p>
                      <p>Priority: {q?.priority || 'n/a'}</p>
                      <p>Confidence: {q ? `${q.confidence.toFixed(0)}%` : 'n/a'}</p>
                    </Popup>
                  </Circle>
                )
              })}
              {layers.sensors && zones.flatMap((z) =>
                (details[z.id]?.sensor_readings || []).slice(-1).map((s) => (
                  <CircleMarker key={`sensor-${s.id}`} center={[s.lat, s.lon]} radius={5} pathOptions={{ color: '#3f8f8a', fillColor: '#3f8f8a', fillOpacity: 0.9 }}>
                    <Popup>
                      <p className="font-semibold">Sensor {s.sensor_code}</p>
                      <p>Water level: {s.water_level_m.toFixed(1)} m</p>
                      <p>Change: {s.change_m_per_hr >= 0 ? '+' : ''}{s.change_m_per_hr.toFixed(1)} m/hr</p>
                    </Popup>
                  </CircleMarker>
                ))
              )}
              {layers.incidents && zones.flatMap((z) =>
                (details[z.id]?.incident_reports || []).map((ir) => (
                  <CircleMarker key={`incident-${ir.id}`} center={[ir.lat, ir.lon]} radius={5} pathOptions={{ color: '#e0a63c', fillColor: '#e0a63c', fillOpacity: 0.9 }}>
                    <Popup>
                      <p className="font-semibold">Incident {ir.report_code}</p>
                      <p>{ir.text}</p>
                    </Popup>
                  </CircleMarker>
                ))
              )}
              {layers.weather && zones.flatMap((z) =>
                (details[z.id]?.weather_readings || []).slice(-1).map((w) => (
                  <CircleMarker key={`weather-${w.id}`} center={[w.lat, w.lon]} radius={4} pathOptions={{ color: '#8a94a6', fillColor: '#8a94a6', fillOpacity: 0.8 }}>
                    <Popup>
                      <p className="font-semibold">Station {w.reading_code}</p>
                      <p>Rainfall: {w.rainfall_mm.toFixed(0)} mm</p>
                      <p>Temp: {w.temperature_c.toFixed(0)}°C</p>
                    </Popup>
                  </CircleMarker>
                ))
              )}
            </MapContainer>
          )}
        </div>

        <div className="rounded-lg border border-ink-700 bg-ink-900 p-4">
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center text-sm text-slate-500">
              <p>Click a zone on the map to inspect it.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">{selected.zone.zone_code}</p>
                  <h3 className="text-base font-semibold text-slate-100">{selected.zone.name}</h3>
                </div>
                {selectedQueue && <PriorityBadge priority={selectedQueue.priority} />}
              </div>
              {selected.latest_detection && <StatusBadge status={selected.latest_detection.status} />}
              {selected.latest_detection && (
                <>
                  <div className="mt-1">
                    <p className="text-[11px] text-slate-500">Multimodal Evidence Score</p>
                    <p className="text-2xl font-semibold text-slate-100">{selected.latest_detection.fusion_score.toFixed(0)}<span className="text-sm text-slate-500">/100</span></p>
                  </div>
                  <ConfidenceMeter confidence={selected.latest_detection.confidence} uncertainty={selected.latest_detection.uncertainty} />
                  <p className="text-[13px] leading-relaxed text-slate-400">{selected.latest_detection.summary_text}</p>
                </>
              )}
              <Link
                to={`/zones/${selected.zone.id}`}
                className="mt-1 rounded-md border border-signal-teal/40 bg-signal-teal/10 px-3 py-2 text-center text-sm font-medium text-teal-200 hover:bg-signal-teal/20 focus-ring"
              >
                Inspect full evidence →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
