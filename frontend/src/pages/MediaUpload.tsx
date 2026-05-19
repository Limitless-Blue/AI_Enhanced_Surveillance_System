import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { MediaJob } from '../lib/api'
import { Upload, FileVideo, FileImage, CheckCircle, XCircle, Loader } from 'lucide-react'

export default function MediaUpload() {
  const qc = useQueryClient()
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: jobs } = useQuery<MediaJob[]>({
    queryKey: ['media-jobs'],
    queryFn: () => api.get('/media/jobs').then(r => r.data),
    refetchInterval: 2000,
  })

  const upload = async (file: File) => {
    setUploading(true)
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    try {
      await api.post('/media/upload', fd)
      qc.invalidateQueries({ queryKey: ['media-jobs'] })
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Media Upload</h2>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${dragging ? 'border-emerald-400 bg-emerald-900/10' : 'border-gray-700 hover:border-gray-500'}`}
      >
        <input ref={inputRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <Loader size={32} className="animate-spin" />
            <p className="text-sm">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <Upload size={32} />
            <p className="text-sm">Drop image or video here, or click to browse</p>
            <p className="text-xs text-gray-600">Supported: JPG, PNG, MP4, AVI, MOV, MKV</p>
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Job list */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Processing Jobs</h3>
        {!jobs || jobs.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">No jobs yet</p>
        ) : (
          <div className="space-y-2">
            {jobs.map(job => <JobRow key={job.id} job={job} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function JobRow({ job }: { job: MediaJob }) {
  const isVideo = job.file_type === 'video'
  const progress = job.total_frames > 0 ? Math.round((job.processed_frames / job.total_frames) * 100) : null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
      {isVideo ? <FileVideo size={20} className="text-blue-400 shrink-0" /> : <FileImage size={20} className="text-purple-400 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{job.filename}</p>
        {job.status === 'processing' && progress !== null && (
          <div className="mt-1">
            <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{progress}% · {job.processed_frames}/{job.total_frames} frames</p>
          </div>
        )}
        {job.status === 'done' && (
          <p className="text-xs text-gray-500 mt-0.5">{job.detections_found} detection{job.detections_found !== 1 ? 's' : ''} found</p>
        )}
        {job.status === 'failed' && (
          <p className="text-xs text-red-400 mt-0.5">{job.error}</p>
        )}
      </div>
      <StatusIcon status={job.status} />
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'done') return <CheckCircle size={18} className="text-emerald-400" />
  if (status === 'failed') return <XCircle size={18} className="text-red-400" />
  if (status === 'processing') return <Loader size={18} className="text-blue-400 animate-spin" />
  return <div className="w-4 h-4 rounded-full border-2 border-gray-600" />
}
