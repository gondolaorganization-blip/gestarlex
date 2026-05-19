import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTareas, crearTarea, completarTarea } from '../../../api/tareas';
import { getAbogados } from '../../../api/abogados';
import Spinner from '../../../components/ui/Spinner';
import { CheckSquare, CheckCircle, Circle, Plus, X } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const PRIORIDADES = ['ALTA', 'MEDIA', 'BAJA'];

const prioridadCfg = {
  ALTA:  { color: 'text-red-600 bg-red-50 border-red-200',         dot: 'bg-red-500'    },
  MEDIA: { color: 'text-yellow-700 bg-yellow-50 border-yellow-200', dot: 'bg-yellow-400' },
  BAJA:  { color: 'text-gray-500 bg-gray-50 border-gray-200',      dot: 'bg-gray-300'   },
};

const INIT = { descripcion: '', fechaLimite: '', prioridad: 'MEDIA', abogadoId: '', notas: '' };

function FormTarea({ casoId, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(INIT);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const { data: abogados = [] } = useQuery({
    queryKey: ['abogados'],
    queryFn: getAbogados,
  });

  const mutation = useMutation({
    mutationFn: () => crearTarea(casoId, {
      descripcion: form.descripcion,
      prioridad: form.prioridad || undefined,
      fechaLimite: form.fechaLimite || undefined,
      abogadoId: form.abogadoId || undefined,
      notas: form.notas || undefined,
    }),
    onSuccess: () => {
      toast.success('Tarea registrada');
      qc.invalidateQueries({ queryKey: ['tareas', casoId] });
      qc.invalidateQueries({ queryKey: ['caso-stats', casoId] });
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar'),
  });

  const valido = form.descripcion.trim().length >= 3;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-blue-900">Nueva tarea</h3>
        <button onClick={onClose} className="text-blue-400 hover:text-blue-700"><X className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripción <span className="text-red-500">*</span></label>
          <input
            value={form.descripcion}
            onChange={(e) => set('descripcion', e.target.value)}
            placeholder="Ej: Revisar expediente y preparar alegatos"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha límite</label>
          <input
            type="date"
            value={form.fechaLimite}
            onChange={(e) => set('fechaLimite', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Prioridad</label>
          <select
            value={form.prioridad}
            onChange={(e) => set('prioridad', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PRIORIDADES.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
          </select>
        </div>

        {abogados.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Asignar a</label>
            <select
              value={form.abogadoId}
              onChange={(e) => set('abogadoId', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sin asignar</option>
              {abogados.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
        )}

        <div className={abogados.length > 0 ? '' : 'sm:col-span-2'}>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
          <input
            value={form.notas}
            onChange={(e) => set('notas', e.target.value)}
            placeholder="Observaciones adicionales..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
          Cancelar
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!valido || mutation.isPending}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {mutation.isPending ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
          Guardar tarea
        </button>
      </div>
    </div>
  );
}

export default function TabTareas({ casoId }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['tareas', casoId],
    queryFn: () => getTareas(casoId),
  });

  const completar = useMutation({
    mutationFn: (id) => completarTarea(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tareas', casoId] });
      qc.invalidateQueries({ queryKey: ['caso-stats', casoId] });
      toast.success('Tarea completada');
    },
    onError: () => toast.error('Error al completar la tarea'),
  });

  const tareas = data?.datos ?? data ?? [];

  if (isLoading) return <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>;

  const pendientes  = tareas.filter(t => t.estado !== 'COMPLETADA');
  const completadas = tareas.filter(t => t.estado === 'COMPLETADA');

  return (
    <div className="max-w-3xl">
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva tarea
        </button>
      </div>

      {showForm && <FormTarea casoId={casoId} onClose={() => setShowForm(false)} />}

      {tareas.length === 0 && !showForm ? (
        <div className="text-center py-16 text-gray-400">
          <CheckSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin tareas asignadas</p>
          <p className="text-sm mt-1">Agrega la primera tarea usando el botón de arriba</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendientes.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Pendientes ({pendientes.length})
              </h3>
              <div className="space-y-2">
                {pendientes.map((t) => {
                  const cfg = prioridadCfg[t.prioridad] ?? prioridadCfg.BAJA;
                  const vencida = t.fechaLimite && isPast(parseISO(t.fechaLimite)) && t.estado !== 'COMPLETADA';
                  return (
                    <div key={t.id} className="flex items-start gap-3 bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors">
                      <button
                        onClick={() => completar.mutate(t.id)}
                        disabled={completar.isPending}
                        className="mt-0.5 shrink-0 text-gray-300 hover:text-green-500 transition-colors"
                        title="Marcar como completada"
                      >
                        <Circle className="w-5 h-5" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${vencida ? 'text-red-700' : 'text-gray-800'}`}>
                          {t.descripcion}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {t.prioridad}
                          </span>
                          {t.abogado && (
                            <span className="text-xs text-gray-500">{t.abogado.nombre}</span>
                          )}
                          {t.fechaLimite && (
                            <span className={`text-xs ${vencida ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                              {vencida ? '⚠ ' : ''}
                              {format(parseISO(t.fechaLimite), "d 'de' MMM yyyy", { locale: es })}
                            </span>
                          )}
                        </div>
                        {t.notas && <p className="text-xs text-gray-400 mt-1">{t.notas}</p>}
                      </div>
                      {t.estado === 'EN_PROCESO' && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full shrink-0">
                          En proceso
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {completadas.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Completadas ({completadas.length})
              </h3>
              <div className="space-y-2">
                {completadas.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-100 px-4 py-3 opacity-60">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                    <p className="text-sm text-gray-500 line-through flex-1">{t.descripcion}</p>
                    {t.completadaEn && (
                      <span className="text-xs text-gray-400 shrink-0">
                        {format(parseISO(t.completadaEn), "d MMM", { locale: es })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
