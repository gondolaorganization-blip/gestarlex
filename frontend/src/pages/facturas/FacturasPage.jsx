import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getFacturas, getAging, crearFactura, cambiarEstadoFactura } from '../../api/facturas';
import { getClientes } from '../../api/clientes';
import { getCasos } from '../../api/casos';
import { format, parseISO } from 'date-fns';
import { Receipt, Plus, X, ChevronDown, AlertTriangle, ExternalLink } from 'lucide-react';
import Spinner from '../../components/ui/Spinner';
import toast from 'react-hot-toast';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const ESTADO_META = {
  BORRADOR: { label: 'Borrador',  cls: 'bg-gray-100 text-gray-600' },
  ENVIADA:  { label: 'Enviada',   cls: 'bg-blue-100 text-blue-700' },
  PAGADA:   { label: 'Pagada',    cls: 'bg-green-100 text-green-700' },
  VENCIDA:  { label: 'Vencida',   cls: 'bg-red-100 text-red-700' },
  ANULADA:  { label: 'Anulada',   cls: 'bg-gray-100 text-gray-400 line-through' },
};

const TRANSICIONES = {
  BORRADOR: [{ estado: 'ENVIADA', label: 'Enviar',  cls: 'text-blue-600 hover:bg-blue-50' }],
  ENVIADA:  [{ estado: 'PAGADA',  label: 'Pagada',  cls: 'text-green-600 hover:bg-green-50' }],
  VENCIDA:  [{ estado: 'PAGADA',  label: 'Pagada',  cls: 'text-green-600 hover:bg-green-50' }],
};
const ANULAR = { estado: 'ANULADA', label: 'Anular', cls: 'text-red-500 hover:bg-red-50' };

const fmtMonto = (n) =>
  'B/. ' + Number(n).toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function FacturasPage() {
  const qc = useQueryClient();
  const [filtroEstado, setFiltroEstado] = useState('');
  const [pagina, setPagina] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showAging, setShowAging] = useState(false);
  const [confirmAnular, setConfirmAnular] = useState(null);

  const { data: resp, isLoading } = useQuery({
    queryKey: ['facturas', filtroEstado, pagina],
    queryFn: () => getFacturas({ estado: filtroEstado || undefined, pagina, porPagina: 20 }),
    placeholderData: (p) => p,
  });

  const { data: aging } = useQuery({
    queryKey: ['facturas-aging'],
    queryFn: getAging,
  });

  const facturas = resp?.datos ?? [];
  const paginacion = resp?.paginacion ?? {};
  const resumen = resp?.resumenPorEstado ?? {};

  const pendienteTotal =
    (resumen.BORRADOR?.total ?? 0) +
    (resumen.ENVIADA?.total ?? 0) +
    (resumen.VENCIDA?.total ?? 0);

  const mutEstado = useMutation({
    mutationFn: ({ id, estado }) => cambiarEstadoFactura(id, estado),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['facturas'] });
      qc.invalidateQueries({ queryKey: ['facturas-aging'] });
      toast.success('Estado actualizado');
      setConfirmAnular(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error'),
  });

  const statCards = [
    { label: 'Borradores', key: 'BORRADOR', color: 'text-gray-600' },
    { label: 'Enviadas',   key: 'ENVIADA',  color: 'text-blue-600' },
    { label: 'Pagadas',    key: 'PAGADA',   color: 'text-green-600' },
    { label: 'Vencidas',   key: 'VENCIDA',  color: 'text-red-600' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Receipt className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Facturación</h1>
                <p className="text-xs text-gray-500">Cuentas por cobrar · {fmtMonto(pendienteTotal)} pendiente</p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Nueva factura
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {statCards.map(({ label, key, color }) => (
              <button
                key={key}
                onClick={() => { setFiltroEstado(filtroEstado === key ? '' : key); setPagina(1); }}
                className={`p-3 rounded-xl text-center border-2 transition-all ${
                  filtroEstado === key ? 'border-indigo-400 bg-indigo-50' : 'border-transparent bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <p className={`text-xl font-bold ${color}`}>{resumen[key]?.count ?? 0}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                <p className={`text-xs font-medium ${color} mt-0.5`}>
                  {fmtMonto(resumen[key]?.total ?? 0)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        {/* Aging report */}
        {aging && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setShowAging((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-semibold text-gray-700">
                  Aging Report — Cuentas por cobrar
                </span>
                {aging.totales.total > 0 && (
                  <span className="text-sm font-bold text-orange-600">{fmtMonto(aging.totales.total)}</span>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showAging ? 'rotate-180' : ''}`} />
            </button>
            {showAging && (
              <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { key: 'corriente', label: 'Corriente', sub: 'No vencidas',    cls: 'bg-green-50 border-green-200 text-green-700' },
                    { key: '1-30',      label: '1–30 días', sub: 'Vencidas',        cls: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
                    { key: '31-60',     label: '31–60 días',sub: 'Vencidas',        cls: 'bg-orange-50 border-orange-200 text-orange-700' },
                    { key: '61-90',     label: '61–90 días',sub: 'Vencidas',        cls: 'bg-red-50 border-red-200 text-red-600' },
                    { key: 'mas90',     label: '+90 días',  sub: 'Vencidas',        cls: 'bg-red-100 border-red-300 text-red-700' },
                  ].map(({ key, label, sub, cls }) => (
                    <div key={key} className={`p-3 rounded-xl border text-center ${cls}`}>
                      <p className="text-base font-bold">{fmtMonto(aging.totales[key] ?? 0)}</p>
                      <p className="text-xs font-semibold mt-0.5">{label}</p>
                      <p className="text-[10px] opacity-70">{sub} · {aging.buckets[key]?.length ?? 0}</p>
                    </div>
                  ))}
                </div>
                {/* Facturas vencidas */}
                {(aging.buckets['1-30'].length + aging.buckets['31-60'].length + aging.buckets['61-90'].length + (aging.buckets['mas90']?.length ?? 0)) > 0 && (
                  <div className="mt-4 space-y-1.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Facturas vencidas</p>
                    {[...aging.buckets['1-30'], ...aging.buckets['31-60'], ...aging.buckets['61-90'], ...(aging.buckets['mas90'] ?? [])].slice(0, 8).map((f) => (
                      <div key={f.id} className="flex items-center justify-between px-3 py-2 bg-red-50 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs font-bold text-red-600">{f.numero}</span>
                          <Link to={`/clientes/${f.cliente.id}`} className="text-xs text-gray-600 truncate hover:underline">{f.cliente.nombre}</Link>
                        </div>
                        <span className="text-xs font-bold text-red-700 shrink-0 ml-2">{fmtMonto(f.monto)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Filter bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-wrap">
            <span className="text-xs font-medium text-gray-500 mr-1">Estado:</span>
            {['', 'BORRADOR', 'ENVIADA', 'PAGADA', 'VENCIDA', 'ANULADA'].map((e) => (
              <button
                key={e}
                onClick={() => { setFiltroEstado(e); setPagina(1); }}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  filtroEstado === e
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {e === '' ? 'Todas' : ESTADO_META[e]?.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : facturas.length === 0 ? (
            <div className="text-center py-16">
              <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Sin facturas {filtroEstado ? `con estado ${ESTADO_META[filtroEstado]?.label}` : ''}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Número</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Caso</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Vence</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {facturas.map((f) => {
                  const meta = ESTADO_META[f.estado] ?? ESTADO_META.BORRADOR;
                  const acciones = TRANSICIONES[f.estado] ?? [];
                  const puedeAnular = ['BORRADOR', 'ENVIADA', 'VENCIDA'].includes(f.estado);

                  return (
                    <tr key={f.id} className={`hover:bg-gray-50 transition-colors ${f.estado === 'ANULADA' ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-gray-700">{f.numero}</td>
                      <td className="px-4 py-3">
                        <Link to={`/clientes/${f.cliente.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
                          {f.cliente.nombre}
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {f.caso ? (
                          <Link to={`/casos/${f.caso.id}`} className="text-xs text-indigo-600 hover:underline font-mono">
                            {f.caso.numero}
                          </Link>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{fmtMonto(f.monto)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">
                        {format(parseISO(f.fecha), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {f.vence ? (
                          <span className={`text-xs ${new Date(f.vence) < new Date() && f.estado !== 'PAGADA' ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                            {format(parseISO(f.vence), 'dd/MM/yyyy')}
                          </span>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.cls}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 justify-end flex-wrap">
                          <Link
                            to={`/facturas/${f.id}`}
                            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors border border-indigo-200"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Ver
                          </Link>
                          {acciones.map((a) => (
                            <button
                              key={a.estado}
                              onClick={() => mutEstado.mutate({ id: f.id, estado: a.estado })}
                              disabled={mutEstado.isPending}
                              className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${a.cls} border-current`}
                            >
                              {a.label}
                            </button>
                          ))}
                          {puedeAnular && (
                            confirmAnular === f.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => mutEstado.mutate({ id: f.id, estado: ANULAR.estado })}
                                  disabled={mutEstado.isPending}
                                  className="text-xs font-medium px-2 py-1 bg-red-600 text-white rounded-lg"
                                >Sí, anular</button>
                                <button
                                  onClick={() => setConfirmAnular(null)}
                                  className="text-xs text-gray-400 hover:text-gray-600 px-1"
                                >✕</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmAnular(f.id)}
                                className="text-xs font-medium px-2.5 py-1 rounded-lg border border-current text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                Anular
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {paginacion.totalPaginas > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                {paginacion.total} facturas · Página {paginacion.pagina} de {paginacion.totalPaginas}
              </p>
              <div className="flex gap-1">
                <button disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Anterior</button>
                <button disabled={pagina >= paginacion.totalPaginas} onClick={() => setPagina((p) => p + 1)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Siguiente</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <NuevaFacturaModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            qc.invalidateQueries({ queryKey: ['facturas'] });
            qc.invalidateQueries({ queryKey: ['facturas-aging'] });
          }}
        />
      )}
    </div>
  );
}

// ─── MODAL NUEVA FACTURA ──────────────────────────────────────────────────────

function NuevaFacturaModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ clienteId: '', casoId: '', monto: '', vence: '', notas: '' });

  const { data: clientesResp } = useQuery({
    queryKey: ['clientes-select'],
    queryFn: () => getClientes({ porPagina: 200 }),
  });
  const clientes = clientesResp?.datos ?? [];

  const { data: casosResp } = useQuery({
    queryKey: ['casos-select-factura', form.clienteId],
    queryFn: () => getCasos({ clienteId: form.clienteId || undefined, estado: 'ACTIVO', porPagina: 100 }),
    enabled: !!form.clienteId,
  });
  const casos = casosResp?.datos ?? [];

  const mutation = useMutation({
    mutationFn: crearFactura,
    onSuccess: () => { toast.success('Factura creada'); onSuccess(); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error'),
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      clienteId: form.clienteId,
      monto: parseFloat(form.monto),
    };
    if (form.casoId) payload.casoId = form.casoId;
    if (form.vence) payload.vence = form.vence;
    if (form.notas) payload.notas = form.notas;
    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Nueva factura</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cliente <span className="text-red-500">*</span></label>
            <select required value={form.clienteId} onChange={(e) => { set('clienteId', e.target.value); set('casoId', ''); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Seleccionar cliente...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          {form.clienteId && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Caso (opcional)</label>
              <select value={form.casoId} onChange={(e) => set('casoId', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Sin caso vinculado</option>
                {casos.map((c) => <option key={c.id} value={c.id}>{c.numero} — {c.titulo}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Monto (B/.) <span className="text-red-500">*</span></label>
              <input required type="number" min="0" step="0.01" value={form.monto} onChange={(e) => set('monto', e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de vencimiento</label>
              <input type="date" value={form.vence} onChange={(e) => set('vence', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas / Desglose</label>
            <textarea rows={3} value={form.notas} onChange={(e) => set('notas', e.target.value)}
              placeholder="Descripción de los servicios, desglose de honorarios..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {mutation.isPending ? 'Creando...' : 'Crear factura'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
