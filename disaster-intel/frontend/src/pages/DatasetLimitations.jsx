const SECTIONS = [
  {
    title: 'Geographic limitations',
    body: 'Demo zones are modeled on a single metro area. Terrain, drainage infrastructure, and flood dynamics vary enormously by geography, so this configuration should not be assumed to generalize elsewhere without re-calibration.',
  },
  {
    title: 'Weather / domain limitations',
    body: 'Weather readings are simulated at a per-zone granularity and do not capture microclimate variation, upstream watershed effects, or multi-day accumulation.',
  },
  {
    title: 'Satellite image resolution limitations',
    body: 'Demo imagery is procedurally generated at a single fixed tile size and does not reflect real sensor resolution, revisit frequency, cloud cover, or atmospheric distortion that affect real satellite/aerial products.',
  },
  {
    title: 'Sensor coverage limitations',
    body: 'Only one simulated sensor per zone per timestep is used. Real deployments have uneven, sparse, and sometimes non-functioning sensor networks, which this MVP does not model.',
  },
  {
    title: 'Class imbalance',
    body: 'The evaluation test set uses a roughly balanced synthetic flood/non-flood split. Real-world flood events are comparatively rare, so real deployments will see far more negative cases and should re-tune thresholds accordingly.',
  },
  {
    title: 'Possible false positives',
    body: 'Dark, shadowed, or naturally low-saturation terrain (e.g. dense tree cover, wet soil, asphalt after rain) can resemble flood water to the color-index classifier used here.',
  },
  {
    title: 'Possible false negatives',
    body: 'Shallow, clear, or partially-obscured flood water can fail to trigger the heuristic image classifier, and rapid onset floods may outpace the sensor/weather reporting cadence modeled here.',
  },
  {
    title: 'Missing data',
    body: 'When a modality is unavailable, its fusion weight is redistributed among the modalities that are present and this is flagged as "Limited evidence" rather than silently treated as a confirming or disconfirming signal.',
  },
  {
    title: 'Temporal mismatch between modalities',
    body: 'Satellite imagery, weather readings, sensor readings, and incident reports do not arrive at the same cadence. This system aligns them to the nearest available reading per zone, which can introduce staleness of a few hours in a real deployment.',
  },
  {
    title: 'Bias from limited geographic regions',
    body: 'A fusion model or heuristic tuned on data from one region can carry that region\'s terrain, climate, and infrastructure biases into visually or hydrologically different regions. Any real deployment should validate performance per-region before trusting scores across a new area.',
  },
]

export default function DatasetLimitations() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Dataset &amp; model limitations</h1>
        <p className="text-sm text-slate-400">This system does not work universally. Read this before trusting any score it produces.</p>
      </div>

      <div className="rounded-lg border border-signal-rust/30 bg-signal-rust/10 p-4 text-sm text-red-200">
        This is a decision-support prototype built for a hackathon demonstration using simulated data. It has not
        been validated against real flood events and must not be used for real operational decisions without
        substantial further validation, real datasets, and human oversight.
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <div key={s.title} className="rounded-lg border border-ink-700 bg-ink-900 p-4">
            <h3 className="text-sm font-semibold text-slate-200">{s.title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
