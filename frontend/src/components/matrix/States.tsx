import { type ReactNode } from 'react'
import { X } from 'lucide-react'
import Panel from './Panel'
import StatusDot from './StatusDot'

export function FormHeader({
  icon,
  title,
  onClose,
}: {
  icon: ReactNode
  title: string
  onClose: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-mx-green-400">
        {icon}
        <p className="font-display font-semibold text-[13px] uppercase tracking-[0.22em] text-mx-green-100">
          {title}
        </p>
        <StatusDot variant="green" />
      </div>
      <button type="button" onClick={onClose} className="text-mx-text-mute hover:text-mx-green-200">
        <X size={16} />
      </button>
    </div>
  )
}

export function FormError({ msg }: { msg: string }) {
  return (
    <p className="font-mono text-xs text-red-300 px-3 py-2 rounded-md border border-red-700/50 bg-red-950/40">
      // ERR: {msg}
    </p>
  )
}

export function LoadingLine({ text }: { text: string }) {
  return (
    <p className="font-mono text-sm text-mx-text-mute">
      <span className="mx-blink">▍</span> {text}…
    </p>
  )
}

export function EmptyState({
  icon,
  title,
  sub,
}: {
  icon: ReactNode
  title: string
  sub?: string
}) {
  return (
    <Panel className="py-14 text-center">
      <div className="text-mx-text-faint flex justify-center mb-3">{icon}</div>
      <p className="font-display text-sm text-mx-text-dim">{title}</p>
      {sub && <p className="font-mono text-[11px] text-mx-text-faint mt-1">// {sub}</p>}
    </Panel>
  )
}
