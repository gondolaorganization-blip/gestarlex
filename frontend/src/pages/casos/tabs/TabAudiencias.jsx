import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAudiencias, crearAudiencia, actualizarAudiencia } from '../../../api/audiencias';
import Badge from '../../../components/ui/Badge';
import Spinner from '../../../components/ui/Spinner';
import { Gavel, Calendar, Plus, X, ChevronDown } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const TIPOS = ['inicial', 'pruebas', 'alegatos', 'sentencia', 'conciliación', 'apelación', 'otro'];
const ESTADOS = ['PENDIENTE', 'REALIZADA', 'SUSPENDIDA', 'CANCELADA'];

function FormAudiencia({ casoId, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    titulo: '', fecha: '', hora: '', juzgado: '', sala: '', tipo: '', notas: '',
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => crearAudiencia(casoId, form),
    onSuccess: () => {
      toast.success('Audiencia registrada');
      qc.invalidateQueries({ queryKey: ['audiencias', casoId] });
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar'),
  });

  const valido = form.titulo && form.fecha;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-blue-900">Nueva audiencia</h3>
        <button onClick={onClose} className="text-blue-400 hover:text-blue-700"><X className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Título <span className="text-red-500">*</span></label>
          <input
            value={form.titulo}
            onChange={(e) => set('titulo', e.target.value)}
            placeholder="Ej: Audiencia inicial — presentación de partes"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={form.fecha}
            onChange={(e) => set('fecha', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hora</label>
          <input
            type="time"
            value={form.hora}
            onChange={(e) => set('hora', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
          <select
            value={form.tipo}
            onChange={(e) => set('tipo', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccionar...</option>
            {TIPOS.map((t) => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Sala</label>
          <input
            value={form.sala}
            onChange={(e) => set('sala', e.target.value)}
            placeholder="Ej: Sala 3"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Juzgado</label>
          <input
            value={form.juzgado}
            onChange={(e) => set('juzgado', e.target.value)}
            placeholder="Ej: Juzgado Decimocuarto de Circuito Civil"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
          <textarea
            value={form.notas}
            onChange={(e) => set('notas', e.target.value)}
            rows={2}
            placeholder="Observaciones previas..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
          Guardar audiencia
        </button>
      </div>
    </div>
  );
}

function AudienciaCard({ a, casoId }) {
  const qc = useQueryClient();
  const [editandoEstado, setEditandoEstado] = useState(false);
  const [resultado, setResultado] = useState(a.resultado ?? '');

  const mutation = useMutation({
    mutationFn: (datos) => actualizarAudiencia(a.id, datos),
    onSuccess: () => {
      toast.success('Audiencia actualizada');
      qc.invalidateQueries({ queryKey: ['audiencias', casoId] });
      setEditandoEstado(false);
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const fecha = parseISO(a.fecha);
  const pasada = isPast(fecha) && a.estado === 'PENDIENTE';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${
            a.estado === 'REALIZADA' ? 'bg-green-50' :
            a.estado === 'CANCELADA' ? 'bg-red-50' :
            a.estado === 'SUSPENDIDA' ? 'bg-yellow-50' : 'bg-blue-50'
          }`}>
            <Gavel className={`w-5 h-5 ${
              a.estado === 'REALIZADA' ? 'text-green-600' :
              a.estado === 'CANCELADA' ? 'text-red-500' :
              a.estado === 'SUSPENDIDA' ? 'text-yellow-600' : 'text-blue-600'
            }`} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800">{a.titulo}</p>
            {a.tipo && <p className="text-xs text-gray-500 mt-0.5 capitalize">{a.tipo}</p>}
            {a.juzgado && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {a.juzgado}{a.sala ? ` · Sala ${a.sala}` : ''}
              </p>
            )}
            {a.notas && <p className="text-xs text-gray-500 mt-1 italic">{a.notas}</p>}
            {a.resultado && (
              <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded p-2">
                <span className="font-medium">Resultado:</span> {a.resultado}
              </p>
            )}

            {editandoEstado && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  {ESTADOS.map((e) => (
                    <button
                      key={e}
                      onClick={() => mutation.mutate({ estado: e, resultado })}
                      disabled={mutation.isPending}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                        a.estado === e
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-600'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <textarea
                  value={resultado}
                  onChange={(e) => setResultado(e.target.value)}
                  rows={2}
                  placeholder="Resultado de la audiencia (opcional)..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <button
                  onClick={() => setEditandoEstado(false)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-gray-800">
            {format(fecha, "d MMM yyyy", { locale: es })}
          </p>
          {a.hora && <p className="text-xs text-gray-500">{a.hora}</p>}
          <div className="mt-1"><Badge value={a.estado} /></div>
          {pasada && <p className="text-xs text-orange-500 mt-1">Sin actualizar</p>}
          {!editandoEstado && (
            <button
              onClick={() => setEditandoEstado(true)}
              className="mt-2 text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 ml-auto"
            >
              Actualizar <ChevronDown className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TabAudiencias({ casoId }) {
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['audiencias', casoId],
    queryFn: () => getAudiencias(casoId),
  });

  const audiencias = data?.datos ?? data ?? [];

  if (isLoading) return <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-3xl">
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva audiencia
        </button>
      </div>

      {showForm && <FormAudiencia casoId={casoId} onClose={() => setShowForm(false)} />}

      {audiencias.length === 0 && !showForm ? (
        <div className="text-center py-16 text-gray-400">
          <Gavel className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin audiencias registradas</p>
          <p className="text-sm mt-1">Agrega la primera audiencia usando el botón de arriba</p>
        </div>
      ) : (
        <div className="space-y-3">
          {audiencias.map((a) => <AudienciaCard key={a.id} a={a} casoId={casoId} />)}
        </div>
      )}
    </div>
  );
}
