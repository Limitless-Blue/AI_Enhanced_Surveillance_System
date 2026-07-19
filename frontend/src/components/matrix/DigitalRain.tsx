import { useEffect, useRef } from 'react'

interface DigitalRainProps {
  className?: string
  opacity?: number
  speed?: number
  density?: number
}

const GLYPHS = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズヅブプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン0123456789ABCDEFｱｲｳｴｵｶｷｸｹｺ$%#@&*'

export default function DigitalRain({
  className = '',
  opacity = 0.35,
  speed = 0.6,
  density = 1,
}: DigitalRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const parent = canvas.parentElement!
    const dpr = window.devicePixelRatio || 1

    let width = 0
    let height = 0
    let columns = 0
    let drops: number[] = []
    let brights: number[] = []
    const fontSize = 14

    const resize = () => {
      const rect = parent.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = width + 'px'
      canvas.style.height = height + 'px'
      ctx.scale(dpr, dpr)
      columns = Math.max(1, Math.floor((width / fontSize) * density))
      drops = Array(columns).fill(0).map(() => Math.random() * -50)
      brights = Array(columns).fill(0).map(() => Math.random())
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(parent)

    let raf = 0
    let last = performance.now()

    const tick = (t: number) => {
      const dt = Math.min(64, t - last)
      last = t
      ctx.fillStyle = 'rgba(4, 7, 10, 0.18)'
      ctx.fillRect(0, 0, width, height)
      ctx.font = `${fontSize}px JetBrains Mono, monospace`

      const advance = (dt / 1000) * 18 * speed

      for (let i = 0; i < columns; i++) {
        const x = (i / density) * fontSize
        const y = drops[i] * fontSize
        const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]

        if (brights[i] > 0.93) {
          ctx.fillStyle = `rgba(212, 255, 232, ${opacity * 1.4})`
        } else if (brights[i] > 0.6) {
          ctx.fillStyle = `rgba(0, 255, 136, ${opacity})`
        } else {
          ctx.fillStyle = `rgba(0, 200, 110, ${opacity * 0.55})`
        }
        ctx.fillText(glyph, x, y)

        brights[i] = Math.random()

        if (y > height && Math.random() > 0.975) {
          drops[i] = 0
        } else {
          drops[i] += advance
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [opacity, speed, density])

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden>
      <canvas ref={canvasRef} className="block w-full h-full" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, rgba(4, 7, 10, 0.7) 70%, var(--color-mx-bg) 100%)',
        }}
      />
    </div>
  )
}
