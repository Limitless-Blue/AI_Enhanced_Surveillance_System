import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { Person } from '../lib/api'
import { Plus, Trash2, User, Search, Shield } from 'lucide-react'
import {
  Panel,
  PageHeader,
  MxButton,
  MxInput,
  MxTextarea,
  MxSelect,
  MxFileInput,
  FormHeader,
  FormError,
  LoadingLine,
  EmptyState,
} from '../components/matrix'

export default function Persons() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [searchResult, setSearchResult] = useState<any>(null)
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const { data: persons, isLoading } = useQuery<Person[]>({
    queryKey: ['persons'],
    queryFn: () => api.get('/persons').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/persons/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  })

  const handleSearch = async () => {
    const file = searchRef.current?.files?.[0]
    if (!file) return
    setSearching(true)
    setSearchResult(null)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const { data } = await api.post('/persons/search', fd)
      setSearchResult(data)
    } catch (e: any) {
      setSearchResult({ error: e.response?.data?.detail ?? 'Search failed' })
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        label="Watchlist Registry"
        title="Enrolled Persons"
        right={
          <>
            <span className="font-mono text-[11px] text-mx-text-mute tracking-wider">
              TOTAL · <span className="text-mx-green-200">{persons?.length ?? 0}</span>
            </span>
            <MxButton variant="primary" icon={<Plus size={14} />} onClick={() => setShowForm(v => !v)}>
              {showForm ? 'Close' : 'Add Person'}
            </MxButton>
          </>
        }
      />

      {/* Quick search */}
      <Panel glow="soft" accent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Search size={13} className="text-mx-green-400" />
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.25em] text-mx-green-100">
            Quick Image Search
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <MxFileInput
            ref={searchRef}
            accept="image/*"
            className="flex-1 min-w-[260px]"
            label="Probe Image"
          />
          <MxButton
            variant="outline"
            icon={<Search size={14} />}
            onClick={handleSearch}
            disabled={searching}
          >
            {searching ? 'Scanning…' : 'Run Match'}
          </MxButton>
        </div>
        {searchResult && (
          <div
            className={`mt-3 font-mono text-xs px-3 py-2 rounded-md border ${
              searchResult.error
                ? 'border-red-700/50 bg-red-950/40 text-red-200'
                : searchResult.match
                ? 'border-mx-green-700/60 bg-mx-green-900/30 text-mx-green-100'
                : 'border-mx-border bg-mx-bg-elev text-mx-text-mute'
            }`}
          >
            {searchResult.error ? (
              <>// ERR: {searchResult.error}</>
            ) : searchResult.match ? (
              <>
                ✓ MATCH · <span className="font-bold">{searchResult.person_name}</span> ·{' '}
                {(searchResult.score * 100).toFixed(1)}% · {searchResult.confidence}
              </>
            ) : (
              <>// no match found</>
            )}
          </div>
        )}
      </Panel>

      {showForm && (
        <AddPersonForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false)
            qc.invalidateQueries({ queryKey: ['persons'] })
          }}
        />
      )}

      {isLoading ? (
        <LoadingLine text="loading registry" />
      ) : persons?.length === 0 ? (
        <EmptyState icon={<User size={26} />} title="No persons enrolled" sub="add an entry to begin scanning" />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {persons?.map(p => (
            <PersonCard key={p.id} person={p} onDelete={() => deleteMutation.mutate(p.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function PersonCard({ person: p, onDelete }: { person: Person; onDelete: () => void }) {
  const catColor: Record<string, string> = {
    suspect: 'border-red-700/60 bg-red-900/30 text-red-200',
    victim: 'border-mx-green-700/60 bg-mx-green-900/40 text-mx-green-200',
    accused: 'border-amber-700/60 bg-amber-900/30 text-amber-200',
  }
  const badge = catColor[p.category] ?? 'border-mx-border bg-mx-bg-elev text-mx-text-dim'
  return (
    <Panel glow="soft" className="p-4 group hover:card-glow-strong transition-shadow">
      <div className="flex gap-3">
        <div
          className="w-14 h-14 rounded-md border border-mx-border overflow-hidden shrink-0 flex items-center justify-center bg-mx-bg-elev"
        >
          {p.image_url ? (
            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
          ) : (
            <User size={22} className="text-mx-text-faint" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-display font-semibold text-mx-green-50 truncate">{p.name}</p>
            <button
              onClick={onDelete}
              className="text-mx-text-faint hover:text-red-400 transition-colors shrink-0"
              aria-label="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
          <span
            className={`inline-block mt-1.5 font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border ${badge}`}
          >
            {p.category}
          </span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-mx-border font-mono text-[10px] tracking-wider">
        {p.has_embedding ? (
          <span className="text-mx-green-200">
            ✓ ENROLLED · {p.num_images} {p.num_images === 1 ? 'IMAGE' : 'IMAGES'}
          </span>
        ) : (
          <span className="text-amber-300">⚠ NO FACE DATA</span>
        )}
      </div>
    </Panel>
  )
}

function AddPersonForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    try {
      await api.post('/persons', fd)
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to add person')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Panel glow="strong" accent className="p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormHeader icon={<Shield size={14} />} title="Enroll New Person" onClose={onClose} />
        <div className="grid grid-cols-2 gap-3">
          <MxInput name="name" label="Full Name" required />
          <MxSelect name="category" label="Category" defaultValue="suspect">
            <option value="suspect">Suspect</option>
            <option value="victim">Victim</option>
            <option value="accused">Accused</option>
          </MxSelect>
          <MxInput name="telegram_chat_id" label="Telegram Chat ID" />
          <MxInput name="email" label="Email" type="email" />
          <MxInput name="ntfy_topic" label="ntfy Topic" />
          <MxFileInput name="image" label="Photo" accept="image/*" required />
        </div>
        <MxTextarea name="other_details" label="Other Details" rows={2} />
        {error && <FormError msg={error} />}
        <div className="flex gap-2 justify-end pt-1">
          <MxButton type="button" variant="ghost" onClick={onClose}>
            Cancel
          </MxButton>
          <MxButton type="submit" variant="primary" disabled={loading}>
            {loading ? 'Enrolling…' : 'Enroll Person'}
          </MxButton>
        </div>
      </form>
    </Panel>
  )
}

