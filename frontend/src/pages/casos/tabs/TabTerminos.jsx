import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTerminos, crearTermino, completarTermino } from '../../../api/terminos';
import Spinner from '../../../components/ui/Spinner';
import { Clock, CheckCircle, Plus, X } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const PRIORIDADES = ['ALTA', 'MEDIA', 'BAJA'];

const semaforo = (fechaVence, estado) => {
  if (estado === 'COMPLETADO') return { color: 'bg-green-500', label: 'Completado', cls: 'text-green-700 bg-green-50 border-green-200' };
  if (estado === 'VENCIDO')    return { color: 'bg-red-600',   label: 'Vencido',    cls: 'text-red-700   bg-red-50   border-red-200'   };
  const dias = differenceInDays(parseISO(fechaVence), new Date());
  if (dias < 0)  return { color: 'bg-red-600',    label: 'Vencido',     cls: 'text-red-700   bg-red-50   border-red-200'   };
  if (dias === 0) return { color: 'bg-red-500',   label: 'Vence hoy',   cls: 'text-red-600   bg-red-50   border-red-200'   };
  if (dias <= 3)  return { color: 'bg-orange-400', label: `${dias}d`,   cls: 'text-orange-700 bg-orange-50 border-orange-200' };
  if (dias <= 7)  return { color: 'bg-yellow-400', label: `${dias}d`,   cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' };
  return           { color: 'bg-green-400',  label: `${dias}d`,         cls: 'text-green-700 bg-green-50 border-green-200'  };
};

const prioridadColor = { ALTA: 'text-red-600', MEDIA: 'text-yellow-600', BAJA: 'text-gray-400' };

const INIT = { descripcion: '', fechaVence: '', prioridad: 'MEDIA', diasAlerta: '3', notas: '' };

function FormTermino({ casoId, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(INIT);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => crearTermino(casoId, {
      descripcion: form.descripcion,
      fechaVence: form.fechaVence,
      prioridad: form.prioridad || undefined,
      diasAlerta: form.diasAlerta ? parseInt(form.diasAlerta) : undefined,
      notas: form.notas || undefined,
    }),
    onSuccess: () => {
      toast.success('Término registrado');
      qc.invalidateQueries({ queryKey: ['terminos', casoId] });
      qc.invalidateQueries({ queryKey: ['caso-stats', casoId] });
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar'),
  });

  const valido = form.descripcion.trim().length >= 5 && form.fechaVence;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-blue-900">Nuevo término procesal</h3>
        <button onClick={onClose} className="text-blue-400 hover:text-blue-700"><X className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripción <span className="text-red-500">*</span></label>
          <input
            value={form.descripcion}
            onChange={(e) => set('descripcion', e.target.value)}
            placeholder="Ej: Presentar recurso de apelación"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de vencimiento <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={form.fechaVence}
            onChange={(e) => set('fechaVence', e.target.value)}
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

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Alerta (días antes)</label>
          <input
            type="number" min="1" max="30"
            value={form.diasAlerta}
            onChange={(e) => set('diasAlerta', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
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
          Guardar término
        </button>
      </div>
    </div>
  );
}

export default function TabTerminos({ casoId }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['terminos', casoId],
    queryFn: () => getTerminos(casoId),
  });

  const completar = useMutation({
    mutationFn: (id) => completarTermino(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['terminos', casoId] });
      qc.invalidateQueries({ queryKey: ['caso-stats', casoId] });
      toast.success('Término marcado como completado');
    },
    onError: () => toast.error('Error al completar el término'),
  });

  const terminos = data?.datos ?? data ?? [];

  if (isLoading) return <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>;

  const pendientes  = terminos.filter(t => t.estado !== 'COMPLETADO');
  const completados = terminos.filter(t => t.estado === 'COMPLETADO');

  return (
    <div className="max-w-3xl">
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo término
        </button>
      </div>

      {showForm && <FormTermino casoId={casoId} onClose={() => setShowForm(false)} />}

      {terminos.length === 0 && !showForm ? (
        <div className="text-center py-16 text-gray-400">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin términos procesales</p>
          <p className="text-sm mt-1">Agrega el primer término usando el botón de arriba</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendientes.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Pendientes ({pendientes.length})
              </h3>
              <div className="space-y-3">
                {pendientes.map((t) => {
                  const sem = semaforo(t.fechaVence, t.estado);
                  return (
                    <div key={t.id} className={`flex items-start gap-4 bg-white rounded-xl border p-4 ${sem.cls}`}>
                      <span className={`inline-block w-3 h-3 rounded-full shrink-0 mt-1.5 ${sem.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-800">{t.descripcion}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className={`text-xs font-semibold ${prioridadColor[t.prioridad]}`}>
                                {t.prioridad}
                              </span>
                              <span className="text-xs text-gray-500">
                                Vence: {format(parseISO(t.fechaVence), "d 'de' MMMM yyyy", { locale: es })}
                              </span>
                            </div>
                            {t.notas && <p className="text-xs text-gray-500 mt-1">{t.notas}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${sem.cls}`}>
                              {sem.label}
                            </span>
                            {t.estado !== 'VENCIDO' && (
                              <button
                                onClick={() => completar.mutate(t.id)}
                                disabled={completar.isPending}
                                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 border border-green-300 hover:bg-green-50 px-2 py-1 rounded-lg transition-colors"
                              >
                                <CheckCircle className="w-3 h-3" />
                                Completar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {completados.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Completados ({completados.length})
              </h3>
              <div className="space-y-2">
                {completados.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-100 px-4 py-3 opacity-70">
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    <p className="text-sm text-gray-600 line-through">{t.descripcion}</p>
                    {t.completadoEn && (
                      <span className="ml-auto text-xs text-gray-400 shrink-0">
                        {format(parseISO(t.completadoEn), "d MMM", { locale: es })}
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
