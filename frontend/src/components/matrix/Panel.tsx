import { type ReactNode } from 'react'

type Tone = 'default' | 'active' | 'danger' | 'flat'
type GlowLevel = 'none' | 'soft' | 'strong' | 'danger'

interface PanelProps {
  children: ReactNode
  className?: string
  tone?: Tone
  glow?: GlowLevel
  accent?: boolean
  scanning?: boolean
  as?: 'div' | 'section' | 'article'
}

const toneMap: Record<Tone, string> = {
  default: 'card',
  active: 'card card-active',
  danger: 'rounded-[10px] border border-red-500/40 bg-red-950/40',
  flat: 'rounded-[10px] border border-mx-border bg-mx-bg-elev',
}

const glowMap: Record<GlowLevel, string> = {
  none: '',
  soft: 'card-glow',
  strong: 'card-glow-strong',
  danger: 'card-glow-danger',
}

/**
 * Children render as direct flex/block children of the panel root, so a panel
 * can be `flex flex-col` with a flex-1 body. The scan-line and accent-bar are
 * absolutely-positioned overlays that paint above content (a subtle sweep).
 */
export default function Panel({
  children,
  className = '',
  tone = 'default',
  glow = 'none',
  accent = false,
  scanning = false,
  as: Tag = 'div',
}: PanelProps) {
  return (
    <Tag className={`relative ${toneMap[tone]} ${glowMap[glow]} ${className}`}>
      {accent && <span className="card-accent-bar" aria-hidden />}
      {children}
      {scanning && <span className="mx-scan-line" aria-hidden />}
    </Tag>
  )
}
