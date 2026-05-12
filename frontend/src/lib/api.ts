import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export default api

// ── Types ────────────────────────────────────────────────────────────────────

export interface AlertContact {
  telegram_chat_id: string
  email: string
  ntfy_topic: string
}

export interface Person {
  id: string
  name: string
  category: string
  alert_contact: AlertContact
  other_details: string
  image_url: string | null
  has_embedding: boolean
  num_images: number
  created_at: string
}

export interface Location {
  lat: number
  lng: number
  address: string
}

export interface PoliceStation {
  webhook_url: string
  telegram_chat_id: string
  ntfy_topic: string
}

export interface Camera {
  id: string
  name: string
  source: string
  location: Location
  match_threshold: number
  frame_skip: number
  is_active: boolean
  celery_task_id: string | null
  police_station: PoliceStation
  created_at: string
}

export interface Detection {
  id: string
  source_type: string
  source_id: string | null
  frame_timestamp: string
  bounding_box: { x1: number; y1: number; x2: number; y2: number } | null
  snapshot_url: string | null
  person_id: string | null
  person_name: string | null
  match_score: number | null
  confidence: string | null
  location: { lat: number; lng: number } | null
  created_at: string
}

export interface Alert {
  id: string
  detection_id: string
  person_id: string
  person_name: string
  channel: string
  recipient: string
  message: string
  status: string
  error: string | null
  sent_at: string | null
}

export interface MediaJob {
  id: string
  filename: string
  file_type: string
  status: string
  total_frames: number
  processed_frames: number
  detections_found: number
  error: string | null
  created_at: string
  completed_at: string | null
}

export interface HealthStatus {
  status: string
  database: string
  enrolled_persons: number
  env: string
  version: string
}
