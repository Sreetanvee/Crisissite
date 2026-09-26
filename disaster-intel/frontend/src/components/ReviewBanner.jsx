export default function ReviewBanner({ compact = false }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-md border border-signal-amber/30 bg-signal-amber/10 text-amber-200 ${
        compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'
      }`}
    >
      <svg width={compact ? 14 : 16} height={compact ? 14 : 16} viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0">
        <path d="M12 3L2 20h20L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M12 10v4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="12" cy="17.2" r="0.9" fill="currentColor" />
      </svg>
      <p className="leading-snug">
        <span className="font-semibold">AI-generated decision support.</span> Human review is required
        before any operational action. This system does not make autonomous emergency decisions.
      </p>
    </div>
  )
}
