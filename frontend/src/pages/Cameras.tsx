import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { Camera } from '../lib/api'
import { Plus, Play, Square, Trash2, MapPin, Camera as CamIcon, Radio } from 'lucide-react'
import {
  Panel,
  PageHeader,
  MxButton,
  MxInput,
  FormHeader,
  FormError,
  LoadingLine,
  EmptyState,
} from '../components/matrix'

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

  const activeCount = cameras?.filter(c => c.is_active).length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        label="Sensor Network"
        title="Camera Feeds"
        right={
          <>
            <span className="font-mono text-[11px] text-mx-text-mute tracking-wider">
              ACTIVE · <span className="text-mx-green-200">{activeCount}</span>
              <span className="text-mx-text-faint">/{cameras?.length ?? 0}</span>
            </span>
            <MxButton variant="primary" icon={<Plus size={14} />} onClick={() => setShowForm(v => !v)}>
              {showForm ? 'Close' : 'Register Camera'}
            </MxButton>
          </>
        }
      />

      {showForm && (
        <AddCameraForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false)
            qc.invalidateQueries({ queryKey: ['cameras'] })
          }}
        />
      )}

      {isLoading ? (
        <LoadingLine text="scanning network" />
      ) : cameras?.length === 0 ? (
        <EmptyState icon={<CamIcon size={26} />} title="No cameras registered" sub="register a feed to start monitoring" />
      ) : (
        <div className="space-y-3">
          {cameras?.map(cam => (
            <CameraRow
              key={cam.id}
              cam={cam}
              onStart={() => startMut.mutate(cam.id)}
              onStop={() => stopMut.mutate(cam.id)}
              onDelete={() => deleteMut.mutate(cam.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CameraRow({
  cam,
  onStart,
  onStop,
  onDelete,
}: {
  cam: Camera
  onStart: () => void
  onStop: () => void
  onDelete: () => void
}) {
  return (
    <Panel
      tone={cam.is_active ? 'active' : 'default'}
      glow={cam.is_active ? 'soft' : 'none'}
      scanning={cam.is_active}
      className="p-4"
    >
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`w-10 h-10 rounded-md border flex items-center justify-center shrink-0 ${
              cam.is_active
                ? 'border-mx-green-700/50 bg-mx-green-900/40 text-mx-green-300'
                : 'border-mx-border bg-mx-bg-elev text-mx-text-faint'
            }`}
          >
            <CamIcon size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p
                className={`font-display font-semibold truncate ${
                  cam.is_active ? 'text-mx-green-50' : 'text-mx-text-dim'
                }`}
              >
                {cam.name}
              </p>
              {cam.is_active ? (
                <span
                  className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-mx-green-700/60 bg-mx-green-900/50 text-mx-green-200"
                >
                  ● LIVE
                </span>
              ) : (
                <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-mx-border text-mx-text-faint">
                  OFFLINE
                </span>
              )}
            </div>
            <p className="font-mono text-[10.5px] text-mx-text-mute tracking-wider truncate mt-1">
              <Radio size={9} className="inline mr-1 opacity-60" />
              {cam.source}
            </p>
            {cam.location.lat !== 0 && (
              <p className="font-mono text-[10.5px] text-mx-text-faint tracking-wider mt-0.5">
                <MapPin size={9} className="inline mr-1 opacity-60" />
                {cam.location.lat.toFixed(4)}, {cam.location.lng.toFixed(4)}
                {cam.location.address && <span> · {cam.location.address}</span>}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] text-mx-text-mute shrink-0">
          <span className="px-2 py-1 rounded border border-mx-border bg-mx-bg-elev">
            THRESHOLD <span className="text-mx-green-200">{cam.match_threshold}</span>
          </span>
          <span className="px-2 py-1 rounded border border-mx-border bg-mx-bg-elev">
            SKIP <span className="text-mx-green-200">{cam.frame_skip}</span>
          </span>
        </div>
        <div className="flex gap-2 shrink-0">
          {cam.is_active ? (
            <MxButton variant="danger" size="sm" icon={<Square size={11} />} onClick={onStop}>
              Stop
            </MxButton>
          ) : (
            <MxButton variant="primary" size="sm" icon={<Play size={11} />} onClick={onStart}>
              Start
            </MxButton>
          )}
          <button
            onClick={onDelete}
            className="text-mx-text-faint hover:text-red-400 transition-colors p-1.5"
            aria-label="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </Panel>
  )
}

function AddCameraForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
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
      location: {
        lat: parseFloat(fd.get('lat') as string) || 0,
        lng: parseFloat(fd.get('lng') as string) || 0,
        address: fd.get('address'),
      },
      match_threshold: parseFloat(fd.get('match_threshold') as string) || 0.45,
      frame_skip: parseInt(fd.get('frame_skip') as string) || 3,
      police_station: {
        webhook_url: fd.get('webhook_url'),
        telegram_chat_id: fd.get('ps_telegram'),
        ntfy_topic: fd.get('ps_ntfy'),
      },
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
    <Panel glow="strong" accent className="p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormHeader icon={<CamIcon size={14} />} title="Register New Camera" onClose={onClose} />
        <div className="grid grid-cols-2 gap-3">
          <MxInput name="name" label="Camera Name" required />
          <MxInput name="source" label="Source (RTSP / 0)" required placeholder="rtsp://… or 0" />
          <MxInput name="lat" label="Latitude" type="number" step="any" placeholder="17.385" />
          <MxInput name="lng" label="Longitude" type="number" step="any" placeholder="78.486" />
          <MxInput name="address" label="Address" className="col-span-2" />
          <MxInput name="match_threshold" label="Match Threshold" type="number" step="0.01" placeholder="0.45" />
          <MxInput name="frame_skip" label="Frame Skip" type="number" placeholder="3" />
          <MxInput name="webhook_url" label="Police Webhook URL" className="col-span-2" />
          <MxInput name="ps_telegram" label="Police Telegram ID" />
          <MxInput name="ps_ntfy" label="Police ntfy Topic" />
        </div>
        {error && <FormError msg={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <MxButton type="button" variant="ghost" onClick={onClose}>
            Cancel
          </MxButton>
          <MxButton type="submit" variant="primary" disabled={loading}>
            {loading ? 'Registering…' : 'Register Camera'}
          </MxButton>
        </div>
      </form>
    </Panel>
  )
}
