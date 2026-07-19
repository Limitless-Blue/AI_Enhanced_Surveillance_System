interface StatusDotProps {
  variant?: 'green' | 'red' | 'amber' | 'mute'
  label?: string
  size?: number
  className?: string
}

const colorMap = {
  green: { dot: '#00ff88', glow: 'rgba(0, 255, 136, 0.7)', text: 'text-mx-green-100' },
  red:   { dot: '#ff3050', glow: 'rgba(255, 48, 80, 0.7)',  text: 'text-red-300' },
  amber: { dot: '#ffb84d', glow: 'rgba(255, 184, 77, 0.6)', text: 'text-amber-300' },
  mute:  { dot: '#4a8268', glow: 'rgba(74, 130, 104, 0.3)', text: 'text-mx-text-mute' },
}

export default function StatusDot({
  variant = 'green',
  label,
  size = 8,
  className = '',
}: StatusDotProps) {
  const c = colorMap[variant]
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={variant === 'mute' ? '' : 'mx-blink'}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: c.dot,
          boxShadow: `0 0 8px ${c.glow}, 0 0 14px ${c.glow}`,
          display: 'inline-block',
        }}
        aria-hidden
      />
      {label && (
        <span className={`font-mono text-[11px] uppercase tracking-widest ${c.text}`}>
          {label}
        </span>
      )}
    </span>
  )
}
