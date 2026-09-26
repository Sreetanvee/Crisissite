import { useEffect, useState } from 'react'
import api from '../services/api.js'

function MetricRow({ label, value, suffix = '' }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-800 py-1.5 text-sm last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className="mono font-medium text-slate-100">{value}{suffix}</span>
    </div>
  )
}

function ConfusionMatrix({ cm }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-500">Confusion matrix</p>
      <div className="grid grid-cols-2 gap-1 text-center text-xs">
        <div className="rounded bg-flood-low/10 border border-flood-low/30 p-2">
          <p className="mono text-lg font-semibold text-emerald-300">{cm.true_negative}</p>
          <p className="text-slate-500">True negative</p>
        </div>
        <div className="rounded bg-signal-rust/10 border border-signal-rust/30 p-2">
          <p className="mono text-lg font-semibold text-red-300">{cm.false_positive}</p>
          <p className="text-slate-500">False positive</p>
        </div>
        <div className="rounded bg-signal-rust/10 border border-signal-rust/30 p-2">
          <p className="mono text-lg font-semibold text-red-300">{cm.false_negative}</p>
          <p className="text-slate-500">False negative</p>
        </div>
        <div className="rounded bg-flood-low/10 border border-flood-low/30 p-2">
          <p className="mono text-lg font-semibold text-emerald-300">{cm.true_positive}</p>
          <p className="text-slate-500">True positive</p>
        </div>
      </div>
    </div>
  )
}

function ModelCard({ title, metrics, description }) {
  if (!metrics) return null
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900 p-4">
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      <p className="mt-1 text-[12px] text-slate-500">{description}</p>
      <div className="mt-3">
        <MetricRow label="Accuracy" value={(metrics.accuracy * 100).toFixed(1)} suffix="%" />
        <MetricRow label="Precision" value={(metrics.precision * 100).toFixed(1)} suffix="%" />
        <MetricRow label="Recall" value={(metrics.recall * 100).toFixed(1)} suffix="%" />
        <MetricRow label="F1 score" value={(metrics.f1_score * 100).toFixed(1)} suffix="%" />
        <MetricRow label="Test samples" value={metrics.n_samples} />
      </div>
      <ConfusionMatrix cm={metrics.confusion_matrix} />
    </div>
  )
}

export default function ModelEvaluation() {
  const [evalData, setEvalData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getEvaluation().then((d) => {
      setEvalData(d)
      setLoading(false)
    })
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Model evaluation</h1>
        <p className="text-sm text-slate-400">Experimental evaluation results — not a measure of real-world performance</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">Running evaluation pipeline…</div>
      ) : !evalData?.available ? (
        <div className="rounded-lg border border-ink-700 bg-ink-900 p-8 text-center text-sm text-slate-500">
          Evaluation unavailable until a test dataset is supplied.
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-signal-amber/30 bg-signal-amber/10 p-4 text-sm text-amber-200">
            <p className="font-semibold">Experimental results — read this first</p>
            <p className="mt-1 leading-relaxed text-amber-200/90">{evalData.message}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ModelCard
              title="Baseline 1 — Image only"
              description="Lightweight color-index flood classifier acting alone on synthetic aerial tiles."
              metrics={evalData.baseline_image_only}
            />
            <ModelCard
              title="Baseline 2 — Weather / sensor only"
              description="Rainfall and water-level scores combined, no imagery."
              metrics={evalData.baseline_weather_sensor_only}
            />
            <ModelCard
              title="Final — Multimodal fusion"
              description="Image + rainfall + sensor evidence combined via the same weighted fusion used in production."
              metrics={evalData.multimodal_fusion}
            />
          </div>

          <div className="rounded-lg border border-ink-700 bg-ink-900 p-4">
            <h3 className="text-sm font-semibold text-slate-200">Methodology notes</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] text-slate-400">
              {evalData.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
