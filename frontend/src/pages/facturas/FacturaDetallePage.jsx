import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFactura, actualizarFactura } from '../../api/facturas';
import { getClientes } from '../../api/clientes';
import Spinner from '../../components/ui/Spinner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Printer, Pencil, X, Trash2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

const fmtMonto = (n) =>
  'B/. ' + Number(n).toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ESTADO_META = {
  BORRADOR:  { label: 'Borrador',  cls: 'text-gray-600 bg-gray-100' },
  ENVIADA:   { label: 'Enviada',   cls: 'text-blue-700 bg-blue-100' },
  PAGADA:    { label: 'Pagada',    cls: 'text-green-700 bg-green-100' },
  VENCIDA:   { label: 'Vencida',  cls: 'text-red-700 bg-red-100' },
  ANULADA:   { label: 'Anulada',   cls: 'text-gray-400 bg-gray-100' },
};

export default function FacturaDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);

  const { data: factura, isLoading, isError } = useQuery({
    queryKey: ['factura', id],
    queryFn: () => getFactura(id),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !factura) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400">
        <div className="text-center">
          <p className="font-medium">Factura no encontrada</p>
          <button onClick={() => navigate('/facturas')} className="mt-3 text-sm text-indigo-600 hover:underline">
            Volver a facturas
          </button>
        </div>
      </div>
    );
  }

  const estadoMeta = ESTADO_META[factura.estado] ?? ESTADO_META.BORRADOR;
  const firma = factura.firma ?? {};
  const cliente = factura.cliente ?? {};
  const caso = factura.caso ?? null;

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">

      {/* Barra de acciones — oculta al imprimir */}
      <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate('/facturas')}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a facturas
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      {/* Documento de factura */}
      <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-2xl print:shadow-none print:rounded-none print:max-w-none">

        {/* Cabecera */}
        <div className="flex items-start justify-between p-10 pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{firma.nombre ?? 'Firma de Abogados'}</h1>
            {firma.ruc && <p className="text-sm text-gray-500 mt-1">RUC: {firma.ruc}</p>}
            {firma.direccion && <p className="text-sm text-gray-500">{firma.direccion}</p>}
            {firma.telefono && <p className="text-sm text-gray-500">Tel: {firma.telefono}</p>}
            {firma.email && <p className="text-sm text-gray-500">{firma.email}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Factura</p>
            <p className="text-3xl font-bold text-indigo-700 mt-1">{factura.numero}</p>
            <span className={`inline-block mt-2 text-xs font-semibold px-3 py-1 rounded-full ${estadoMeta.cls}`}>
              {estadoMeta.label}
            </span>
          </div>
        </div>

        {/* Fechas + Cliente */}
        <div className="grid grid-cols-2 gap-8 p-10 py-6 border-b border-gray-100">
          {/* Fechas */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Fecha de emisión</span>
              <span className="font-medium text-gray-800">
                {format(parseISO(factura.fecha), "d 'de' MMMM yyyy", { locale: es })}
              </span>
            </div>
            {factura.vence && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Fecha de vencimiento</span>
                <span className={`font-medium ${
                  factura.estado === 'VENCIDA' ? 'text-red-600' : 'text-gray-800'
                }`}>
                  {format(parseISO(factura.vence), "d 'de' MMMM yyyy", { locale: es })}
                </span>
              </div>
            )}
          </div>

          {/* Cliente */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Facturar a</p>
            <p className="font-bold text-gray-900">{cliente.nombre}</p>
            {cliente.ruc && <p className="text-sm text-gray-500">RUC: {cliente.ruc}</p>}
            {cliente.cedula && <p className="text-sm text-gray-500">Cédula: {cliente.cedula}</p>}
            {cliente.email && <p className="text-sm text-gray-500">{cliente.email}</p>}

            {/* Co-destinatarios */}
            {Array.isArray(factura.destinatariosAdicionales) && factura.destinatariosAdicionales.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                {factura.destinatariosAdicionales.map((d, i) => (
                  <div key={i}>
                    <p className="font-semibold text-gray-900 text-sm">{d.nombre}</p>
                    {d.documento && (
                      <p className="text-sm text-gray-500">{d.tipoDoc || 'Documento'}: {d.documento}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Caso vinculado (si aplica) */}
        {caso && (
          <div className="px-10 py-4 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Expediente vinculado</p>
            <p className="text-sm font-medium text-gray-800">
              <span className="font-mono text-indigo-600">{caso.numero}</span> — {caso.titulo}
            </p>
            {caso.abogado && (
              <p className="text-xs text-gray-500 mt-0.5">
                Abogado responsable: {caso.abogado.nombre}
                {caso.abogado.numeroIdoneidad ? ` · Idoneidad N° ${caso.abogado.numeroIdoneidad}` : ''}
              </p>
            )}
          </div>
        )}

        {/* Tabla de servicios */}
        <div className="px-10 py-6">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Descripción de servicios
                </th>
                <th className="text-right pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">
                  Monto
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-4 pr-6 align-top">
                  <p className="text-sm font-medium text-gray-800">
                    Servicios legales profesionales
                  </p>
                  {factura.notas && (
                    <div className="mt-2 text-sm text-gray-500 whitespace-pre-line leading-relaxed">
                      {factura.notas}
                    </div>
                  )}
                </td>
                <td className="py-4 text-right align-top">
                  <p className="text-sm font-bold text-gray-900">{fmtMonto(factura.monto)}</p>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td className="pt-4 text-right pr-6 text-sm font-semibold text-gray-700">Subtotal</td>
                <td className="pt-4 text-right text-sm font-bold text-gray-800">{fmtMonto(factura.monto)}</td>
              </tr>
              <tr>
                <td className="pt-1 text-right pr-6 text-xs text-gray-400">ITBMS (0%)</td>
                <td className="pt-1 text-right text-xs text-gray-400">B/. 0.00</td>
              </tr>
              <tr className={`rounded-lg ${
                factura.estado === 'PAGADA'  ? 'bg-green-600' :
                factura.estado === 'ANULADA' ? 'bg-gray-400'  :
                factura.estado === 'VENCIDA' ? 'bg-red-600'   : 'bg-indigo-600'
              }`}>
                <td className="pt-3 pb-3 pl-4 rounded-l-xl">
                  <span className="text-sm font-bold text-white">
                    {factura.estado === 'PAGADA'  ? 'PAGADA' :
                     factura.estado === 'ANULADA' ? 'ANULADA' :
                     factura.estado === 'VENCIDA' ? 'VENCIDA — TOTAL A PAGAR' : 'TOTAL A PAGAR'}
                  </span>
                </td>
                <td className="pt-3 pb-3 pr-4 text-right rounded-r-xl">
                  <span className="text-lg font-bold text-white">{fmtMonto(factura.monto)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Firma */}
        <div className="px-10 pt-8 pb-6">
          <div className="flex justify-end">
            <div className="text-center w-56">
              <div className="border-t border-gray-400 pt-2">
                <p className="text-sm font-semibold text-gray-800">José Manuel Góndola Escudero</p>
                <p className="text-xs text-gray-500">Cédula 8-822-1560</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pie de página */}
        <div className="px-10 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl print:rounded-none">
          <p className="text-xs text-gray-500 text-center">
            Esta factura fue emitida por {firma.nombre ?? 'la firma'} conforme a las leyes de la República de Panamá.
          </p>
        </div>
      </div>

      {showEdit && (
        <EditarFacturaModal
          factura={factura}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            qc.setQueryData(['factura', id], updated);
            setShowEdit(false);
            toast.success('Factura actualizada');
          }}
        />
      )}

      {/* Margen inferior para impresión */}
      <div className="h-8 print:hidden" />
    </div>
  );
}

function EditarFacturaModal({ factura, onClose, onSaved }) {
  const [form, setForm] = useState({
    clienteId: factura.cliente?.id || '',
    monto: String(factura.monto),
    vence: factura.vence ? factura.vence.slice(0, 10) : '',
    notas: factura.notas || '',
  });

  const { data: clientesResp } = useQuery({
    queryKey: ['clientes-select'],
    queryFn: () => getClientes({ porPagina: 200 }),
  });
  const clientes = clientesResp?.datos ?? [];
  const [destinatarios, setDestinatarios] = useState(
    Array.isArray(factura.destinatariosAdicionales) ? factura.destinatariosAdicionales : []
  );
  const [nuevoDestinatario, setNuevoDestinatario] = useState({ nombre: '', documento: '', tipoDoc: 'Cédula' });

  const mutation = useMutation({
    mutationFn: (data) => actualizarFactura(factura.id, data),
    onSuccess: onSaved,
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar'),
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate({
      clienteId: form.clienteId,
      monto: parseFloat(form.monto),
      vence: form.vence || null,
      notas: form.notas || null,
      destinatariosAdicionales: destinatarios.length ? destinatarios : null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 print:hidden">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Editar factura {factura.numero}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cliente <span className="text-red-500">*</span></label>
            <select
              required value={form.clienteId} onChange={(e) => set('clienteId', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Seleccionar cliente...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Monto (B/.) <span className="text-red-500">*</span></label>
              <input
                required type="number" min="0" step="0.01"
                value={form.monto} onChange={(e) => set('monto', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de vencimiento</label>
              <input
                type="date" value={form.vence} onChange={(e) => set('vence', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas / Desglose</label>
            <textarea
              rows={4} value={form.notas} onChange={(e) => set('notas', e.target.value)}
              placeholder="Descripción de los servicios..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Co-destinatarios */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" /> Co-destinatarios
            </p>
            {destinatarios.length > 0 && (
              <div className="space-y-1.5">
                {destinatarios.map((d, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs">
                    <span className="font-medium text-gray-800">{d.nombre}</span>
                    <div className="flex items-center gap-2 text-gray-500">
                      <span>{d.tipoDoc}: {d.documento}</span>
                      <button type="button" onClick={() => setDestinatarios((p) => p.filter((_, j) => j !== i))}>
                        <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Nombre</label>
                <input type="text" value={nuevoDestinatario.nombre}
                  onChange={(e) => setNuevoDestinatario((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="Nombre completo"
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">N.º documento</label>
                <input type="text" value={nuevoDestinatario.documento}
                  onChange={(e) => setNuevoDestinatario((p) => ({ ...p, documento: e.target.value }))}
                  placeholder="8-123-4567"
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Tipo</label>
                <select value={nuevoDestinatario.tipoDoc}
                  onChange={(e) => setNuevoDestinatario((p) => ({ ...p, tipoDoc: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option>Cédula</option>
                  <option>Pasaporte</option>
                  <option>RUC</option>
                </select>
              </div>
              <button type="button"
                onClick={() => {
                  if (!nuevoDestinatario.nombre.trim()) return;
                  setDestinatarios((p) => [...p, { ...nuevoDestinatario }]);
                  setNuevoDestinatario({ nombre: '', documento: '', tipoDoc: 'Cédula' });
                }}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 whitespace-nowrap"
              >
                + Agregar
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {mutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
