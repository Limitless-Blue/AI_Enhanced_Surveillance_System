import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { Person } from '../lib/api'
import { Plus, Trash2, User, Search } from 'lucide-react'

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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Enrolled Persons</h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-3 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Add Person
        </button>
      </div>

      {/* Quick search */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-300">Quick Image Search</p>
        <div className="flex gap-2">
          <input ref={searchRef} type="file" accept="image/*" className="text-sm text-gray-400 file:mr-2 file:rounded file:border-0 file:bg-emerald-700 file:text-white file:text-xs file:px-3 file:py-1 file:cursor-pointer" />
          <button onClick={handleSearch} disabled={searching} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded-lg transition-colors">
            <Search size={14} /> {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
        {searchResult && (
          <div className={`text-sm p-3 rounded-lg ${searchResult.error ? 'bg-red-900/30 text-red-300' : searchResult.match ? 'bg-emerald-900/30 text-emerald-300' : 'bg-gray-800 text-gray-400'}`}>
            {searchResult.error
              ? searchResult.error
              : searchResult.match
              ? `✓ Match: ${searchResult.person_name} (${(searchResult.score * 100).toFixed(1)}% — ${searchResult.confidence})`
              : 'No match found'}
          </div>
        )}
      </div>

      {showForm && <AddPersonForm onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['persons'] }) }} />}

      {isLoading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : persons?.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-12">No persons enrolled yet. Add someone to get started.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
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
    suspect: 'bg-red-800 text-red-200',
    victim: 'bg-blue-800 text-blue-200',
    accused: 'bg-orange-800 text-orange-200',
  }
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-3">
      <div className="w-16 h-16 rounded-lg bg-gray-800 overflow-hidden shrink-0 flex items-center justify-center">
        {p.image_url
          ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
          : <User size={24} className="text-gray-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white truncate">{p.name}</p>
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${catColor[p.category] ?? 'bg-gray-700 text-gray-300'}`}>{p.category}</span>
        <p className="text-xs text-gray-500 mt-1">{p.has_embedding ? `✓ Enrolled (${p.num_images} image${p.num_images !== 1 ? 's' : ''})` : '⚠ No face data'}</p>
      </div>
      <button onClick={onDelete} className="text-gray-600 hover:text-red-400 transition-colors self-start">
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function AddPersonForm({ onSuccess }: { onSuccess: () => void }) {
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
    <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <p className="font-semibold text-white text-sm">Add New Person</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full Name *" name="name" required />
        <div>
          <label className="block text-xs text-gray-400 mb-1">Category</label>
          <select name="category" className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2">
            <option value="suspect">Suspect</option>
            <option value="victim">Victim</option>
            <option value="accused">Accused</option>
          </select>
        </div>
        <Field label="Telegram Chat ID" name="telegram_chat_id" />
        <Field label="Email" name="email" type="email" />
        <Field label="ntfy Topic" name="ntfy_topic" />
        <div>
          <label className="block text-xs text-gray-400 mb-1">Photo *</label>
          <input type="file" name="image" accept="image/*" required className="w-full text-xs text-gray-400 file:mr-2 file:rounded file:border-0 file:bg-emerald-700 file:text-white file:px-2 file:py-1 file:cursor-pointer" />
        </div>
      </div>
      <Field label="Other Details" name="other_details" textarea />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          {loading ? 'Enrolling…' : 'Enroll Person'}
        </button>
      </div>
    </form>
  )
}

function Field({ label, name, required, type, textarea }: { label: string; name: string; required?: boolean; type?: string; textarea?: boolean }) {
  const cls = "w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-emerald-500"
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {textarea
        ? <textarea name={name} rows={2} className={cls} />
        : <input type={type ?? 'text'} name={name} required={required} className={cls} />}
    </div>
  )
}
