import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { MediaJob } from '../lib/api'
import { Upload, FileVideo, FileImage, CheckCircle, XCircle, Loader } from 'lucide-react'
import { Panel, PageHeader, StatusDot, EmptyState } from '../components/matrix'

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

  const processing = jobs?.filter(j => j.status === 'processing').length ?? 0
  const done = jobs?.filter(j => j.status === 'done').length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        label="Ingestion Pipeline"
        title="Media Upload"
        right={
          <span className="font-mono text-[11px] text-mx-text-mute tracking-wider">
            PROC · <span className="text-mx-green-200">{processing}</span>
            <span className="text-mx-text-faint mx-1">·</span>
            DONE · <span className="text-mx-green-200">{done}</span>
          </span>
        }
      />

      {/* Drop zone */}
      <div
        onDragOver={e => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative glass glass-specular rounded-xl overflow-hidden cursor-pointer transition-all py-14 text-center ${
          dragging ? 'card-glow-strong' : 'hover:card-glow'
        }`}
      >
        {dragging && <span className="mx-scan-line" aria-hidden />}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) upload(f)
          }}
        />
        <div className="relative flex flex-col items-center gap-3">
          {uploading ? (
            <>
              <Loader
                size={34}
                className="animate-spin text-mx-green-300"
                style={{ filter: 'drop-shadow(0 0 8px rgba(0,255,136,0.6))' }}
              />
              <p className="font-display text-sm text-mx-green-100">Uploading…</p>
              <p className="font-mono text-[10px] text-mx-text-mute tracking-[0.2em] uppercase mx-blink">
                ▍ streaming to ingest queue
              </p>
            </>
          ) : (
            <>
              <div
                className="w-14 h-14 rounded-xl border border-mx-green-700/50 bg-mx-green-900/40 flex items-center justify-center"
                style={{ boxShadow: '0 0 18px -4px rgba(0,255,136,0.4)' }}
              >
                <Upload
                  size={22}
                  className="text-mx-green-300"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(0,255,136,0.5))' }}
                />
              </div>
              <p className="font-display text-sm text-mx-green-100">
                Drop image or video here, or click to browse
              </p>
              <p className="font-mono text-[10px] text-mx-text-faint tracking-[0.2em] uppercase">
                jpg · png · mp4 · avi · mov · mkv
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="font-mono text-xs text-red-300 px-3 py-2 rounded-md border border-red-700/50 bg-red-950/40">
          // ERR: {error}
        </p>
      )}

      {/* Job list */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display font-semibold text-[11px] uppercase tracking-[0.25em] text-mx-green-100">
            Processing Jobs
          </h3>
          <StatusDot variant={processing > 0 ? 'green' : 'mute'} />
        </div>
        {!jobs || jobs.length === 0 ? (
          <EmptyState icon={<Upload size={24} />} title="No jobs in pipeline" sub="upload media to begin analysis" />
        ) : (
          <div className="space-y-2">
            {jobs.map(job => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function JobRow({ job }: { job: MediaJob }) {
  const isVideo = job.file_type === 'video'
  const progress = job.total_frames > 0 ? Math.round((job.processed_frames / job.total_frames) * 100) : null
  const isProcessing = job.status === 'processing'
  return (
    <Panel tone={isProcessing ? 'active' : 'default'} glow={isProcessing ? 'soft' : 'none'} className="p-4">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-md border border-mx-border bg-mx-bg-elev flex items-center justify-center shrink-0">
          {isVideo ? (
            <FileVideo size={17} className="text-mx-green-300" />
          ) : (
            <FileImage size={17} className="text-mx-green-300" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-mx-green-50 truncate">{job.filename}</p>
            <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-mx-border text-mx-text-mute shrink-0">
              {job.file_type}
            </span>
          </div>
          {isProcessing && progress !== null && (
            <div className="mt-2">
              <div className="h-1.5 rounded-full overflow-hidden bg-mx-green-900/50 border border-mx-border">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, var(--color-mx-green-600), var(--color-mx-green-400))',
                    boxShadow: '0 0 10px rgba(0,255,136,0.6)',
                  }}
                />
              </div>
              <p className="font-mono text-[10px] text-mx-text-mute mt-1 tracking-wider">
                {progress}% · {job.processed_frames}/{job.total_frames} FRAMES
              </p>
            </div>
          )}
          {job.status === 'done' && (
            <p className="font-mono text-[10.5px] text-mx-green-200 mt-1 tracking-wider">
              ✓ {job.detections_found} DETECTION{job.detections_found !== 1 ? 'S' : ''} FOUND
            </p>
          )}
          {job.status === 'failed' && (
            <p className="font-mono text-[10.5px] text-red-300 mt-1 tracking-wider">✗ {job.error}</p>
          )}
          {job.status === 'pending' && (
            <p className="font-mono text-[10.5px] text-mx-text-mute mt-1 tracking-wider">
              <span className="mx-blink">▍</span> QUEUED
            </p>
          )}
        </div>
        <StatusIcon status={job.status} />
      </div>
    </Panel>
  )
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'done')
    return (
      <CheckCircle
        size={20}
        className="text-mx-green-400 shrink-0"
        style={{ filter: 'drop-shadow(0 0 6px rgba(0,255,136,0.6))' }}
      />
    )
  if (status === 'failed')
    return (
      <XCircle
        size={20}
        className="text-red-400 shrink-0"
        style={{ filter: 'drop-shadow(0 0 6px rgba(255,48,80,0.6))' }}
      />
    )
  if (status === 'processing')
    return (
      <Loader
        size={20}
        className="text-mx-green-300 animate-spin shrink-0"
        style={{ filter: 'drop-shadow(0 0 6px rgba(0,255,136,0.5))' }}
      />
    )
  return <div className="w-4 h-4 rounded-full border-2 border-mx-border shrink-0" />
}
