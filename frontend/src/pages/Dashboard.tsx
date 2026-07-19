import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDetectionSocket } from '../hooks/useSocket'
import api from '../lib/api'
import type { Detection, HealthStatus } from '../lib/api'
import { AlertTriangle, Eye, Activity, Radar, Image as ImgIcon } from 'lucide-react'
import { Panel, StatusDot, DigitalRain } from '../components/matrix'

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
  const [pulsing, setPulsing] = useState<Set<string>>(new Set())

  const { data: health } = useQuery<HealthStatus>({
    queryKey: ['health'],
    queryFn: () => api.get('/health').then(r => r.data),
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
    setPulsing(prev => new Set(prev).add(event.id))
    setTimeout(() => {
      setPulsing(prev => {
        const next = new Set(prev)
        next.delete(event.id)
        return next
      })
    }, 2800)
  })

  const stats = {
    enrolled: health?.enrolled_persons ?? 0,
    total: detections?.length ?? 0,
    high: detections?.filter(d => d.confidence === 'HIGH').length ?? 0,
  }

  return (
    <div className="space-y-6">
      {/* Toasts */}
      <div className="fixed top-16 right-6 z-50 space-y-2 w-80">
        {toasts.map(t => (
          <Panel
            key={t.id}
            tone="danger"
            glow="danger"
            className="px-4 py-3 mx-pulse-danger glass-specular backdrop-blur-xl"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-mx-danger mt-0.5 shrink-0" style={{ filter: 'drop-shadow(0 0 6px rgba(255,48,80,0.7))' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="font-display font-bold text-sm text-red-100 text-glow-danger">
                    {t.person_name}
                  </p>
                  <span className="font-mono text-[10px] text-red-300 tracking-wider">HIGH</span>
                </div>
                <p className="font-mono text-[11px] text-red-200/80 truncate">
                  {t.camera_name} · {(t.score * 100).toFixed(1)}% match
                </p>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      {/* Page header */}
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-mx-text-faint mb-2">
            Operator Console
          </div>
          <h2 className="font-display font-bold text-[32px] leading-none tracking-tight text-mx-green-50 text-glow">
            Dashboard
          </h2>
        </div>
        <div className="flex items-center gap-5 pb-1">
          <StatusDot variant="green" label="Scanning" />
          <span className="font-mono text-[11px] text-mx-text-mute tracking-wider">
            HEALTH · <span className="text-mx-green-200">{health?.status?.toUpperCase() ?? 'INIT'}</span>
          </span>
        </div>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Enrolled Persons"
          code="PSN.E"
          value={stats.enrolled}
          icon={<Eye size={16} />}
          variant="green"
        />
        <StatCard
          label="Detections (24h)"
          code="DET.T"
          value={stats.total}
          icon={<Activity size={16} />}
          variant="green"
        />
        <StatCard
          label="High Confidence"
          code="DET.H"
          value={stats.high}
          icon={<AlertTriangle size={16} />}
          variant="danger"
        />
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Live feed */}
        <Panel glow="soft" accent scanning className="col-span-3 overflow-hidden flex flex-col h-[440px]">
          <PanelHeader
            icon={<Radar size={13} className="text-mx-green-400" />}
            title="Live Detection Feed"
            right={<StatusDot variant="green" />}
          />
          {liveEvents.length === 0 ? (
            <EmptyFeed />
          ) : (
            <div className="flex-1 min-h-0 p-3 space-y-1.5 overflow-y-auto">
              {liveEvents.map(e => (
                <EventRow key={e.id} event={e} pulsing={pulsing.has(e.id)} />
              ))}
            </div>
          )}
        </Panel>

        {/* Recent detections */}
        <Panel glow="soft" accent className="col-span-2 overflow-hidden flex flex-col h-[440px]">
          <PanelHeader
            icon={<Activity size={13} className="text-mx-green-400" />}
            title="Recent Detections"
            right={
              <span className="font-mono text-[10px] text-mx-text-faint tracking-wider">
                {detections?.length ?? 0} REC
              </span>
            }
          />
          {!detections || detections.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="font-mono text-xs text-mx-text-mute">
                <span className="opacity-50">// </span>no detections recorded
              </p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 divide-y divide-mx-border/60 overflow-y-auto">
              {detections.map(d => (
                <DetectionRow key={d.id} d={d} />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

/* ---------- subcomponents ---------- */

function PanelHeader({
  icon,
  title,
  right,
}: {
  icon: React.ReactNode
  title: string
  right?: React.ReactNode
}) {
  return (
    <div className="shrink-0 flex items-center justify-between px-4 h-11 border-b border-mx-border">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-display font-semibold text-[11px] uppercase tracking-[0.25em] text-mx-green-100">
          {title}
        </h3>
      </div>
      {right}
    </div>
  )
}

function StatCard({
  label,
  code,
  value,
  icon,
  variant = 'green',
}: {
  label: string
  code: string
  value: number
  icon: React.ReactNode
  variant?: 'green' | 'danger'
}) {
  const t =
    variant === 'danger'
      ? {
          accent: 'text-mx-danger',
          numGlow: 'text-glow-danger',
          chip: 'border-red-700/50 bg-red-900/30 text-red-300',
          iconBg: 'glass-specular border border-red-600/50 bg-red-950/50 text-mx-danger',
          shadow: 'drop-shadow(0 0 8px rgba(255,48,80,0.55))',
        }
      : {
          accent: 'text-mx-green-400',
          numGlow: 'text-glow',
          chip: 'border-mx-green-700/60 bg-mx-green-900/40 text-mx-green-200',
          iconBg: 'glass-green glass-specular text-mx-green-100',
          shadow: 'drop-shadow(0 0 8px rgba(0,255,136,0.5))',
        }
  return (
    <Panel accent glow={variant === 'danger' ? 'danger' : 'soft'} className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${t.iconBg}`}
          style={{ filter: t.shadow }}
        >
          <span className="relative z-[1]">{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[13px] font-medium text-mx-text-dim leading-tight">
            {label}
          </div>
          <div className="font-mono text-[9.5px] text-mx-text-faint tracking-[0.25em] mt-0.5">
            {code}
          </div>
        </div>
      </div>
      <div className="flex items-end justify-between">
        <p className={`font-display font-bold text-[44px] leading-none tabular-nums ${t.accent} ${t.numGlow}`}>
          {String(value).padStart(2, '0')}
        </p>
        <span className={`font-mono text-[9.5px] uppercase tracking-[0.2em] px-2 py-1 rounded border ${t.chip}`}>
          LIVE
        </span>
      </div>
    </Panel>
  )
}

function EventRow({ event, pulsing }: { event: LiveEvent; pulsing: boolean }) {
  const high = event.confidence === 'HIGH'
  return (
    <div
      className={`relative flex items-center gap-3 p-2.5 rounded-md border ${
        high
          ? 'border-red-700/50 bg-red-950/40'
          : 'border-mx-border bg-mx-bg-elev/60'
      } ${pulsing ? (high ? 'mx-pulse-danger' : 'mx-pulse') : ''}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full mx-blink shrink-0"
        style={{
          background: high ? '#ff3050' : '#00ff88',
          boxShadow: high ? '0 0 8px #ff3050' : '0 0 8px #00ff88',
        }}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${
            high ? 'text-red-100' : 'text-mx-green-50'
          }`}
        >
          {event.person_name}
        </p>
        <p className="font-mono text-[10.5px] text-mx-text-mute truncate tracking-wider">
          {event.camera_name} · {(event.score * 100).toFixed(1)}% ·{' '}
          <span className={high ? 'text-red-300' : 'text-mx-green-200'}>
            {new Date(event.timestamp).toLocaleTimeString()}
          </span>
        </p>
      </div>
      <ConfidenceBadge confidence={event.confidence} />
    </div>
  )
}

function DetectionRow({ d }: { d: Detection }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-mx-green-900/15 transition-colors">
      {d.snapshot_url ? (
        <img
          src={d.snapshot_url}
          alt=""
          className="w-9 h-9 rounded object-cover border border-mx-border shrink-0"
        />
      ) : (
        <div className="w-9 h-9 rounded border border-mx-border bg-mx-bg-elev flex items-center justify-center shrink-0">
          <ImgIcon size={14} className="text-mx-text-faint" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-mx-green-50 truncate leading-tight">
          {d.person_name ?? <span className="text-mx-text-mute italic">unknown</span>}
        </p>
        <p className="font-mono text-[10px] text-mx-text-faint tracking-wider truncate mt-0.5">
          {d.source_type.toUpperCase()} · {new Date(d.created_at).toLocaleTimeString()}
        </p>
      </div>
      <ConfidenceBadge confidence={d.confidence} />
    </div>
  )
}

function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return null
  const high = confidence === 'HIGH'
  return (
    <span
      className={`font-mono text-[9.5px] px-2 py-0.5 rounded border tracking-widest shrink-0 ${
        high
          ? 'border-red-700/60 bg-red-900/40 text-red-200'
          : 'border-amber-700/50 bg-amber-900/30 text-amber-200'
      }`}
    >
      {confidence}
    </span>
  )
}

function EmptyFeed() {
  return (
    <div className="relative flex-1 flex flex-col items-center justify-center">
      <DigitalRain opacity={0.32} speed={0.6} density={0.85} />
      <div className="relative text-center space-y-2">
        <Radar
          size={26}
          className="text-mx-green-400 mx-auto mx-flicker"
          style={{ filter: 'drop-shadow(0 0 12px rgba(0,255,136,0.65))' }}
        />
        <p className="font-display text-sm text-mx-green-100 text-glow-soft tracking-wide">
          Awaiting Signal
        </p>
        <p className="font-mono text-[10px] text-mx-text-mute tracking-[0.2em] uppercase">
          <span className="mx-blink">▍</span> listening on socket
        </p>
      </div>
    </div>
  )
}
