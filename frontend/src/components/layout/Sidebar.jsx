import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, Users, Calendar,
  FileText, Scale, Clock, Receipt, LogOut, Briefcase, BarChart2, Calculator, ScrollText, Bot,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const nav = [
  { to: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/casos',      label: 'Casos',        icon: FolderOpen },
  { to: '/clientes',   label: 'Clientes',     icon: Users },
  { to: '/calendario', label: 'Calendario',   icon: Calendar },
  { to: '/documentos', label: 'Documentos',   icon: FileText },
  { to: '/poderes',    label: 'Poderes',      icon: Scale },
  { to: '/timer',      label: 'Control Horas',icon: Clock },
  { to: '/facturas',   label: 'Facturación',  icon: Receipt },
  { to: '/equipo',     label: 'Equipo',       icon: Briefcase },
  { to: '/reportes',   label: 'Reportes',     icon: BarChart2 },
  { to: '/cotizador',  label: 'Cotizador',    icon: Calculator },
  { to: '/plantillas', label: 'Plantillas',   icon: ScrollText },
  { to: '/asistente',  label: 'Asistente IA', icon: Bot },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-gray-900 text-white shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-700">
        <div className="flex items-center justify-center w-8 h-8 bg-indigo-600 rounded-lg">
          <Scale className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight">GESTARLEX</span>
      </div>

      {/* Firma info */}
      {user?.firma && (
        <div className="px-6 py-3 border-b border-gray-700">
          <p className="text-xs text-gray-400 truncate">{user.firma.nombre}</p>
          <span className="inline-block mt-1 text-xs bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded-full">
            Plan {user.firma.plan}
          </span>
        </div>
      )}

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Usuario */}
      <div className="px-4 py-4 border-t border-gray-700">
        <button
          onClick={() => navigate('/perfil')}
          className="flex items-center gap-3 mb-3 w-full text-left hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center justify-center w-8 h-8 bg-indigo-700 rounded-full text-xs font-bold shrink-0">
            {user?.nombre?.charAt(0) ?? '?'}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium truncate">{user?.nombre}</p>
            <p className="text-xs text-gray-400 truncate">{user?.rol}</p>
          </div>
        </button>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
