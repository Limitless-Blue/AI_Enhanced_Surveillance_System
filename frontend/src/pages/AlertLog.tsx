import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import type { Alert } from '../lib/api'
import { CheckCircle, XCircle, Clock } from 'lucide-react'

const CHANNEL_ICONS: Record<string, string> = {
  telegram: '✈',
  email: '✉',
  ntfy: '🔔',
  webhook: '🔗',
  in_app: '💻',
}

export default function AlertLog() {
  const { data: alerts, isLoading } = useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: () => api.get('/alerts?limit=100').then(r => r.data),
    refetchInterval: 10000,
  })

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Alert Log</h2>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : !alerts || alerts.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-12">No alerts dispatched yet</p>
      ) : (
        <div className="space-y-2">
          {alerts.map(a => (
            <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-3">
              <span className="text-lg shrink-0">{CHANNEL_ICONS[a.channel] ?? '📢'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white text-sm">{a.person_name}</span>
                  <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">{a.channel}</span>
                  <span className="text-xs text-gray-600 font-mono truncate">{a.recipient}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.message}</p>
                {a.error && <p className="text-xs text-red-400 mt-0.5">{a.error}</p>}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {a.status === 'sent'
                  ? <CheckCircle size={16} className="text-emerald-400" />
                  : a.status === 'failed'
                  ? <XCircle size={16} className="text-red-400" />
                  : <Clock size={16} className="text-gray-500" />}
                <span className="text-xs text-gray-600">{a.sent_at ? new Date(a.sent_at).toLocaleTimeString() : '—'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
