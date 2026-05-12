import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDetectionSocket } from '../hooks/useSocket'
import api from '../lib/api'
import type { Detection, HealthStatus } from '../lib/api'
import { AlertTriangle, Eye, Activity } from 'lucide-react'

interface LiveEvent {
  id: string
  detection_id: string
  person_name: string
  score: number
  confidence: string
  camera_name: string
  timestamp: string
  location?: { lat: number; lng: number }
}

export default function Dashboard() {
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([])
  const [toasts, setToasts] = useState<LiveEvent[]>([])

  const { data: health } = useQuery<HealthStatus>({
    queryKey: ['health'],
    queryFn: () => api.get('/health').then(r => r.data),  // direct path since health is at root
    refetchInterval: 10000,
  })

  const { data: detections } = useQuery<Detection[]>({
    queryKey: ['detections'],
    queryFn: () => api.get('/detections?limit=20').then(r => r.data),
    refetchInterval: 5000,
  })

  useDetectionSocket((data: LiveEvent) => {
    const event = { ...data, id: data.detection_id ?? Date.now().toString() }
    setLiveEvents(prev => [event, ...prev].slice(0, 50))
    if (data.confidence === 'HIGH') {
      setToasts(prev => [event, ...prev].slice(0, 5))
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== event.id)), 5000)
    }
  })

  const stats = {
    enrolled: health?.enrolled_persons ?? 0,
    total: detections?.length ?? 0,
    high: detections?.filter(d => d.confidence === 'HIGH').length ?? 0,
  }

  return (
    <div className="space-y-6">
      {/* Alert toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className="bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 w-72">
            <AlertTriangle size={18} />
            <div>
              <p className="font-bold text-sm">{t.person_name}</p>
              <p className="text-xs opacity-80">{t.camera_name} · {(t.score * 100).toFixed(0)}% match</p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-white">Dashboard</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Enrolled Persons" value={stats.enrolled} icon={<Eye size={20} />} color="emerald" />
        <StatCard label="Detections Today" value={stats.total} icon={<Activity size={20} />} color="blue" />
        <StatCard label="High Confidence" value={stats.high} icon={<AlertTriangle size={20} />} color="red" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Live feed */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="font-semibold text-sm text-gray-400 uppercase tracking-wide mb-3">Live Detection Feed</h3>
          {liveEvents.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">Waiting for detections…</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {liveEvents.map((e, i) => (
                <EventRow key={i} event={e} />
              ))}
            </div>
          )}
        </div>

        {/* Recent detections from DB */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="font-semibold text-sm text-gray-400 uppercase tracking-wide mb-3">Recent Detections</h3>
          {!detections || detections.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">No detections yet</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {detections.map(d => (
                <div key={d.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-800">
                  {d.snapshot_url && (
                    <img src={d.snapshot_url} alt="" className="w-10 h-10 rounded object-cover bg-gray-700" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{d.person_name ?? 'Unknown'}</p>
                    <p className="text-xs text-gray-500">{d.source_type} · {new Date(d.created_at).toLocaleTimeString()}</p>
                  </div>
                  <ConfidenceBadge confidence={d.confidence} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-900/30 border-emerald-800 text-emerald-400',
    blue: 'bg-blue-900/30 border-blue-800 text-blue-400',
    red: 'bg-red-900/30 border-red-800 text-red-400',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide opacity-70">{label}</span>
        {icon}
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  )
}

function EventRow({ event }: { event: LiveEvent }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-800 border border-gray-700">
      <AlertTriangle size={14} className="text-red-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{event.person_name}</p>
        <p className="text-xs text-gray-500">{event.camera_name} · {(event.score * 100).toFixed(0)}%</p>
      </div>
      <ConfidenceBadge confidence={event.confidence} />
    </div>
  )
}

function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return null
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      confidence === 'HIGH' ? 'bg-red-700 text-red-100' : 'bg-yellow-700 text-yellow-100'
    }`}>
      {confidence}
    </span>
  )
}
