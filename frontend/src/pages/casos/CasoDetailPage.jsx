import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCaso, getTimeline, getEstadisticas, agregarClienteCaso, removerClienteCaso } from '../../api/casos';
import { getClientes } from '../../api/clientes';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import TabTimeline from './tabs/TabTimeline';
import TabAudiencias from './tabs/TabAudiencias';
import TabTerminos from './tabs/TabTerminos';
import TabTareas from './tabs/TabTareas';
import TabDocumentos from './tabs/TabDocumentos';
import TabGastos from './tabs/TabGastos';
import TabComunicaciones from './tabs/TabComunicaciones';
import TabHonorarios from './tabs/TabHonorarios';
import TabAsistente from './tabs/TabAsistente';
import {
  ArrowLeft, Clock, AlertTriangle, CheckSquare,
  FileText, DollarSign, User, Building2, Gavel,
  MapPin, Scale, Receipt, MessageSquare, Sparkles,
  UserPlus, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const TABS = [
  { id: 'timeline',   label: 'Timeline',    icon: Clock },
  { id: 'audiencias', label: 'Audiencias',  icon: Gavel },
  { id: 'terminos',   label: 'Términos',    icon: AlertTriangle },
  { id: 'tareas',     label: 'Tareas',      icon: CheckSquare },
  { id: 'documentos', label: 'Documentos',  icon: FileText },
  { id: 'gastos',          label: 'Gastos',          icon: Receipt },
  { id: 'comunicaciones', label: 'Comunicaciones',  icon: MessageSquare },
  { id: 'honorarios',     label: 'Honorarios',      icon: DollarSign },
  { id: 'asistente',      label: 'Asistente IA',    icon: Sparkles },
];

function StatCard({ label, value, sub, icon: Icon, color = 'gray' }) {
  const colors = {
    gray:   'bg-gray-50 text-gray-500',
    indigo: 'bg-indigo-50 text-indigo-600',
    green:  'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red:    'bg-red-50 text-red-600',
  };
  return (
    <div className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3">
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-sm font-bold text-gray-900">{value ?? '—'}</p>
        <p className="text-xs text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

export default function CasoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('timeline');
  const [showAgregarCliente, setShowAgregarCliente] = useState(false);

  const { data: caso, isLoading, error } = useQuery({
    queryKey: ['caso', id],
    queryFn: () => getCaso(id),
  });

  const { data: stats } = useQuery({
    queryKey: ['caso-stats', id],
    queryFn: () => getEstadisticas(id),
    enabled: !!id,
  });

  const { data: timeline } = useQuery({
    queryKey: ['caso-timeline', id],
    queryFn: () => getTimeline(id),
    enabled: tab === 'timeline' && !!id,
  });

  const mutAgregarCliente = useMutation({
    mutationFn: ({ clienteId, rol }) => agregarClienteCaso(id, clienteId, rol),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['caso', id] }); toast.success('Cliente agregado'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error'),
  });

  const mutRemoverCliente = useMutation({
    mutationFn: (clienteId) => removerClienteCaso(id, clienteId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['caso', id] }); toast.success('Cliente removido'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !caso) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 mb-4">No se pudo cargar el caso.</p>
        <button onClick={() => navigate('/casos')} className="text-indigo-600 hover:underline">
          Volver a casos
        </button>
      </div>
    );
  }

  const conteoTabs = {
    audiencias: caso._count?.audiencias,
    terminos:   caso._count?.terminos,
    tareas:     caso._count?.tareas,
    documentos: caso._count?.documentos,
    gastos:          caso._count?.gastos,
    comunicaciones:  caso._count?.comunicaciones,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <button
              onClick={() => navigate('/casos')}
              className="flex items-center gap-1 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Casos
            </button>
            <span>/</span>
            <span className="font-mono text-indigo-700 font-semibold">{caso.numero}</span>
          </div>

          {/* Título y estado */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <span className="font-mono text-sm font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">
                  {caso.numero}
                </span>
                <Badge value={caso.estado} />
                <Badge value={caso.tipo} />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mt-2 leading-tight">
                {caso.titulo}
              </h1>
            </div>
          </div>

          {/* Meta info */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
            {/* Clientes */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 text-gray-600">
                {caso.cliente?.tipo === 'JURIDICA'
                  ? <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                  : <User className="w-4 h-4 text-gray-400 shrink-0" />}
                <Link to={`/clientes/${caso.cliente?.id}`} className="truncate hover:text-indigo-600 transition-colors">
                  {caso.cliente?.nombre}
                </Link>
              </div>
              {caso.clientesAdicionales?.map((ca) => (
                <div key={ca.cliente.id} className="flex items-center gap-2 text-gray-500 pl-6">
                  <span className="truncate text-xs">{ca.cliente.nombre}</span>
                  {ca.rol && <span className="text-[10px] text-gray-400 shrink-0">· {ca.rol}</span>}
                  {['ADMIN', 'SOCIO'].includes(caso.abogado?.rol) && (
                    <button
                      onClick={() => mutRemoverCliente.mutate(ca.cliente.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {['ADMIN', 'SOCIO'].includes(caso.abogado?.rol) && (
                <button
                  onClick={() => setShowAgregarCliente(true)}
                  className="flex items-center gap-1 pl-6 text-xs text-indigo-500 hover:text-indigo-700 transition-colors w-fit"
                >
                  <UserPlus className="w-3 h-3" /> Agregar cliente
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Scale className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="truncate">{caso.abogado?.nombre}</span>
            </div>
            {caso.juzgado && (
              <div className="flex items-center gap-2 text-gray-600 col-span-2">
                <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate">{caso.juzgado}</span>
                {caso.juez && <span className="text-gray-400">· {caso.juez}</span>}
              </div>
            )}
            {caso.contraparte && (
              <div className="flex items-center gap-2 text-gray-600 col-span-2">
                <span className="text-gray-400 text-xs font-medium">Contraparte:</span>
                <span className="truncate">{caso.contraparte}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-400 text-xs">
              Abierto el {format(parseISO(caso.fechaApertura), "d 'de' MMMM yyyy", { locale: es })}
            </div>
          </div>

          {/* Stats rápidas */}
          {stats && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Horas totales"
                value={`${stats.horas.total.toFixed(1)}h`}
                sub={`${stats.horas.facturables.toFixed(1)}h facturables`}
                icon={Clock}
                color="indigo"
              />
              <StatCard
                label="Valor facturable"
                value={`B/. ${stats.horas.valorFacturable.toFixed(2)}`}
                icon={DollarSign}
                color="green"
              />
              <StatCard
                label="Gastos del caso"
                value={`B/. ${stats.gastos.total.toFixed(2)}`}
                icon={DollarSign}
                color="yellow"
              />
              <StatCard
                label="Tareas pendientes"
                value={stats.tareasPendientes}
                sub={stats.terminosVencidos > 0 ? `${stats.terminosVencidos} términos vencidos` : undefined}
                icon={CheckSquare}
                color={stats.tareasPendientes > 0 ? 'red' : 'gray'}
              />
            </div>
          )}

          {/* Tabs */}
          <div className="mt-5 flex gap-1 -mb-px">
            {TABS.map(({ id: tid, label, icon: Icon }) => {
              const count = conteoTabs[tid];
              return (
                <button
                  key={tid}
                  onClick={() => setTab(tid)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    tab === tid
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {count !== undefined && count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      tab === tid ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {showAgregarCliente && (
        <AgregarClienteModal
          casoId={id}
          firmaId={caso.firmaId}
          clientesPrevios={[caso.clienteId, ...(caso.clientesAdicionales?.map((ca) => ca.cliente.id) ?? [])]}
          onClose={() => setShowAgregarCliente(false)}
          onAgregar={(clienteId, rol) => {
            mutAgregarCliente.mutate({ clienteId, rol });
            setShowAgregarCliente(false);
          }}
        />
      )}

      {/* ── Contenido del tab ─────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {tab === 'timeline'   && <TabTimeline   casoId={id} timeline={timeline} />}
        {tab === 'audiencias' && <TabAudiencias casoId={id} caso={caso} />}
        {tab === 'terminos'   && <TabTerminos   casoId={id} caso={caso} />}
        {tab === 'tareas'     && <TabTareas     casoId={id} caso={caso} />}
        {tab === 'documentos' && <TabDocumentos casoId={id} caso={caso} />}
        {tab === 'gastos'          && <TabGastos          casoId={id} />}
        {tab === 'comunicaciones' && <TabComunicaciones  casoId={id} clienteId={caso.cliente?.id} />}
        {tab === 'honorarios'     && <TabHonorarios      casoId={id} />}
        {tab === 'asistente'      && <TabAsistente       casoId={id} caso={caso} />}
      </div>
    </div>
  );
}

function AgregarClienteModal({ casoId, firmaId, clientesPrevios, onClose, onAgregar }) {
  const [clienteId, setClienteId] = useState('');
  const [rol, setRol] = useState('');

  const { data: clientesResp } = useQuery({
    queryKey: ['clientes-select', firmaId],
    queryFn: () => getClientes({ porPagina: 200 }),
  });

  const disponibles = (clientesResp?.datos ?? []).filter((c) => !clientesPrevios.includes(c.id));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Agregar cliente al caso</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cliente <span className="text-red-500">*</span></label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Seleccionar cliente...</option>
              {disponibles.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rol en el caso (opcional)</label>
            <input
              type="text"
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              placeholder="ej. co-demandante, garante, representado..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button
              type="button"
              disabled={!clienteId}
              onClick={() => onAgregar(clienteId, rol || null)}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
