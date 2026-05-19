import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2, TrendingUp, Users, FolderOpen, Clock,
  Download, AlertCircle, Scale,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getProductividad, getRentabilidadCasos, getRentabilidadClientes,
  getIngresosTipo, getEstadisticasCasos, getAgingReporte,
  descargarPdfProductividad, descargarPdfRentabilidadCasos, descargarPdfAging,
} from '../../api/reportes';
import Spinner from '../../components/ui/Spinner';
import toast from 'react-hot-toast';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const ROL_META = {
  ADMIN:    { label: 'Admin',    cls: 'bg-purple-100 text-purple-700' },
  SOCIO:    { label: 'Socio',    cls: 'bg-indigo-100 text-indigo-700' },
  ASOCIADO: { label: 'Asociado', cls: 'bg-blue-100 text-blue-700' },
  PASANTE:  { label: 'Pasante',  cls: 'bg-gray-100 text-gray-600' },
};

const TIPO_LABELS = {
  CIVIL: 'Civil', PENAL: 'Penal', LABORAL: 'Laboral', COMERCIAL: 'Comercial',
  ADMINISTRATIVO: 'Administrativo', FAMILIAR: 'Familiar', MARITIMO: 'Marítimo', OTRO: 'Otro',
};

const TIPO_COLORS = {
  CIVIL: 'bg-blue-500', PENAL: 'bg-red-500', LABORAL: 'bg-green-500',
  COMERCIAL: 'bg-orange-500', ADMINISTRATIVO: 'bg-purple-500',
  FAMILIAR: 'bg-pink-500', MARITIMO: 'bg-cyan-500', OTRO: 'bg-gray-400',
};

const AGING_BUCKETS = [
  { key: 'corriente', label: 'Corriente',  cardCls: 'bg-green-50 border-green-200 text-green-700',  pillCls: 'bg-green-100 text-green-700 border-green-200' },
  { key: '1-30',      label: '1-30 días',  cardCls: 'bg-yellow-50 border-yellow-200 text-yellow-700', pillCls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { key: '31-60',     label: '31-60 días', cardCls: 'bg-orange-50 border-orange-200 text-orange-700', pillCls: 'bg-orange-100 text-orange-700 border-orange-200' },
  { key: '61-90',     label: '61-90 días', cardCls: 'bg-red-50 border-red-200 text-red-700',          pillCls: 'bg-red-100 text-red-700 border-red-200' },
  { key: 'mas90',     label: '+90 días',   cardCls: 'bg-red-100 border-red-300 text-red-800',         pillCls: 'bg-red-200 text-red-800 border-red-300' },
];

const TABS = [
  { id: 'productividad', label: 'Productividad',     icon: Users },
  { id: 'casos',         label: 'Rent. Casos',        icon: FolderOpen },
  { id: 'clientes',      label: 'Rent. Clientes',     icon: Scale },
  { id: 'tipos',         label: 'Por Tipo',           icon: BarChart2 },
  { id: 'estadisticas',  label: 'Estadísticas',       icon: TrendingUp },
  { id: 'aging',         label: 'Aging',              icon: Clock },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const fmtMonto = (n) =>
  `B/. ${Number(n || 0).toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function agingBucketKey(vence) {
  const hoy = new Date();
  if (!vence || new Date(vence) > hoy) return 'corriente';
  const dias = Math.ceil((hoy - new Date(vence)) / 86400000);
  if (dias <= 30) return '1-30';
  if (dias <= 60) return '31-60';
  if (dias <= 90) return '61-90';
  return 'mas90';
}

async function downloadPdf(apiFn, params, filename) {
  const resp = await apiFn(params);
  const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color = 'indigo' }) {
  const CLS = {
    indigo: 'bg-indigo-50 text-indigo-700',
    green:  'bg-green-50 text-green-700',
    blue:   'bg-blue-50 text-blue-700',
    orange: 'bg-orange-50 text-orange-700',
    red:    'bg-red-50 text-red-700',
    gray:   'bg-gray-50 text-gray-700',
  };
  return (
    <div className={`p-4 rounded-xl ${CLS[color] ?? CLS.indigo}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-70">{label}</p>
    </div>
  );
}

function EficienciaBar({ pct }) {
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs font-medium w-8 text-right">{pct}%</span>
    </div>
  );
}

function PdfButton({ onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-700 border border-indigo-300 rounded-lg hover:bg-indigo-50 disabled:opacity-50 transition-colors"
    >
      {loading ? <Spinner size="sm" /> : <Download className="w-4 h-4" />}
      PDF
    </button>
  );
}

function TableLoading() {
  return <div className="flex justify-center py-16"><Spinner /></div>;
}

function TableError() {
  return (
    <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
      <AlertCircle className="w-4 h-4 shrink-0" />
      Error al cargar el reporte
    </div>
  );
}

function THead({ cols }) {
  return (
    <thead>
      <tr className="bg-gray-50 border-b border-gray-100">
        {cols.map((c, i) => (
          <th
            key={i}
            className={`px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide ${c.right ? 'text-right' : 'text-left'}`}
          >
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function EmptyRow({ cols, msg = 'Sin datos para el período seleccionado' }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-8 text-center text-gray-400">{msg}</td>
    </tr>
  );
}

// ─── TAB: PRODUCTIVIDAD ───────────────────────────────────────────────────────

function ProductividadTab({ desde, hasta, onPdf, pdfLoading }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reporte-productividad', desde, hasta],
    queryFn: () => getProductividad({ desde, hasta }),
  });

  if (isLoading) return <TableLoading />;
  if (error) return <TableError />;

  const { datos = [], totales = {} } = data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">{data.titulo}</h2>
        <PdfButton onClick={onPdf} loading={pdfLoading} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Horas Totales"      value={`${Number(totales.horasTotales || 0).toFixed(1)} h`}      color="indigo" />
        <StatCard label="Horas Facturables"  value={`${Number(totales.horasFacturables || 0).toFixed(1)} h`}  color="green" />
        <StatCard label="Casos Cerrados"     value={totales.casosCerrados ?? 0}                                color="blue" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <THead cols={[
              { label: 'Abogado' },
              { label: 'Rol' },
              { label: 'H. Total',      right: true },
              { label: 'H. Facturable', right: true },
              { label: 'Eficiencia',    right: true },
              { label: 'Activos',       right: true },
              { label: 'Cerrados',      right: true },
              { label: 'Tareas',        right: true },
              { label: 'Audiencias',    right: true },
            ]} />
            <tbody className="divide-y divide-gray-50">
              {datos.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{a.nombre}</p>
                    {a.numeroIdoneidad && <p className="text-xs text-gray-400">Idon. {a.numeroIdoneidad}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROL_META[a.rol]?.cls ?? 'bg-gray-100 text-gray-600'}`}>
                      {ROL_META[a.rol]?.label ?? a.rol}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{a.horas.total.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{a.horas.facturables.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right"><EficienciaBar pct={a.horas.eficiencia} /></td>
                  <td className="px-4 py-3 text-right text-gray-700">{a.casos.activos}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{a.casos.cerrados}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{a.tareas.completadas}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{a.audiencias.realizadas}</td>
                </tr>
              ))}
              {datos.length === 0 && <EmptyRow cols={9} />}
            </tbody>
            {datos.length > 0 && (
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Totales</td>
                  <td className="px-4 py-3 text-right font-bold font-mono text-gray-800">{Number(totales.horasTotales || 0).toFixed(1)}</td>
                  <td className="px-4 py-3 text-right font-bold font-mono text-gray-800">{Number(totales.horasFacturables || 0).toFixed(1)}</td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: RENTABILIDAD CASOS ──────────────────────────────────────────────────

function RentabilidadCasosTab({ desde, hasta, onPdf, pdfLoading }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reporte-rent-casos', desde, hasta],
    queryFn: () => getRentabilidadCasos({ desde, hasta }),
  });

  if (isLoading) return <TableLoading />;
  if (error) return <TableError />;

  const { datos = [], totales = {} } = data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">{data.titulo}</h2>
        <PdfButton onClick={onPdf} loading={pdfLoading} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Facturado"        value={fmtMonto(totales.facturado)} color="indigo" />
        <StatCard label="Cobrado"          value={fmtMonto(totales.cobrado)}   color="green" />
        <StatCard label="Margen"           value={fmtMonto(totales.margen)}    color={totales.margen >= 0 ? 'blue' : 'red'} />
        <StatCard label="Horas Trabajadas" value={`${Number(totales.horas || 0).toFixed(1)} h`} color="gray" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <THead cols={[
              { label: 'Caso' },
              { label: 'Cliente' },
              { label: 'Abogado' },
              { label: 'Horas',     right: true },
              { label: 'Facturado', right: true },
              { label: 'Cobrado',   right: true },
              { label: 'Pendiente', right: true },
              { label: 'Margen',    right: true },
              { label: 'Rent.',     right: true },
            ]} />
            <tbody className="divide-y divide-gray-50">
              {datos.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-xs font-bold text-indigo-700 font-mono">{c.numero}</p>
                    <p className="text-sm text-gray-800 truncate max-w-[180px]">{c.titulo}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700 truncate max-w-[120px]">{c.cliente}</td>
                  <td className="px-4 py-3 text-gray-700 truncate max-w-[120px]">{c.abogado}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{Number(c.horas).toFixed(1)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{fmtMonto(c.facturado)}</td>
                  <td className="px-4 py-3 text-right font-mono text-green-700">{fmtMonto(c.cobrado)}</td>
                  <td className="px-4 py-3 text-right font-mono text-orange-600">{fmtMonto(c.pendiente)}</td>
                  <td className={`px-4 py-3 text-right font-mono ${c.margen >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmtMonto(c.margen)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.rentabilidad >= 50 ? 'bg-green-100 text-green-700' : c.rentabilidad >= 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                      {c.rentabilidad}%
                    </span>
                  </td>
                </tr>
              ))}
              {datos.length === 0 && <EmptyRow cols={9} />}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: RENTABILIDAD CLIENTES ───────────────────────────────────────────────

function RentabilidadClientesTab({ desde, hasta }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reporte-rent-clientes', desde, hasta],
    queryFn: () => getRentabilidadClientes({ desde, hasta }),
  });

  if (isLoading) return <TableLoading />;
  if (error) return <TableError />;

  const { datos = [], totales = {} } = data;

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold text-gray-700">{data.titulo}</h2>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Facturado" value={fmtMonto(totales.facturado)} color="indigo" />
        <StatCard label="Cobrado"   value={fmtMonto(totales.cobrado)}   color="green" />
        <StatCard label="Pendiente" value={fmtMonto(totales.pendiente)} color="orange" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <THead cols={[
              { label: 'Cliente' },
              { label: 'Tipo' },
              { label: 'Casos',     right: true },
              { label: 'Activos',   right: true },
              { label: 'Facturado', right: true },
              { label: 'Cobrado',   right: true },
              { label: 'Pendiente', right: true },
              { label: 'Horas',     right: true },
            ]} />
            <tbody className="divide-y divide-gray-50">
              {datos.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 truncate max-w-[200px]">{c.nombre}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.tipo === 'PERSONA_NATURAL' ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {c.tipo === 'PERSONA_NATURAL' ? 'Natural' : 'Jurídica'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{c.totalCasos}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{c.casosActivos}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{fmtMonto(c.facturado)}</td>
                  <td className="px-4 py-3 text-right font-mono text-green-700">{fmtMonto(c.cobrado)}</td>
                  <td className="px-4 py-3 text-right font-mono text-orange-600">{fmtMonto(c.pendiente)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{Number(c.horas).toFixed(1)}</td>
                </tr>
              ))}
              {datos.length === 0 && <EmptyRow cols={8} />}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: INGRESOS POR TIPO ───────────────────────────────────────────────────

function IngresosTipoTab({ desde, hasta }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reporte-ingresos-tipo', desde, hasta],
    queryFn: () => getIngresosTipo({ desde, hasta }),
  });

  if (isLoading) return <TableLoading />;
  if (error) return <TableError />;

  const { datos = [], totales = {} } = data;

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold text-gray-700">{data.titulo}</h2>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Casos" value={totales.casos ?? 0}          color="indigo" />
        <StatCard label="Facturado"   value={fmtMonto(totales.facturado)} color="green" />
        <StatCard label="Cobrado"     value={fmtMonto(totales.cobrado)}   color="blue" />
      </div>

      {datos.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Distribución por facturación</h3>
          <div className="space-y-3">
            {datos.map((t) => (
              <div key={t.tipo} className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-600 w-28 shrink-0">{TIPO_LABELS[t.tipo] ?? t.tipo}</span>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${TIPO_COLORS[t.tipo] ?? 'bg-gray-400'}`}
                    style={{ width: `${t.porcentaje}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-gray-700 w-10 text-right">{t.porcentaje}%</span>
                <span className="text-xs text-gray-500 w-28 text-right font-mono">{fmtMonto(t.facturado)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <THead cols={[
              { label: 'Tipo' },
              { label: 'Casos',     right: true },
              { label: 'Horas',     right: true },
              { label: 'Facturado', right: true },
              { label: 'Cobrado',   right: true },
              { label: '% Total',   right: true },
            ]} />
            <tbody className="divide-y divide-gray-50">
              {datos.map((t) => (
                <tr key={t.tipo} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${TIPO_COLORS[t.tipo] ?? 'bg-gray-400'}`} />
                      <span className="font-medium text-gray-800">{TIPO_LABELS[t.tipo] ?? t.tipo}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{t.casos}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{Number(t.horas).toFixed(1)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{fmtMonto(t.facturado)}</td>
                  <td className="px-4 py-3 text-right font-mono text-green-700">{fmtMonto(t.cobrado)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{t.porcentaje}%</span>
                  </td>
                </tr>
              ))}
              {datos.length === 0 && <EmptyRow cols={6} />}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: ESTADÍSTICAS CASOS ──────────────────────────────────────────────────

function EstadisticasCasosTab({ desde, hasta }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reporte-estadisticas', desde, hasta],
    queryFn: () => getEstadisticasCasos({ desde, hasta }),
  });

  if (isLoading) return <TableLoading />;
  if (error) return <TableError />;

  const { datos = {} } = data;
  const { porEstado = {}, porTipo = [], abiertosEnPeriodo, cerradosEnPeriodo, duracionPromedioDias } = datos;
  const totalPorTipo = porTipo.reduce((s, t) => s + t.count, 0);

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold text-gray-700">{data.titulo}</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Activos"    value={porEstado.activos ?? 0}     color="indigo" />
        <StatCard label="Cerrados"   value={porEstado.cerrados ?? 0}    color="green" />
        <StatCard label="Suspendidos" value={porEstado.suspendidos ?? 0} color="orange" />
        <StatCard label="Archivados" value={porEstado.archivados ?? 0}  color="gray" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
          <p className="text-3xl font-bold text-indigo-700">{abiertosEnPeriodo ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Casos abiertos en el período</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
          <p className="text-3xl font-bold text-green-700">{cerradosEnPeriodo ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Casos cerrados en el período</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
          <p className="text-3xl font-bold text-gray-700">{duracionPromedioDias ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Días promedio hasta cierre</p>
        </div>
      </div>

      {porTipo.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Distribución por Tipo</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <THead cols={[
                { label: 'Tipo' },
                { label: 'Casos', right: true },
                { label: 'Distribución' },
              ]} />
              <tbody className="divide-y divide-gray-50">
                {porTipo.map((t) => {
                  const pct = totalPorTipo > 0 ? Math.round((t.count / totalPorTipo) * 100) : 0;
                  return (
                    <tr key={t.tipo} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${TIPO_COLORS[t.tipo] ?? 'bg-gray-400'}`} />
                          <span className="font-medium text-gray-800">{TIPO_LABELS[t.tipo] ?? t.tipo}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-700">{t.count}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: AGING ───────────────────────────────────────────────────────────────

function AgingTab({ onPdf, pdfLoading }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reporte-aging'],
    queryFn: getAgingReporte,
    refetchInterval: 60_000,
  });

  if (isLoading) return <TableLoading />;
  if (error) return <TableError />;

  const { buckets = {}, totales = {}, totalFacturas = 0 } = data;
  const allFacturas = Object.values(buckets).flat().sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">{data.titulo}</h2>
        <PdfButton onClick={onPdf} loading={pdfLoading} />
      </div>

      <div className="grid grid-cols-5 gap-3">
        {AGING_BUCKETS.map(({ key, label, cardCls }) => (
          <div key={key} className={`p-4 rounded-xl border ${cardCls}`}>
            <p className="text-xl font-bold">{fmtMonto(totales[key])}</p>
            <p className="text-xs font-medium mt-0.5 opacity-70">{label}</p>
            <p className="text-xs mt-1 opacity-60">{buckets[key]?.length ?? 0} factura{buckets[key]?.length !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
        <div>
          <p className="text-xs text-indigo-600 font-medium">Total pendiente</p>
          <p className="text-2xl font-bold text-indigo-800">{fmtMonto(totales.total)}</p>
        </div>
        <p className="text-sm text-indigo-600">{totalFacturas} factura{totalFacturas !== 1 ? 's' : ''} pendiente{totalFacturas !== 1 ? 's' : ''}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <THead cols={[
              { label: 'Cliente' },
              { label: 'Caso' },
              { label: 'Estado' },
              { label: 'Monto',   right: true },
              { label: 'Vence',   right: true },
              { label: 'Antigüedad' },
            ]} />
            <tbody className="divide-y divide-gray-50">
              {allFacturas.map((f) => {
                const bKey = agingBucketKey(f.vence);
                const bMeta = AGING_BUCKETS.find((b) => b.key === bKey);
                return (
                  <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-[160px]">{f.cliente?.nombre}</p>
                      {f.cliente?.telefono && <p className="text-xs text-gray-400">{f.cliente.telefono}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {f.caso ? (
                        <>
                          <p className="text-xs font-bold text-indigo-700 font-mono">{f.caso.numero}</p>
                          <p className="text-xs text-gray-600 truncate max-w-[140px]">{f.caso.titulo}</p>
                        </>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${f.estado === 'VENCIDA' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {f.estado === 'VENCIDA' ? 'Vencida' : 'Enviada'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-800">{fmtMonto(f.monto)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 text-xs">
                      {f.vence ? new Date(f.vence).toLocaleDateString('es-PA') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {bMeta && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${bMeta.pillCls}`}>
                          {bMeta.label}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {allFacturas.length === 0 && <EmptyRow cols={6} msg="No hay facturas pendientes" />}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function ReportesPage() {
  const { user } = useAuth();
  const puedeVer = ['ADMIN', 'SOCIO'].includes(user?.rol);

  const hoy = new Date();
  const [desde, setDesde] = useState(`${hoy.getFullYear()}-01-01`);
  const [hasta, setHasta] = useState(hoy.toISOString().split('T')[0]);
  const [tab, setTab]     = useState('productividad');
  const [pdfLoading, setPdfLoading] = useState(null);

  if (!puedeVer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Acceso restringido</p>
          <p className="text-sm text-gray-400 mt-1">Solo SOCIO y ADMIN pueden ver los reportes</p>
        </div>
      </div>
    );
  }

  const handlePdf = async (tipo) => {
    setPdfLoading(tipo);
    try {
      const params = { desde, hasta };
      if (tipo === 'productividad') {
        await downloadPdf(descargarPdfProductividad, params, `productividad-${desde}-${hasta}.pdf`);
      } else if (tipo === 'casos') {
        await downloadPdf(descargarPdfRentabilidadCasos, params, `rentabilidad-casos-${desde}-${hasta}.pdf`);
      } else if (tipo === 'aging') {
        await downloadPdf(descargarPdfAging, undefined, `aging-${hoy.toISOString().split('T')[0]}.pdf`);
      }
    } catch {
      toast.error('Error al generar el PDF');
    } finally {
      setPdfLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                <BarChart2 className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Reportes</h1>
                <p className="text-xs text-gray-500">Análisis y métricas de la firma</p>
              </div>
            </div>

            {/* Date range — not shown for aging tab */}
            {tab !== 'aging' && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 font-medium">Desde</label>
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <label className="text-xs text-gray-500 font-medium">Hasta</label>
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 mt-4 overflow-x-auto pb-px">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
                  tab === id
                    ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {tab === 'productividad' && (
          <ProductividadTab desde={desde} hasta={hasta} onPdf={() => handlePdf('productividad')} pdfLoading={pdfLoading === 'productividad'} />
        )}
        {tab === 'casos' && (
          <RentabilidadCasosTab desde={desde} hasta={hasta} onPdf={() => handlePdf('casos')} pdfLoading={pdfLoading === 'casos'} />
        )}
        {tab === 'clientes' && (
          <RentabilidadClientesTab desde={desde} hasta={hasta} />
        )}
        {tab === 'tipos' && (
          <IngresosTipoTab desde={desde} hasta={hasta} />
        )}
        {tab === 'estadisticas' && (
          <EstadisticasCasosTab desde={desde} hasta={hasta} />
        )}
        {tab === 'aging' && (
          <AgingTab onPdf={() => handlePdf('aging')} pdfLoading={pdfLoading === 'aging'} />
        )}
      </div>
    </div>
  );
}
