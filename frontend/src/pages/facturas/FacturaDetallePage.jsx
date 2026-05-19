import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getFactura } from '../../api/facturas';
import Spinner from '../../components/ui/Spinner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Printer } from 'lucide-react';

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
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Printer className="w-4 h-4" />
          Imprimir / Guardar PDF
        </button>
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
              <tr className="bg-indigo-600 rounded-lg">
                <td className="pt-3 pb-3 pl-4 rounded-l-xl">
                  <span className="text-sm font-bold text-white">TOTAL A PAGAR</span>
                </td>
                <td className="pt-3 pb-3 pr-4 text-right rounded-r-xl">
                  <span className="text-lg font-bold text-white">{fmtMonto(factura.monto)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pie de página */}
        <div className="px-10 py-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl print:rounded-none">
          <p className="text-xs text-gray-500 text-center">
            Esta factura fue emitida por {firma.nombre ?? 'la firma'} conforme a las leyes de la República de Panamá.
          </p>
          {factura.estado === 'PAGADA' && (
            <p className="text-center mt-2 text-sm font-bold text-green-600">CANCELADA</p>
          )}
        </div>
      </div>

      {/* Margen inferior para impresión */}
      <div className="h-8 print:hidden" />
    </div>
  );
}
