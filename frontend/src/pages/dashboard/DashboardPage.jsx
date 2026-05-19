import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../../api/dashboard';
import { useAuth } from '../../contexts/AuthContext';
import Spinner from '../../components/ui/Spinner';
import { Link } from 'react-router-dom';
import {
  FolderOpen, Users, Gavel, AlertTriangle,
  Clock, DollarSign, Calendar, TrendingUp,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Tarjeta de métrica ──────────────────────────────────────────────────────
function MetricCard({ label, value, sub, icon: Icon, color = 'indigo', to }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green:  'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red:    'bg-red-50 text-red-600',
  };
  const card = (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to}>{card}</Link> : card;
}

// ── Fila de alerta ───────────────────────────────────────────────────────────
function AlertaItem({ item }) {
  const colores = {
    CRITICA: 'bg-red-50 border-red-200 text-red-700',
    ALTA:    'bg-orange-50 border-orange-200 text-orange-700',
    INFO:    'bg-blue-50 border-blue-200 text-blue-700',
  };
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm ${colores[item.nivel] ?? colores.INFO}`}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>{item.mensaje}</span>
    </div>
  );
}

// ── Audiencia próxima ────────────────────────────────────────────────────────
function AudienciaRow({ a }) {
  const alerta = { CRITICA: 'text-red-600', ALTA: 'text-orange-500', MEDIA: 'text-gray-500' };
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b last:border-0">
      <div className="overflow-hidden">
        <p className="text-sm font-medium text-gray-800 truncate">{a.titulo}</p>
        <p className="text-xs text-gray-500 truncate">
          Exp. {a.caso.numero} · {a.caso.abogado.nombre}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-gray-800">
          {format(parseISO(a.fecha), "d MMM", { locale: es })}
        </p>
        <p className={`text-xs font-medium ${alerta[a.alerta]}`}>
          {a.diasRestantes === 0 ? 'Hoy' : `en ${a.diasRestantes}d`}
        </p>
      </div>
    </div>
  );
}

// ── Término procesal ─────────────────────────────────────────────────────────
function TerminoRow({ t }) {
  const semColor = {
    ROJO: 'bg-red-500', NARANJA: 'bg-orange-400',
    AMARILLO: 'bg-yellow-400', VERDE: 'bg-green-500', VENCIDO: 'bg-red-700',
  };
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b last:border-0">
      <div className="flex items-start gap-2 overflow-hidden">
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${semColor[t.semaforo] ?? 'bg-gray-300'}`} />
        <div className="overflow-hidden">
          <p className="text-sm font-medium text-gray-800 truncate">{t.descripcion}</p>
          <p className="text-xs text-gray-500 truncate">Exp. {t.caso.numero}</p>
        </div>
      </div>
      <p className="text-xs text-gray-500 shrink-0">
        {format(parseISO(t.fechaVence), "d MMM", { locale: es })}
      </p>
    </div>
  );
}

// ── Dashboard principal ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600">
        Error al cargar el dashboard. Intente nuevamente.
      </div>
    );
  }

  const { resumen, alertasCriticas, audienciasSemana, terminosProximos, horasMes, facturacion } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Hola, {user?.nombre?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })}
        </p>
      </div>

      {/* Alertas críticas */}
      {alertasCriticas?.total > 0 && (
        <div className="space-y-2">
          {alertasCriticas.items.map((item, i) => (
            <AlertaItem key={i} item={item} />
          ))}
        </div>
      )}

      {/* Métricas principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Casos activos"
          value={resumen.casosActivos}
          sub={`${resumen.casosEsMes} abiertos este mes`}
          icon={FolderOpen}
          color="indigo"
          to="/casos"
        />
        <MetricCard
          label="Clientes"
          value={resumen.totalClientes}
          icon={Users}
          color="green"
          to="/clientes"
        />
        <MetricCard
          label="Horas facturables"
          value={`${horasMes?.facturables ?? 0}h`}
          sub="este mes"
          icon={Clock}
          color="yellow"
        />
        {facturacion && (
          <MetricCard
            label="Por cobrar"
            value={`B/. ${facturacion.totalPorCobrar.toLocaleString('es-PA', { minimumFractionDigits: 2 })}`}
            sub={`cobrado: B/. ${facturacion.cobradoMes.toLocaleString('es-PA', { minimumFractionDigits: 2 })} este mes`}
            icon={DollarSign}
            color="red"
            to="/facturas"
          />
        )}
      </div>

      {/* Panel central: audiencias + términos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Audiencias próximas */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Gavel className="w-4 h-4 text-indigo-500" />
              Audiencias esta semana
            </h2>
            <Link to="/calendario" className="text-xs text-indigo-600 hover:underline">Ver todas</Link>
          </div>
          {audienciasSemana?.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Sin audiencias esta semana</p>
          ) : (
            audienciasSemana?.slice(0, 5).map((a) => <AudienciaRow key={a.id} a={a} />)
          )}
        </div>

        {/* Términos próximos */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-500" />
              Términos próximos
              {terminosProximos?.totalVencidos > 0 && (
                <span className="ml-1 bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                  {terminosProximos.totalVencidos} vencidos
                </span>
              )}
            </h2>
          </div>
          {terminosProximos?.proximos?.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Sin términos próximos</p>
          ) : (
            terminosProximos?.proximos?.slice(0, 5).map((t) => <TerminoRow key={t.id} t={t} />)
          )}
        </div>
      </div>

      {/* Abogados activos */}
      {data.casosPorAbogado && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-green-500" />
            Carga por abogado
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.casosPorAbogado.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-center w-9 h-9 bg-indigo-600 text-white text-sm font-bold rounded-full shrink-0">
                  {a.nombre.charAt(0)}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium truncate">{a.nombre}</p>
                  <p className="text-xs text-gray-500">{a.casosActivos} casos · {a.horasMes}h mes</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
