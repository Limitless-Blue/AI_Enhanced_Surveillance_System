interface LogoProps {
  size?: number
  className?: string
}

/** Radar-eye mark for AI Surveillance — concentric scan rings + sweep wedge. */
export default function Logo({ size = 32, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="mxLogoSweep" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00ff88" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M16 16 L16 4 A12 12 0 0 1 27 11 Z" fill="url(#mxLogoSweep)" />
      <circle cx="16" cy="16" r="9.5" stroke="#00ff88" strokeOpacity="0.35" strokeWidth="1.4" />
      <circle cx="16" cy="16" r="5.8" stroke="#00ff88" strokeOpacity="0.7" strokeWidth="1.4" />
      <circle cx="16" cy="16" r="2.6" fill="#00ff88" />
    </svg>
  )
}
