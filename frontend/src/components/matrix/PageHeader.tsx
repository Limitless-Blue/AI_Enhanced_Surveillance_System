import { type ReactNode } from 'react'

interface PageHeaderProps {
  label: string
  title: string
  right?: ReactNode
}

export default function PageHeader({ label, title, right }: PageHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-mx-text-faint mb-2">
          {label}
        </div>
        <h2 className="font-display font-bold text-[32px] leading-none tracking-tight text-mx-green-50 text-glow">
          {title}
        </h2>
      </div>
      {right && <div className="flex items-center gap-4 pb-1">{right}</div>}
    </header>
  )
}
