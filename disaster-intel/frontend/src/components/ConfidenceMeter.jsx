export default function ConfidenceMeter({ confidence = 0, uncertainty, size = 'md' }) {
  const unc = uncertainty ?? (100 - confidence)
  const low = confidence < 60
  const barH = size === 'sm' ? 'h-1.5' : 'h-2'
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-400">Confidence</span>
        <span className={`mono font-medium ${low ? 'text-amber-300' : 'text-slate-200'}`}>{confidence.toFixed(0)}%</span>
      </div>
      <div className={`w-full rounded-full bg-ink-700 ${barH} overflow-hidden`}>
        <div
          className={`${barH} rounded-full ${low ? 'bg-signal-amber' : 'bg-signal-teal'}`}
          style={{ width: `${Math.max(2, Math.min(100, confidence))}%` }}
        />
      </div>
      {low && (
        <p className="mt-1 text-[11px] font-medium text-amber-300">
          LOW CONFIDENCE — HUMAN REVIEW REQUIRED
        </p>
      )}
      <p className="mt-0.5 text-[11px] text-slate-500">Uncertainty: {unc.toFixed(0)}%</p>
    </div>
  )
}
