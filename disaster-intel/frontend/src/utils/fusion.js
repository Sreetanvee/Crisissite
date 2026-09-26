// Mirrors app/services/fusion.py WEIGHTS exactly, so the "how was this
// score produced" panel is always in sync with what the backend actually
// computed (it does not re-derive the score - it just displays the same
// weights and per-modality scores stored on the Detection record).
export const WEIGHTS = { image: 0.40, rainfall: 0.25, sensor: 0.25, incident: 0.10 }

export const MODALITY_LABELS = {
  image: 'Satellite imagery',
  rainfall: 'Rainfall',
  sensor: 'Water-level sensors',
  incident: 'Incident reports',
}

export function computeBreakdown(detection) {
  if (!detection) return []
  const present = (detection.modalities_present || '').split(',').filter(Boolean)
  const scoreMap = {
    image: detection.image_score,
    rainfall: detection.rainfall_score,
    sensor: detection.sensor_score,
    incident: detection.incident_score,
  }
  const totalWeight = present.reduce((a, k) => a + (WEIGHTS[k] || 0), 0)
  return present.map((k) => {
    const raw = scoreMap[k]
    const effectiveWeight = totalWeight ? WEIGHTS[k] / totalWeight : 0
    return {
      key: k,
      label: MODALITY_LABELS[k] || k,
      rawScore: raw,
      originalWeight: WEIGHTS[k],
      effectiveWeight,
      contribution: (raw || 0) * effectiveWeight * 100,
    }
  })
}
