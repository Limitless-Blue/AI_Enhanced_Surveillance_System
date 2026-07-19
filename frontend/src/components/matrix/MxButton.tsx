import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'danger' | 'ghost' | 'outline'
type Size = 'sm' | 'md'

interface MxButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  children?: ReactNode
}

const sizeMap: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[11px]',
  md: 'px-4 py-2 text-xs',
}

const variantMap: Record<Variant, { base: string; style?: React.CSSProperties }> = {
  primary: {
    base:
      'bg-mx-green-900/60 border border-mx-green-400/70 text-mx-green-50 hover:bg-mx-green-800/70 hover:border-mx-green-400 disabled:opacity-40 disabled:cursor-not-allowed',
    style: { boxShadow: '0 0 14px rgba(0,255,136,0.25), inset 0 0 14px rgba(0,255,136,0.08)' },
  },
  danger: {
    base:
      'bg-red-900/60 border border-red-500/70 text-red-100 hover:bg-red-800/70 hover:border-red-400 disabled:opacity-40 disabled:cursor-not-allowed',
    style: { boxShadow: '0 0 14px rgba(255,48,80,0.3), inset 0 0 12px rgba(255,48,80,0.1)' },
  },
  ghost: {
    base:
      'bg-transparent border border-mx-border text-mx-text-dim hover:bg-mx-green-900/30 hover:text-mx-green-100 hover:border-mx-border-strong disabled:opacity-40 disabled:cursor-not-allowed',
  },
  outline: {
    base:
      'bg-transparent border border-mx-green-400/40 text-mx-green-200 hover:bg-mx-green-900/30 hover:border-mx-green-400 disabled:opacity-40 disabled:cursor-not-allowed',
  },
}

const MxButton = forwardRef<HTMLButtonElement, MxButtonProps>(function MxButton(
  { variant = 'primary', size = 'md', icon, children, className = '', style, ...rest },
  ref,
) {
  const v = variantMap[variant]
  return (
    <button
      ref={ref}
      {...rest}
      style={{ ...(v.style ?? {}), ...(style ?? {}) }}
      className={`font-mono uppercase tracking-[0.18em] inline-flex items-center justify-center gap-1.5 rounded-md transition-all ${sizeMap[size]} ${v.base} ${className}`}
    >
      {icon}
      {children}
    </button>
  )
})

export default MxButton
