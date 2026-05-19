import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getComunicacionesCaso, crearComunicacion, eliminarComunicacion, getEmailLogsCaso } from '../../../api/comunicaciones';
import { useAuth } from '../../../contexts/AuthContext';
import Spinner from '../../../components/ui/Spinner';
import toast from 'react-hot-toast';
import {
  Mail, Phone, Users, MessageSquare, FileText,
  Plus, Trash2, X, MessagesSquare, Send, CheckCircle, AlertCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TIPOS = ['EMAIL', 'LLAMADA', 'REUNION', 'WHATSAPP', 'CARTA'];

const EMAIL_TIPO_META = {
  TAREA_COMPLETADA:      { label: 'Tarea completada',   cls: 'bg-green-100 text-green-700' },
  NUEVA_AUDIENCIA:       { label: 'Nueva audiencia',    cls: 'bg-blue-100 text-blue-700' },
  NUEVO_TERMINO:         { label: 'Nuevo término',      cls: 'bg-yellow-100 text-yellow-700' },
  FACTURA_ENVIADA:       { label: 'Factura enviada',    cls: 'bg-indigo-100 text-indigo-700' },
  RECORDATORIO_AUDIENCIA:{ label: 'Recordatorio aud.',  cls: 'bg-purple-100 text-purple-700' },
  ALERTA_TERMINO:        { label: 'Alerta término',     cls: 'bg-red-100 text-red-700' },
};

const TIPO_META = {
  EMAIL:    { label: 'Email',    icon: Mail,           cls: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  LLAMADA:  { label: 'Llamada',  icon: Phone,          cls: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  REUNION:  { label: 'Reunión',  icon: Users,          cls: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  WHATSAPP: { label: 'WhatsApp', icon: MessageSquare,  cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  CARTA:    { label: 'Carta',    icon: FileText,       cls: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
};

const todayStr = () => new Date().toISOString().split('T')[0];
const FORM_INIT = { tipo: 'EMAIL', descripcion: '', fecha: todayStr(), notas: '' };

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function TabComunicaciones({ casoId, clienteId }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const puedeEliminar = ['ADMIN', 'SOCIO'].includes(user?.rol);

  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState(FORM_INIT);
  const [confirmDel, setConfirmDel] = useState(null);

  // ── queries ──────────────────────────────────────────────────────────────

  const { data: comunicaciones = [], isLoading } = useQuery({
    queryKey: ['comunicaciones-caso', casoId],
    queryFn: () => getComunicacionesCaso(casoId),
  });

  const { data: emailLogs = [] } = useQuery({
    queryKey: ['email-logs-caso', casoId],
    queryFn: () => getEmailLogsCaso(casoId),
  });

  // ── mutations ─────────────────────────────────────────────────────────────

  const crear = useMutation({
    mutationFn: () => crearComunicacion({
      clienteId,
      casoId,
      tipo: form.tipo,
      descripcion: form.descripcion.trim(),
      fecha: form.fecha,
      notas: form.notas.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success('Comunicación registrada');
      qc.invalidateQueries({ queryKey: ['comunicaciones-caso', casoId] });
      qc.invalidateQueries({ queryKey: ['caso-timeline', casoId] });
      setForm(FORM_INIT);
      setShowForm(false);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al registrar'),
  });

  const eliminar = useMutation({
    mutationFn: eliminarComunicacion,
    onSuccess: () => {
      toast.success('Comunicación eliminada');
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: ['comunicaciones-caso', casoId] });
    },
    onError: () => toast.error('Error al eliminar'),
  });

  // ── helpers ───────────────────────────────────────────────────────────────

  const canSubmit = form.descripcion.trim().length >= 3 && !crear.isPending;
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  if (isLoading) return <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-5 max-w-3xl">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {comunicaciones.length} comunicación{comunicaciones.length !== 1 ? 'es' : ''} registrada{comunicaciones.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => { setShowForm((v) => !v); setForm(FORM_INIT); }}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancelar' : 'Registrar'}
        </button>
      </div>

      {/* ── Form ────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-white rounded-xl border-2 border-indigo-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MessagesSquare className="w-4 h-4 text-indigo-600" /> Nueva comunicación
          </h3>

          {/* Tipo selector */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-2">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => {
                const { label, icon: Icon, cls } = TIPO_META[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, tipo: t }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      form.tipo === t
                        ? `border-transparent ${cls}`
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Descripción */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Descripción <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.descripcion}
                onChange={set('descripcion')}
                rows={2}
                placeholder="Ej: Llamada con cliente para revisar avance del proceso"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={set('fecha')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Notas */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notas (opcional)</label>
              <input
                value={form.notas}
                onChange={set('notas')}
                placeholder="Notas adicionales..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={() => { setShowForm(false); setForm(FORM_INIT); }}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => crear.mutate()}
              disabled={!canSubmit}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {crear.isPending ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
              Registrar
            </button>
          </div>
        </div>
      )}

      {/* ── Timeline ────────────────────────────────────────────────── */}
      {comunicaciones.length === 0 ? (
        <div className="text-center py-14 text-gray-400">
          <MessagesSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin comunicaciones registradas</p>
          <p className="text-sm mt-1">Lleva un registro de emails, llamadas y reuniones con el cliente</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />

          <div className="space-y-3">
            {comunicaciones.map((c) => {
              const meta = TIPO_META[c.tipo] ?? TIPO_META.EMAIL;
              const Icon = meta.icon;
              return (
                <div key={c.id} className="relative flex gap-4">
                  {/* Dot */}
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 z-10 ${meta.cls}`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-gray-300 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.cls}`}>
                            {meta.label}
                          </span>
                          {c.abogado && (
                            <span className="text-xs text-gray-400">{c.abogado.nombre}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800">{c.descripcion}</p>
                        {c.notas && (
                          <p className="text-xs text-gray-400 mt-1 italic">"{c.notas}"</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {format(parseISO(c.fecha), "d MMM yyyy", { locale: es })}
                        </span>
                        {puedeEliminar && (
                          confirmDel === c.id ? (
                            <div className="flex items-center gap-1 ml-1">
                              <button
                                onClick={() => eliminar.mutate(c.id)}
                                disabled={eliminar.isPending}
                                className="text-xs px-2 py-0.5 bg-red-600 text-white rounded-lg hover:bg-red-700"
                              >
                                Sí
                              </button>
                              <button
                                onClick={() => setConfirmDel(null)}
                                className="text-xs px-2 py-0.5 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDel(c.id)}
                              className="ml-1 p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* ── Correos automáticos ─────────────────────────────────────── */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Send className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Correos automáticos enviados</h3>
          {emailLogs.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{emailLogs.length}</span>
          )}
        </div>

        {emailLogs.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Sin correos automáticos registrados para este caso.</p>
        ) : (
          <div className="space-y-2">
            {emailLogs.map((log) => {
              const meta = EMAIL_TIPO_META[log.tipo] ?? { label: log.tipo, cls: 'bg-gray-100 text-gray-600' };
              return (
                <div key={log.id} className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
                  <div className="mt-0.5 shrink-0">
                    {log.enviado
                      ? <CheckCircle className="w-4 h-4 text-green-500" />
                      : <AlertCircle className="w-4 h-4 text-red-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.cls}`}>
                        {meta.label}
                      </span>
                      <span className="text-xs text-gray-500 truncate">{log.asunto}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                      <span>Para: {log.destinatario}</span>
                      {log.enviado && log.fechaEnvio && (
                        <span>
                          {format(parseISO(log.fechaEnvio), "d MMM yyyy HH:mm", { locale: es })}
                        </span>
                      )}
                      {!log.enviado && (
                        <span className="text-red-400">{log.error || 'No enviado'}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
