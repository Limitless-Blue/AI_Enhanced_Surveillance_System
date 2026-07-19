import { NavLink, Outlet } from 'react-router-dom'
import { Camera, Users, Upload, Bell, LayoutDashboard, ClipboardList, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import StatusDot from './matrix/StatusDot'
import Logo from './matrix/Logo'

const nav = [
  { to: '/',         label: 'Dashboard',    code: 'DSH', Icon: LayoutDashboard },
  { to: '/persons',  label: 'Persons',      code: 'PSN', Icon: Users },
  { to: '/cameras',  label: 'Cameras',      code: 'CAM', Icon: Camera },
  { to: '/upload',   label: 'Media Upload', code: 'UPL', Icon: Upload },
  { to: '/alerts',   label: 'Alerts',       code: 'ALT', Icon: Bell },
  { to: '/review',   label: 'Review Queue', code: 'RVQ', Icon: ClipboardList },
]

export default function Layout() {
  return (
    <div className="flex min-h-screen text-mx-text">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-auto px-8 py-6 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function Sidebar() {
  return (
    <aside
      className="w-60 shrink-0 flex flex-col"
      style={{
        background: 'linear-gradient(180deg, var(--color-mx-bg-elev) 0%, var(--color-mx-bg) 100%)',
        borderRight: '1px solid rgba(0, 255, 136, 0.18)',
        boxShadow: 'inset -1px 0 0 0 rgba(0, 255, 136, 0.05), 4px 0 24px -8px rgba(0, 255, 136, 0.08)',
      }}
    >
      {/* Brand */}
      <div className="px-5 py-5 border-b border-mx-border">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div
              className="glass-green glass-specular w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ boxShadow: '0 0 18px -4px rgba(0,255,136,0.45)' }}
            >
              <Logo size={26} className="relative z-[1]" />
            </div>
            <span
              className="mx-blink absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
              style={{ background: '#00ff88', boxShadow: '0 0 8px #00ff88' }}
              aria-hidden
            />
          </div>
          <div className="leading-none min-w-0">
            <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-mx-text-faint mb-1.5">
              Operator Node
            </div>
            <h1 className="font-display font-bold text-[14px] tracking-[0.1em] truncate">
              <span className="text-mx-green-400 text-glow">AI</span>{' '}
              <span className="text-mx-green-50">SURVEILLANCE</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Section label */}
      <div className="px-5 pt-5 pb-2">
        <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-mx-text-faint">
          Modules
        </div>
      </div>

      {/* Nav */}
      <nav className="px-2.5 space-y-0.5 flex-1">
        {nav.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {({ isActive }) => (
              <div
                className={`relative flex items-center gap-3 pl-3 pr-2 py-2.5 rounded-md text-sm transition-all ${
                  isActive
                    ? 'nav-active text-mx-green-50'
                    : 'text-mx-text-dim hover:bg-mx-green-900/25 hover:text-mx-green-100'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-mx-green-400' : ''} />
                <span className={`flex-1 ${isActive ? 'text-glow-soft font-medium' : ''}`}>
                  {label}
                </span>
                {isActive && (
                  <ChevronRight
                    size={13}
                    className="text-mx-green-400"
                    style={{ filter: 'drop-shadow(0 0 4px rgba(0,255,136,0.6))' }}
                  />
                )}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer status */}
      <div className="px-5 py-4 border-t border-mx-border space-y-2">
        <div className="flex items-center justify-between">
          <StatusDot variant="green" label="Online" />
          <span className="font-mono text-[10px] text-mx-text-faint tracking-wider">v0.1.0</span>
        </div>
        <div className="font-mono text-[10px] text-mx-text-mute leading-relaxed grid grid-cols-2 gap-x-2 gap-y-1">
          <span className="text-mx-text-faint">SOCKET</span>
          <span className="text-mx-green-200 text-right">LIVE</span>
          <span className="text-mx-text-faint">PIPELINE</span>
          <span className="text-mx-green-200 text-right">READY</span>
        </div>
      </div>
    </aside>
  )
}

function TopBar() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const ts = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

  return (
    <div className="h-12 shrink-0 glass rounded-none border-x-0 border-t-0 flex items-center justify-between px-6 font-mono text-[11px] z-10">
      <div className="flex items-center gap-3 text-mx-text-mute tracking-wider">
        <span className="text-mx-green-300">$</span>
        <span className="text-mx-green-200">node.surveillance.local</span>
        <span className="text-mx-text-faint">::</span>
        <span className="text-mx-text-dim">/operator</span>
      </div>
      <div className="flex items-center gap-5 text-mx-text-mute tracking-wider">
        <StatusDot variant="green" label="Stream OK" />
        <span>{ts}</span>
      </div>
    </div>
  )
}
