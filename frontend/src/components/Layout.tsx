import { NavLink, Outlet } from 'react-router-dom'
import { Camera, Users, Upload, Bell, LayoutDashboard, ClipboardList } from 'lucide-react'

const nav = [
  { to: '/',         label: 'Dashboard',    Icon: LayoutDashboard },
  { to: '/persons',  label: 'Persons',      Icon: Users },
  { to: '/cameras',  label: 'Cameras',      Icon: Camera },
  { to: '/upload',   label: 'Media Upload', Icon: Upload },
  { to: '/alerts',   label: 'Alerts',       Icon: Bell },
  { to: '/review',   label: 'Review Queue', Icon: ClipboardList },
]

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-sm font-bold text-emerald-400 uppercase tracking-widest">AI Surveillance</h1>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
