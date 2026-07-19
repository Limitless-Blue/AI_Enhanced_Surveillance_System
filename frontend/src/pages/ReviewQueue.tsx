import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import type { Detection } from '../lib/api'
import { ClipboardList, Image as ImgIcon } from 'lucide-react'
import { Panel, PageHeader, StatusDot, LoadingLine } from '../components/matrix'

export default function ReviewQueue() {
  const { data: items, isLoading } = useQuery<Detection[]>({
    queryKey: ['review'],
    queryFn: () => api.get('/detections?confidence=REVIEW&limit=100').then(r => r.data),
    refetchInterval: 10000,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        label="Manual Triage"
        title="Review Queue"
        right={
          <>
            <span className="font-mono text-[11px] text-mx-text-mute tracking-wider">
              PENDING · <span className="text-amber-300">{items?.length ?? 0}</span>
            </span>
            <StatusDot variant={items && items.length > 0 ? 'amber' : 'mute'} />
          </>
        }
      />

      <Panel tone="flat" className="px-4 py-3">
        <p className="font-mono text-[11px] text-mx-text-dim tracking-wider leading-relaxed">
          <span className="text-mx-text-faint">// </span>
          Detections scoring between{' '}
          <span className="text-amber-300">0.45</span>
          {' – '}
          <span className="text-amber-300">0.59</span>{' '}
          require human confirmation before alert dispatch.
        </p>
      </Panel>

      {isLoading ? (
        <LoadingLine text="loading queue" />
      ) : !items || items.length === 0 ? (
        <Panel className="py-14 text-center">
          <ClipboardList
            size={26}
            className="text-mx-green-400 mx-auto mb-3"
            style={{ filter: 'drop-shadow(0 0 8px rgba(0,255,136,0.4))' }}
          />
          <p className="font-display text-sm text-mx-green-100">Queue clear</p>
          <p className="font-mono text-[11px] text-mx-text-faint mt-1">// no pending reviews</p>
        </Panel>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {items.map(item => (
            <ReviewCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function ReviewCard({ item }: { item: Detection }) {
  const pct = (item.match_score ?? 0) * 100
  return (
    <Panel glow="soft" className="overflow-hidden hover:card-glow-strong transition-shadow">
      <div className="relative">
        {item.snapshot_url ? (
          <img src={item.snapshot_url} alt="" className="w-full h-40 object-cover bg-mx-bg-elev" />
        ) : (
          <div className="w-full h-40 bg-mx-bg-elev flex items-center justify-center">
            <ImgIcon size={26} className="text-mx-text-faint" />
          </div>
        )}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, transparent 55%, rgba(5,10,8,0.92) 100%)' }}
        />
        <span
          className="absolute top-2 right-2 font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-amber-700/60 bg-amber-950/80 text-amber-200"
        >
          REVIEW
        </span>
      </div>
      <div className="p-3 space-y-2">
        <p className="font-display font-semibold text-mx-green-50 truncate">
          {item.person_name ?? <span className="text-mx-text-mute italic">unknown</span>}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden border border-mx-border bg-mx-green-900/40">
            <div
              className="h-full transition-all"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #d98a2b, #ffb84d)',
                boxShadow: '0 0 8px rgba(255,184,77,0.5)',
              }}
            />
          </div>
          <span className="font-mono text-[11px] text-amber-300 tabular-nums shrink-0">
            {pct.toFixed(1)}%
          </span>
        </div>
        <p className="font-mono text-[10px] text-mx-text-faint tracking-wider">
          {item.source_type.toUpperCase()} · {new Date(item.created_at).toLocaleString()}
        </p>
      </div>
    </Panel>
  )
}
