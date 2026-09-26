import axios from 'axios'

const client = axios.create({ baseURL: '/api' })

export const api = {
  getEvents: () => client.get('/events').then(r => r.data),
  getZones: (eventId) => client.get('/zones', { params: { event_id: eventId } }).then(r => r.data),
  getZoneDetail: (zoneId) => client.get(`/zones/${zoneId}`).then(r => r.data),
  getWeather: (zoneId) => client.get('/weather', { params: { zone_id: zoneId } }).then(r => r.data),
  getSensors: (zoneId) => client.get('/sensors', { params: { zone_id: zoneId } }).then(r => r.data),
  getIncidents: (zoneId) => client.get('/incidents', { params: { zone_id: zoneId } }).then(r => r.data),
  getDetections: (zoneId) => client.get('/detections', { params: { zone_id: zoneId, latest_only: true } }).then(r => r.data),
  getAllLatestDetections: () => client.get('/detections', { params: { latest_only: true } }).then(r => r.data),
  getReviewQueue: () => client.get('/review-queue').then(r => r.data),
  postReview: (payload) => client.post('/reviews', payload).then(r => r.data),
  getTimeline: (zoneId) => client.get(`/timeline/${zoneId}`).then(r => r.data),
  analyzeZone: (zoneId) => client.post('/analyze', null, { params: { zone_id: zoneId } }).then(r => r.data),
  getEvaluation: () => client.get('/evaluation').then(r => r.data),
}

export const staticUrl = (path) => `/static/${path}`

export default api
