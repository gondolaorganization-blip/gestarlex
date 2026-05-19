import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGastosCaso, crearGasto, marcarReembolsadoGasto, eliminarGasto } from '../../../api/gastos';
import { useAuth } from '../../../contexts/AuthContext';
import Spinner from '../../../components/ui/Spinner';
import toast from 'react-hot-toast';
import { DollarSign, Plus, Check, Trash2, X, Receipt } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TIPOS = ['TASA_JUDICIAL', 'NOTARIA', 'TRANSPORTE', 'REGISTRO', 'OTRO'];

const TIPO_META = {
  TASA_JUDICIAL: { label: 'Tasa Judicial', cls: 'bg-orange-100 text-orange-700' },
  NOTARIA:       { label: 'Notaría',       cls: 'bg-indigo-100 text-indigo-700' },
  TRANSPORTE:    { label: 'Transporte',    cls: 'bg-blue-100 text-blue-700' },
  REGISTRO:      { label: 'Registro',      cls: 'bg-purple-100 text-purple-700' },
  OTRO:          { label: 'Otro',          cls: 'bg-gray-100 text-gray-600' },
};

const fmtMonto = (n) =>
  `B/. ${Number(n || 0).toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const todayStr = () => new Date().toISOString().split('T')[0];

const FORM_INIT = { descripcion: '', monto: '', tipo: 'OTRO', fecha: todayStr(), reembolsable: false };

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function TabGastos({ casoId }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const puedeCrear    = user?.rol !== 'PASANTE';
  const puedeEliminar = ['ADMIN', 'SOCIO'].includes(user?.rol);
  const puedeReemb    = ['ADMIN', 'SOCIO'].includes(user?.rol);

  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState(FORM_INIT);
  const [confirmDel, setConfirmDel] = useState(null);

  // ── queries ──────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ['gastos', casoId],
    queryFn: () => getGastosCaso(casoId),
  });

  const gastos  = data?.gastos  ?? [];
  const totales = data?.totales ?? { total: 0, pendienteReembolso: 0 };

  // ── mutations ─────────────────────────────────────────────────────────────

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['gastos', casoId] });
    qc.invalidateQueries({ queryKey: ['caso-stats', casoId] });
  };

  const crear = useMutation({
    mutationFn: () => crearGasto(casoId, { ...form, monto: parseFloat(form.monto) }),
    onSuccess: () => {
      toast.success('Gasto registrado');
      invalidate();
      setForm(FORM_INIT);
      setShowForm(false);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al registrar el gasto'),
  });

  const reembolsar = useMutation({
    mutationFn: marcarReembolsadoGasto,
    onSuccess: () => { toast.success('Marcado como reembolsado'); invalidate(); },
    onError: () => toast.error('Error al actualizar'),
  });

  const eliminar = useMutation({
    mutationFn: eliminarGasto,
    onSuccess: () => { toast.success('Gasto eliminado'); setConfirmDel(null); invalidate(); },
    onError: () => toast.error('Error al eliminar'),
  });

  // ── derived ───────────────────────────────────────────────────────────────

  const canSubmit = form.descripcion.trim().length >= 3 && parseFloat(form.monto) > 0 && !crear.isPending;

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // ── render ────────────────────────────────────────────────────────────────

  if (isLoading) return <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-5 max-w-3xl">

      {/* ── Header row ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xl font-bold text-gray-900">{fmtMonto(totales.total)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total gastos</p>
          </div>
          {totales.pendienteReembolso > 0 && (
            <div className="bg-orange-50 rounded-xl border border-orange-200 px-4 py-3">
              <p className="text-xl font-bold text-orange-700">{fmtMonto(totales.pendienteReembolso)}</p>
              <p className="text-xs text-orange-500 mt-0.5">Pendiente reembolso</p>
            </div>
          )}
        </div>

        {puedeCrear && (
          <button
            onClick={() => { setShowForm((v) => !v); setForm(FORM_INIT); }}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancelar' : 'Nuevo gasto'}
          </button>
        )}
      </div>

      {/* ── Form ────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-white rounded-xl border-2 border-indigo-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-600" /> Registrar gasto
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Descripción <span className="text-red-500">*</span>
              </label>
              <input
                value={form.descripcion}
                onChange={set('descripcion')}
                placeholder="Ej: Tasa de radicación expediente"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Monto (B/.) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.monto}
                onChange={set('monto')}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={set('fecha')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-2">Tipo</label>
              <div className="flex flex-wrap gap-2">
                {TIPOS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, tipo: t }))}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      form.tipo === t
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {TIPO_META[t].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm((f) => ({ ...f, reembolsable: !f.reembolsable }))}
                  className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${form.reembolsable ? 'bg-indigo-600' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.reembolsable ? 'translate-x-5' : ''}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Reembolsable</p>
                  <p className="text-xs text-gray-400">El cliente debe reembolsar este gasto</p>
                </div>
              </label>
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

      {/* ── List ────────────────────────────────────────────────────── */}
      {gastos.length === 0 ? (
        <div className="text-center py-14 text-gray-400">
          <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin gastos registrados</p>
          <p className="text-sm mt-1">Los gastos del caso afectan el cálculo de rentabilidad</p>
        </div>
      ) : (
        <div className="space-y-2">
          {gastos.map((g) => (
            <div
              key={g.id}
              className={`bg-white rounded-xl border px-4 py-3 flex items-center gap-3 ${
                g.reembolsado ? 'border-gray-100 opacity-60' : 'border-gray-200'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIPO_META[g.tipo]?.cls ?? TIPO_META.OTRO.cls}`}>
                    {TIPO_META[g.tipo]?.label ?? g.tipo}
                  </span>
                  {g.reembolsable && !g.reembolsado && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                      Reembolsable
                    </span>
                  )}
                  {g.reembolsado && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Reembolsado
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-800 mt-1 truncate">{g.descripcion}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {format(parseISO(g.fecha), "d 'de' MMMM yyyy", { locale: es })}
                </p>
              </div>

              <p className="text-base font-bold text-gray-900 shrink-0">{fmtMonto(g.monto)}</p>

              <div className="flex items-center gap-1 shrink-0">
                {puedeReemb && g.reembolsable && !g.reembolsado && (
                  <button
                    onClick={() => reembolsar.mutate(g.id)}
                    disabled={reembolsar.isPending}
                    title="Marcar como reembolsado"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}

                {puedeEliminar && (
                  confirmDel === g.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => eliminar.mutate(g.id)}
                        disabled={eliminar.isPending}
                        className="text-xs px-2 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setConfirmDel(null)}
                        className="text-xs px-2 py-1 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDel(g.id)}
                      title="Eliminar gasto"
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
