import * as svc from '../services/reportes.service.js';
import { PdfGenerator } from '../utils/pdf.generator.js';
import { ok } from '../utils/response.js';
import { ForbiddenError } from '../utils/errors.js';

const soloSocio = (user) => {
  if (!['ADMIN', 'SOCIO'].includes(user.rol)) {
    throw new ForbiddenError('Solo socios o administradores pueden generar reportes.');
  }
};

const fmt = (n) =>
  `B/. ${Number(n || 0).toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtH = (n) => `${Number(n || 0).toFixed(1)}h`;
const pct = (n) => `${n}%`;

// ─── JSON (para frontend) ─────────────────────────────────────────────────────

export const productividad = async (req, res) => {
  soloSocio(req.user);
  const data = await svc.productividadAbogados(req.user.firmaId, req.query);
  ok(res, data);
};

export const rentabilidadCasos = async (req, res) => {
  soloSocio(req.user);
  const data = await svc.rentabilidadCasos(req.user.firmaId, req.query);
  ok(res, data);
};

export const rentabilidadClientes = async (req, res) => {
  soloSocio(req.user);
  const data = await svc.rentabilidadClientes(req.user.firmaId, req.query);
  ok(res, data);
};

export const ingresosPorTipo = async (req, res) => {
  soloSocio(req.user);
  const data = await svc.ingresosPorTipo(req.user.firmaId, req.query);
  ok(res, data);
};

export const estadisticasCasos = async (req, res) => {
  soloSocio(req.user);
  const data = await svc.estadisticasCasos(req.user.firmaId, req.query);
  ok(res, data);
};

export const agingHonorarios = async (req, res) => {
  soloSocio(req.user);
  const data = await svc.agingHonorarios(req.user.firmaId);
  ok(res, data);
};

// ─── PDF ──────────────────────────────────────────────────────────────────────

export const productividadPdf = async (req, res) => {
  soloSocio(req.user);
  const reporte = await svc.productividadAbogados(req.user.firmaId, req.query);
  const pdf = new PdfGenerator(res, reporte.titulo, reporte.firma);

  pdf._encabezadoPrincipal(reporte.periodo);

  pdf.kpiRow([
    { etiqueta: 'Horas totales', valor: fmtH(reporte.totales.horasTotales) },
    { etiqueta: 'Horas facturables', valor: fmtH(reporte.totales.horasFacturables) },
    { etiqueta: 'Casos cerrados', valor: String(reporte.totales.casosCerrados) },
    {
      etiqueta: 'Eficiencia promedio',
      valor: pct(
        reporte.datos.length
          ? Math.round(reporte.datos.reduce((s, a) => s + a.horas.eficiencia, 0) / reporte.datos.length)
          : 0
      ),
    },
  ]);

  pdf.subtitulo('Detalle por Abogado');

  const cols = [
    { titulo: 'Abogado', campo: 'nombre', ancho: 3 },
    { titulo: 'Rol', campo: 'rol', ancho: 1.2 },
    { titulo: 'Idoneidad', campo: 'numeroIdoneidad', ancho: 1.5 },
    { titulo: 'H. Total', campo: 'horasTotal', ancho: 1, alineacion: 'right' },
    { titulo: 'H. Fact.', campo: 'horasFact', ancho: 1, alineacion: 'right' },
    { titulo: 'Eficiencia', campo: 'eficiencia', ancho: 1.2, alineacion: 'right',
      colorFn: (v) => parseInt(v) >= 70 ? '#16a34a' : parseInt(v) >= 50 ? '#d97706' : '#dc2626' },
    { titulo: 'Casos Act.', campo: 'casosActivos', ancho: 1.2, alineacion: 'right' },
    { titulo: 'Cerrados', campo: 'casosCerrados', ancho: 1.2, alineacion: 'right' },
  ];

  const filas = reporte.datos.map((a) => ({
    nombre: a.nombre,
    rol: a.rol,
    numeroIdoneidad: a.numeroIdoneidad,
    horasTotal: fmtH(a.horas.total),
    horasFact: fmtH(a.horas.facturables),
    eficiencia: pct(a.horas.eficiencia),
    casosActivos: a.casos.activos,
    casosCerrados: a.casos.cerrados,
  }));

  pdf.tabla(cols, filas);
  pdf.filaTotales(cols, {
    nombre: 'TOTALES',
    horasTotal: fmtH(reporte.totales.horasTotales),
    horasFact: fmtH(reporte.totales.horasFacturables),
    eficiencia: pct(
      reporte.totales.horasTotales > 0
        ? Math.round((reporte.totales.horasFacturables / reporte.totales.horasTotales) * 100)
        : 0
    ),
    casosCerrados: reporte.totales.casosCerrados,
  });

  pdf.finalizar();
};

export const rentabilidadCasosPdf = async (req, res) => {
  soloSocio(req.user);
  const reporte = await svc.rentabilidadCasos(req.user.firmaId, req.query);
  const pdf = new PdfGenerator(res, reporte.titulo, reporte.firma);

  pdf._encabezadoPrincipal(reporte.periodo);

  pdf.kpiRow([
    { etiqueta: 'Total facturado', valor: fmt(reporte.totales.facturado) },
    { etiqueta: 'Total cobrado', valor: fmt(reporte.totales.cobrado), color: '#16a34a' },
    { etiqueta: 'Total gastos', valor: fmt(reporte.totales.gastos), color: '#dc2626' },
    { etiqueta: 'Margen neto', valor: fmt(reporte.totales.margen) },
  ]);

  pdf.subtitulo('Rentabilidad por Caso');

  const cols = [
    { titulo: 'Expediente', campo: 'numero', ancho: 1.5 },
    { titulo: 'Caso', campo: 'titulo', ancho: 3.5 },
    { titulo: 'Tipo', campo: 'tipo', ancho: 1.2 },
    { titulo: 'Cliente', campo: 'cliente', ancho: 2 },
    { titulo: 'Facturado', campo: 'facturado', ancho: 1.5, alineacion: 'right' },
    { titulo: 'Cobrado', campo: 'cobrado', ancho: 1.5, alineacion: 'right' },
    { titulo: 'Gastos', campo: 'gastos', ancho: 1.2, alineacion: 'right' },
    { titulo: 'Margen', campo: 'margen', ancho: 1.2, alineacion: 'right',
      colorFn: (_, f) => f.rentabilidad >= 60 ? '#16a34a' : f.rentabilidad >= 30 ? '#d97706' : '#dc2626' },
  ];

  const filas = reporte.datos.map((c) => ({
    ...c,
    facturado: fmt(c.facturado),
    cobrado: fmt(c.cobrado),
    gastos: fmt(c.gastos),
    margen: `${fmt(c.margen)} (${c.rentabilidad}%)`,
  }));

  pdf.tabla(cols, filas);
  pdf.filaTotales(cols, {
    numero: 'TOTALES',
    facturado: fmt(reporte.totales.facturado),
    cobrado: fmt(reporte.totales.cobrado),
    gastos: fmt(reporte.totales.gastos),
    margen: fmt(reporte.totales.margen),
  });

  pdf.finalizar();
};

export const agingPdf = async (req, res) => {
  soloSocio(req.user);
  const reporte = await svc.agingHonorarios(req.user.firmaId);
  const pdf = new PdfGenerator(res, reporte.titulo, reporte.firma);

  pdf._encabezadoPrincipal({ desde: reporte.generadoEn, hasta: reporte.generadoEn });

  pdf.kpiRow([
    { etiqueta: 'Total por cobrar', valor: fmt(reporte.totales.total), color: '#dc2626' },
    { etiqueta: 'Corriente', valor: fmt(reporte.totales.corriente), color: '#16a34a' },
    { etiqueta: 'Vencido 1-30d', valor: fmt(reporte.totales['1-30']), color: '#d97706' },
    { etiqueta: 'Vencido +30d', valor: fmt(reporte.totales['31-60'] + reporte.totales['61-90'] + reporte.totales.mas90), color: '#dc2626' },
  ]);

  const cols = [
    { titulo: 'N° Factura', campo: 'numero', ancho: 1.5 },
    { titulo: 'Cliente', campo: 'clienteNombre', ancho: 3 },
    { titulo: 'Caso', campo: 'casoNumero', ancho: 1.5 },
    { titulo: 'Monto', campo: 'monto', ancho: 1.5, alineacion: 'right' },
    { titulo: 'Emisión', campo: 'fecha', ancho: 1.5 },
    { titulo: 'Vencimiento', campo: 'vence', ancho: 1.5 },
    { titulo: 'Estado', campo: 'estado', ancho: 1.2,
      colorFn: (v) => v === 'VENCIDA' ? '#dc2626' : '#d97706' },
    { titulo: 'Bucket', campo: 'bucket', ancho: 1.2 },
  ];

  const formatFecha = (f) => f ? new Date(f).toLocaleDateString('es-PA') : '—';
  const toBucket = (f) => {
    if (!f.vence || new Date(f.vence) > new Date()) return 'Corriente';
    const dias = Math.ceil((new Date() - new Date(f.vence)) / 86400000);
    if (dias <= 30) return '1-30 días';
    if (dias <= 60) return '31-60 días';
    if (dias <= 90) return '61-90 días';
    return '+90 días';
  };

  const todasLasFacturas = [
    ...reporte.buckets.corriente,
    ...reporte.buckets['1-30'],
    ...reporte.buckets['31-60'],
    ...reporte.buckets['61-90'],
    ...reporte.buckets.mas90,
  ];

  const filas = todasLasFacturas.map((f) => ({
    numero: f.numero,
    clienteNombre: f.cliente?.nombre || '—',
    casoNumero: f.caso?.numero || '—',
    monto: fmt(f.monto),
    fecha: formatFecha(f.fecha),
    vence: formatFecha(f.vence),
    estado: f.estado,
    bucket: toBucket(f),
  }));

  pdf.subtitulo('Detalle de Facturas Pendientes');
  pdf.tabla(cols, filas);
  pdf.filaTotales(cols, { numero: 'TOTAL', monto: fmt(reporte.totales.total) });
  pdf.finalizar();
};
