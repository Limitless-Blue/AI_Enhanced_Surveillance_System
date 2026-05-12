import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import type { Detection } from '../lib/api'

export default function ReviewQueue() {
  const { data: items, isLoading } = useQuery<Detection[]>({
    queryKey: ['review'],
    queryFn: () => api.get('/detections?confidence=REVIEW&limit=100').then(r => r.data),
    refetchInterval: 10000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Review Queue</h2>
        <span className="text-sm text-gray-500">{items?.length ?? 0} pending</span>
      </div>
      <p className="text-sm text-gray-400">These detections scored between 0.45–0.59 (REVIEW). Confirm to create an alert, or dismiss.</p>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : !items || items.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-12">No items in review queue 🎉</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {items.map(item => (
            <ReviewCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function ReviewCard({ item }: { item: Detection }) {
  return (
    <div className="bg-gray-900 border border-yellow-800/50 rounded-xl overflow-hidden">
      {item.snapshot_url && (
        <img src={item.snapshot_url} alt="" className="w-full h-36 object-cover bg-gray-800" />
      )}
      <div className="p-3 space-y-2">
        <p className="font-semibold text-white text-sm">{item.person_name ?? 'Unknown'}</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-500" style={{ width: `${(item.match_score ?? 0) * 100}%` }} />
          </div>
          <span className="text-xs text-yellow-400 font-mono">{((item.match_score ?? 0) * 100).toFixed(1)}%</span>
        </div>
        <p className="text-xs text-gray-500">{item.source_type} · {new Date(item.created_at).toLocaleString()}</p>
      </div>
    </div>
  )
}
