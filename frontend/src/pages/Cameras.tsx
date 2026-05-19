import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { Camera } from '../lib/api'
import { Plus, Play, Square, Trash2, MapPin } from 'lucide-react'

export default function Cameras() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: cameras, isLoading } = useQuery<Camera[]>({
    queryKey: ['cameras'],
    queryFn: () => api.get('/cameras').then(r => r.data),
    refetchInterval: 5000,
  })

  const startMut = useMutation({
    mutationFn: (id: string) => api.post(`/cameras/${id}/start`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cameras'] }),
  })
  const stopMut = useMutation({
    mutationFn: (id: string) => api.post(`/cameras/${id}/stop`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cameras'] }),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/cameras/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cameras'] }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Camera Feeds</h2>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-3 py-2 rounded-lg transition-colors">
          <Plus size={16} /> Register Camera
        </button>
      </div>

      {showForm && <AddCameraForm onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['cameras'] }) }} />}

      {isLoading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : cameras?.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-12">No cameras registered yet.</p>
      ) : (
        <div className="space-y-3">
          {cameras?.map(cam => (
            <div key={cam.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full shrink-0 ${cam.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">{cam.name}</p>
                <p className="text-xs text-gray-500 font-mono truncate">{cam.source}</p>
                {cam.location.lat !== 0 && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin size={10} /> {cam.location.lat.toFixed(4)}, {cam.location.lng.toFixed(4)}
                    {cam.location.address && ` — ${cam.location.address}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>threshold: {cam.match_threshold}</span>
                <span>skip: {cam.frame_skip}</span>
              </div>
              <div className="flex gap-2">
                {cam.is_active ? (
                  <button onClick={() => stopMut.mutate(cam.id)} className="flex items-center gap-1 bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                    <Square size={12} /> Stop
                  </button>
                ) : (
                  <button onClick={() => startMut.mutate(cam.id)} className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                    <Play size={12} /> Start
                  </button>
                )}
                <button onClick={() => deleteMut.mutate(cam.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1.5">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AddCameraForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: fd.get('name'),
      source: fd.get('source'),
      location: { lat: parseFloat(fd.get('lat') as string) || 0, lng: parseFloat(fd.get('lng') as string) || 0, address: fd.get('address') },
      match_threshold: parseFloat(fd.get('match_threshold') as string) || 0.45,
      frame_skip: parseInt(fd.get('frame_skip') as string) || 3,
      police_station: { webhook_url: fd.get('webhook_url'), telegram_chat_id: fd.get('ps_telegram'), ntfy_topic: fd.get('ps_ntfy') },
    }
    try {
      await api.post('/cameras', payload)
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to register camera')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <p className="font-semibold text-white text-sm">Register New Camera</p>
      <div className="grid grid-cols-2 gap-3">
        <CField label="Camera Name *" name="name" required />
        <CField label="Source (RTSP URL / 0 for webcam)" name="source" required placeholder="rtsp://... or 0" />
        <CField label="Latitude" name="lat" type="number" placeholder="17.385" />
        <CField label="Longitude" name="lng" type="number" placeholder="78.486" />
        <CField label="Address (optional)" name="address" />
        <CField label="Match Threshold" name="match_threshold" type="number" placeholder="0.45" />
        <CField label="Frame Skip" name="frame_skip" type="number" placeholder="3" />
        <CField label="Police Station Webhook URL" name="webhook_url" />
        <CField label="Police Station Telegram ID" name="ps_telegram" />
        <CField label="Police Station ntfy Topic" name="ps_ntfy" />
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          {loading ? 'Registering…' : 'Register Camera'}
        </button>
      </div>
    </form>
  )
}

function CField({ label, name, required, type, placeholder }: { label: string; name: string; required?: boolean; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input type={type ?? 'text'} name={name} required={required} placeholder={placeholder} className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-emerald-500" />
    </div>
  )
}
