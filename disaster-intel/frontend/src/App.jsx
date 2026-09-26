import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import LiveMap from './pages/LiveMap.jsx'
import ReviewQueue from './pages/ReviewQueue.jsx'
import ZoneDetail from './pages/ZoneDetail.jsx'
import Timeline from './pages/Timeline.jsx'
import ModelEvaluation from './pages/ModelEvaluation.jsx'
import DatasetLimitations from './pages/DatasetLimitations.jsx'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/map', label: 'Live map' },
  { to: '/queue', label: 'Review queue' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/evaluation', label: 'Model evaluation' },
  { to: '/limitations', label: 'Dataset & limitations' },
]

export default function App() {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-signal-teal/15 border border-signal-teal/30">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0" stroke="#3f8f8a" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0" stroke="#3f8f8a" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
                <path d="M6 12L12 4l6 8" stroke="#e0a63c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="leading-tight">
              <p className="text-[13px] font-semibold text-slate-100">Disaster Intelligence</p>
              <p className="text-[11px] text-slate-500">Human Review Platform</p>
            </div>
          </div>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded px-3 py-1.5 text-[13px] font-medium transition-colors focus-ring ${
                    isActive
                      ? 'bg-ink-800 text-slate-100'
                      : 'text-slate-400 hover:bg-ink-800/60 hover:text-slate-200'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-1.5 rounded border border-flood-low/30 bg-flood-low/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Simulated event active
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-5 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/map" element={<LiveMap />} />
          <Route path="/queue" element={<ReviewQueue />} />
          <Route path="/zones/:zoneId" element={<ZoneDetail />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/evaluation" element={<ModelEvaluation />} />
          <Route path="/limitations" element={<DatasetLimitations />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="mx-auto max-w-[1400px] px-5 pb-8 pt-4 text-[11px] text-slate-600">
        Decision-support prototype · Flood scenario · All data is simulated unless otherwise noted
      </footer>
    </div>
  )
}
