import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import type { Alert } from '../lib/api'
import { CheckCircle, XCircle, Clock, Send, Mail, Bell, Link2, Monitor, Megaphone } from 'lucide-react'
import { Panel, PageHeader, StatusDot, LoadingLine, EmptyState } from '../components/matrix'

const CHANNEL: Record<string, { Icon: React.ComponentType<any>; color: string }> = {
  telegram: { Icon: Send, color: 'text-sky-300' },
  email:    { Icon: Mail, color: 'text-mx-green-300' },
  ntfy:     { Icon: Bell, color: 'text-amber-300' },
  webhook:  { Icon: Link2, color: 'text-purple-300' },
  in_app:   { Icon: Monitor, color: 'text-mx-green-200' },
}

export default function AlertLog() {
  const { data: alerts, isLoading } = useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: () => api.get('/alerts?limit=100').then(r => r.data),
    refetchInterval: 10000,
  })

  const sent = alerts?.filter(a => a.status === 'sent').length ?? 0
  const failed = alerts?.filter(a => a.status === 'failed').length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        label="Dispatch Records"
        title="Alert Log"
        right={
          <>
            <span className="font-mono text-[11px] tracking-wider">
              <span className="text-mx-text-faint">SENT </span>
              <span className="text-mx-green-200">{sent}</span>
            </span>
            <span className="font-mono text-[11px] tracking-wider">
              <span className="text-mx-text-faint">FAIL </span>
              <span className="text-red-300">{failed}</span>
            </span>
            <StatusDot variant="green" label="Live" />
          </>
        }
      />

      {isLoading ? (
        <LoadingLine text="loading dispatch records" />
      ) : !alerts || alerts.length === 0 ? (
        <EmptyState icon={<Megaphone size={26} />} title="No alerts dispatched" sub="alerts appear here when detections trigger" />
      ) : (
        <div className="space-y-2">
          {alerts.map(a => (
            <AlertRow key={a.id} alert={a} />
          ))}
        </div>
      )}
    </div>
  )
}

function AlertRow({ alert: a }: { alert: Alert }) {
  const chan = CHANNEL[a.channel] ?? { Icon: Megaphone, color: 'text-mx-text-dim' }
  const Icon = chan.Icon
  const failed = a.status === 'failed'

  return (
    <Panel tone={failed ? 'danger' : 'default'} glow={failed ? 'danger' : 'none'} className="p-4">
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-md border flex items-center justify-center shrink-0 ${
            failed ? 'border-red-700/50 bg-red-950/50' : 'border-mx-border bg-mx-bg-elev'
          }`}
        >
          <Icon size={15} className={failed ? 'text-red-300' : chan.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`font-display font-semibold text-sm ${
                failed ? 'text-red-100' : 'text-mx-green-50'
              }`}
            >
              {a.person_name}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-mx-border bg-mx-bg-elev text-mx-text-dim">
              {a.channel}
            </span>
            <span className="font-mono text-[10px] text-mx-text-faint truncate tracking-wider">
              → {a.recipient}
            </span>
          </div>
          <p className="font-mono text-[11px] text-mx-text-dim mt-1 line-clamp-2 leading-snug">
            {a.message}
          </p>
          {a.error && (
            <p className="font-mono text-[10.5px] text-red-300 mt-1 tracking-wider">✗ {a.error}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusIcon status={a.status} />
          <span className="font-mono text-[10px] text-mx-text-faint tracking-wider">
            {a.sent_at ? new Date(a.sent_at).toLocaleTimeString() : '—'}
          </span>
        </div>
      </div>
    </Panel>
  )
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'sent')
    return (
      <CheckCircle
        size={16}
        className="text-mx-green-400"
        style={{ filter: 'drop-shadow(0 0 5px rgba(0,255,136,0.5))' }}
      />
    )
  if (status === 'failed')
    return (
      <XCircle
        size={16}
        className="text-red-400"
        style={{ filter: 'drop-shadow(0 0 5px rgba(255,48,80,0.5))' }}
      />
    )
  return <Clock size={16} className="text-mx-text-mute" />
}
