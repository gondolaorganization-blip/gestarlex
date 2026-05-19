import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCaso, getTimeline, getEstadisticas } from '../../api/casos';
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
} from 'lucide-react';
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
  const [tab, setTab] = useState('timeline');

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
            <div className="flex items-center gap-2 text-gray-600">
              {caso.cliente?.tipo === 'JURIDICA'
                ? <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                : <User className="w-4 h-4 text-gray-400 shrink-0" />}
              <span className="truncate">{caso.cliente?.nombre}</span>
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
