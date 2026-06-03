import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  getTodasPendientes, completarTarea, actualizarTarea,
  getNotasTareas, guardarNotasTareas,
} from '../../api/tareas';
import { getAbogados } from '../../api/abogados';
import Spinner from '../../components/ui/Spinner';
import { CheckCircle, Circle, Search, Folder, Pencil, X, StickyNote } from 'lucide-react';
import {
  format, parseISO, isToday, startOfDay, differenceInCalendarDays,
} from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const PRIORIDADES = ['ALTA', 'MEDIA', 'BAJA'];
const ESTADOS = ['PENDIENTE', 'EN_PROCESO'];

const prioridadCfg = {
  ALTA:  { color: 'text-red-600 bg-red-50 border-red-200',          dot: 'bg-red-500'    },
  MEDIA: { color: 'text-yellow-700 bg-yellow-50 border-yellow-200', dot: 'bg-yellow-400' },
  BAJA:  { color: 'text-gray-500 bg-gray-50 border-gray-200',       dot: 'bg-gray-300'   },
};

// Clasifica cada tarea pendiente en un grupo por urgencia según su fecha límite.
const GRUPOS = [
  { id: 'vencidas',  label: 'Vencidas',      tono: 'text-red-600'    },
  { id: 'hoy',       label: 'Hoy',           tono: 'text-orange-600' },
  { id: 'semana',    label: 'Esta semana',   tono: 'text-indigo-600' },
  { id: 'despues',   label: 'Más adelante',  tono: 'text-gray-600'   },
  { id: 'sinFecha',  label: 'Sin fecha',     tono: 'text-gray-400'   },
];

function grupoDe(tarea) {
  if (!tarea.fechaLimite) return 'sinFecha';
  const dias = differenceInCalendarDays(startOfDay(parseISO(tarea.fechaLimite)), startOfDay(new Date()));
  if (dias < 0) return 'vencidas';
  if (isToday(parseISO(tarea.fechaLimite))) return 'hoy';
  if (dias <= 7) return 'semana';
  return 'despues';
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

function EditarTareaForm({ t, abogados, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    descripcion: t.descripcion ?? '',
    fechaLimite: t.fechaLimite ? t.fechaLimite.slice(0, 10) : '',
    prioridad: t.prioridad ?? 'MEDIA',
    abogadoId: t.abogado?.id ?? '',
    estado: t.estado ?? 'PENDIENTE',
    notas: t.notas ?? '',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => actualizarTarea(t.id, {
      descripcion: form.descripcion,
      fechaLimite: form.fechaLimite || null,
      prioridad: form.prioridad,
      abogadoId: form.abogadoId || undefined,
      estado: form.estado,
      notas: form.notas,
    }),
    onSuccess: () => {
      toast.success('Tarea actualizada');
      qc.invalidateQueries({ queryKey: ['tareas-todas'] });
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar'),
  });

  const valido = form.descripcion.trim().length >= 3;

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-indigo-900">Editar tarea</h3>
        <button onClick={onClose} className="text-indigo-400 hover:text-indigo-700"><X className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripción <span className="text-red-500">*</span></label>
          <input value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha límite</label>
          <input type="date" value={form.fechaLimite} onChange={(e) => set('fechaLimite', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Prioridad</label>
          <select value={form.prioridad} onChange={(e) => set('prioridad', e.target.value)} className={inputCls}>
            {PRIORIDADES.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Asignar a</label>
          <select value={form.abogadoId} onChange={(e) => set('abogadoId', e.target.value)} className={inputCls}>
            <option value="">Sin asignar</option>
            {abogados.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
          <select value={form.estado} onChange={(e) => set('estado', e.target.value)} className={inputCls}>
            {ESTADOS.map((e) => <option key={e} value={e}>{e === 'EN_PROCESO' ? 'En proceso' : 'Pendiente'}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
          <input value={form.notas} onChange={(e) => set('notas', e.target.value)} placeholder="Observaciones adicionales..." className={inputCls} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!valido || mutation.isPending}
          className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
        >
          {mutation.isPending ? <Spinner size="sm" /> : null}
          Guardar cambios
        </button>
      </div>
    </div>
  );
}

function TareaCard({ t, onComplete, completando, onEdit }) {
  const cfg = prioridadCfg[t.prioridad] ?? prioridadCfg.BAJA;
  const vencida = grupoDe(t) === 'vencidas';
  return (
    <div className="flex items-start gap-3 bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors group">
      <button
        onClick={() => onComplete(t.id)}
        disabled={completando}
        className="mt-0.5 shrink-0 text-gray-300 hover:text-green-500 transition-colors"
        title="Marcar como completada"
      >
        <Circle className="w-5 h-5" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{t.caso?.cliente?.nombre ?? 'Sin cliente'}</span>
          {t.caso && (
            <Link
              to={`/casos/${t.caso.id}`}
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              <Folder className="w-3 h-3" />
              {t.caso.numero}
            </Link>
          )}
        </div>
        <p className={`text-sm mt-1 ${vencida ? 'text-red-700' : 'text-gray-700'}`}>{t.descripcion}</p>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {t.prioridad}
          </span>
          {t.abogado && <span className="text-xs text-gray-500">{t.abogado.nombre}</span>}
          {t.fechaLimite && (
            <span className={`text-xs ${vencida ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
              {vencida ? '⚠ ' : ''}
              {format(parseISO(t.fechaLimite), "d 'de' MMM yyyy", { locale: es })}
            </span>
          )}
          {t.estado === 'EN_PROCESO' && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">En proceso</span>
          )}
        </div>
        {t.notas && <p className="text-xs text-gray-400 mt-1">{t.notas}</p>}
      </div>
      <button
        onClick={() => onEdit(t.id)}
        className="shrink-0 text-gray-300 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
        title="Editar tarea"
      >
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  );
}

function NotasGenerales() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['tareas-notas'], queryFn: getNotasTareas });
  const [texto, setTexto] = useState('');
  const [cargado, setCargado] = useState(false);
  const [estado, setEstado] = useState('idle'); // idle | guardando | guardado
  const timer = useRef(null);

  // Inicializa el texto una sola vez cuando llega del servidor.
  useEffect(() => {
    if (data && !cargado) {
      setTexto(data.notas ?? '');
      setCargado(true);
    }
  }, [data, cargado]);

  const mutation = useMutation({
    mutationFn: (val) => guardarNotasTareas(val),
    onMutate: () => setEstado('guardando'),
    onSuccess: () => {
      setEstado('guardado');
      qc.setQueryData(['tareas-notas'], (old) => ({ ...(old || {}), notas: texto }));
    },
    onError: () => setEstado('idle'),
  });

  const onChange = (val) => {
    setTexto(val);
    setEstado('idle');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => mutation.mutate(val), 900);
  };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-amber-800">
          <StickyNote className="w-4 h-4" />
          <h2 className="text-sm font-semibold">Notas generales</h2>
        </div>
        <span className="text-xs text-amber-600">
          {estado === 'guardando' ? 'Guardando…' : estado === 'guardado' ? 'Guardado ✓' : ''}
        </span>
      </div>
      <textarea
        value={texto}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Apuntes, recordatorios, pendientes sueltos… (se guardan solos)"
        rows={3}
        className="w-full bg-white/70 border border-amber-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-amber-400/70 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
      />
    </div>
  );
}

export default function TareasPage() {
  const qc = useQueryClient();
  const [filtros, setFiltros] = useState({ busqueda: '', abogadoId: '', prioridad: '' });
  const [editId, setEditId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['tareas-todas', filtros.abogadoId, filtros.prioridad],
    queryFn: () => getTodasPendientes({
      abogadoId: filtros.abogadoId || undefined,
      prioridad: filtros.prioridad || undefined,
    }),
  });

  const { data: abogados = [] } = useQuery({ queryKey: ['abogados'], queryFn: getAbogados });

  const completar = useMutation({
    mutationFn: (id) => completarTarea(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tareas-todas'] });
      toast.success('Tarea completada');
    },
    onError: () => toast.error('Error al completar la tarea'),
  });

  const tareas = data ?? [];

  const q = filtros.busqueda.trim().toLowerCase();
  const filtradas = q
    ? tareas.filter((t) =>
        t.descripcion?.toLowerCase().includes(q) ||
        t.caso?.cliente?.nombre?.toLowerCase().includes(q) ||
        t.caso?.numero?.toLowerCase().includes(q) ||
        t.caso?.titulo?.toLowerCase().includes(q))
    : tareas;

  const agrupadas = GRUPOS.map((g) => ({
    ...g,
    items: filtradas.filter((t) => grupoDe(t) === g.id),
  })).filter((g) => g.items.length > 0);

  const vencidasCount = filtradas.filter((t) => grupoDe(t) === 'vencidas').length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Tareas pendientes</h1>
      <p className="text-sm text-gray-500 mb-6">
        {filtradas.length} pendiente{filtradas.length !== 1 ? 's' : ''} en toda la firma
        {vencidasCount > 0 && <span className="text-red-600 font-medium"> · {vencidasCount} vencida{vencidasCount !== 1 ? 's' : ''}</span>}
      </p>

      <NotasGenerales />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por tarea, cliente o expediente..."
            value={filtros.busqueda}
            onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filtros.abogadoId}
          onChange={(e) => setFiltros({ ...filtros, abogadoId: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todo el equipo</option>
          {abogados.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <select
          value={filtros.prioridad}
          onChange={(e) => setFiltros({ ...filtros, prioridad: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Toda prioridad</option>
          {PRIORIDADES.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400 opacity-60" />
          <p className="font-medium text-gray-600">¡Todo al día!</p>
          <p className="text-sm mt-1">No hay tareas pendientes con los filtros actuales.</p>
        </div>
      ) : (
        <div className="space-y-7">
          {agrupadas.map((g) => (
            <section key={g.id}>
              <h2 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${g.tono}`}>
                {g.label} ({g.items.length})
              </h2>
              <div className="space-y-2">
                {g.items.map((t) => (
                  editId === t.id ? (
                    <EditarTareaForm key={t.id} t={t} abogados={abogados} onClose={() => setEditId(null)} />
                  ) : (
                    <TareaCard
                      key={t.id}
                      t={t}
                      onComplete={completar.mutate}
                      completando={completar.isPending}
                      onEdit={setEditId}
                    />
                  )
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
