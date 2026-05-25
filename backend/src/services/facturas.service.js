import prisma from '../lib/prisma.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';
import { enviarEmail, templates } from './email.service.js';

// ─── UTILIDADES ───────────────────────────────────────────────────────────────

const generarNumero = async (firmaId) => {
  // Formato: F-{AÑO}-{SECUENCIAL con padding 4 dígitos}
  const anio = new Date().getFullYear();
  const prefijo = `F-${anio}-`;

  const ultima = await prisma.factura.findFirst({
    where: { firmaId, numero: { startsWith: prefijo } },
    orderBy: { numero: 'desc' },
  });

  const secuencial = ultima
    ? Number(ultima.numero.replace(prefijo, '')) + 1
    : 1;

  return `${prefijo}${String(secuencial).padStart(4, '0')}`;
};

// ─── CÁLCULO AUTOMÁTICO DE MONTO ──────────────────────────────────────────────
// Ref: Acuerdo No. 49 de 2001 del Órgano Judicial (honorarios mínimos)

const calcularMontoDesdeConfig = async (casoId) => {
  const config = await prisma.honorarioConfig.findUnique({ where: { casoId } });
  if (!config) return { monto: 0, detalle: 'Sin configuración de honorarios.' };

  if (config.tipo === 'FIJO') {
    return {
      monto: Number(config.montoFijo || 0),
      detalle: `Honorario fijo: B/. ${config.montoFijo}`,
    };
  }

  if (config.tipo === 'HORA' || config.tipo === 'MIXTO') {
    const horas = await prisma.registroHoras.aggregate({
      where: { casoId, facturable: true, facturaId: null },
      _sum: { horas: true },
    });
    const horasTotales = Number(horas._sum.horas || 0);
    const tarifa = Number(config.tarifaHora || 0);
    const montoHoras = horasTotales * tarifa;

    if (config.tipo === 'HORA') {
      return {
        monto: montoHoras,
        detalle: `${horasTotales.toFixed(2)}h × B/. ${tarifa}/h = B/. ${montoHoras.toFixed(2)}`,
        horas: horasTotales,
      };
    }

    // MIXTO: horas + monto fijo base
    const montoFijo = Number(config.montoFijo || 0);
    return {
      monto: montoHoras + montoFijo,
      detalle: `Fijo: B/. ${montoFijo} + ${horasTotales.toFixed(2)}h × B/. ${tarifa}/h = B/. ${(montoHoras + montoFijo).toFixed(2)}`,
      horas: horasTotales,
    };
  }

  // CONTINGENCIA: monto manual — no se puede calcular automáticamente
  return {
    monto: 0,
    detalle: `Honorario por contingencia (${config.porcentajeExito}%). Ingrese el monto manualmente.`,
  };
};

// ─── LISTAR ───────────────────────────────────────────────────────────────────

export const listar = async (firmaId, filtros = {}) => {
  const { estado, clienteId, casoId, desde, hasta, pagina = 1, porPagina = 20 } = filtros;

  const where = { firmaId };
  if (estado) where.estado = estado;
  if (clienteId) where.clienteId = clienteId;
  if (casoId) where.casoId = casoId;
  if (desde || hasta) {
    where.fecha = {};
    if (desde) where.fecha.gte = new Date(desde);
    if (hasta) where.fecha.lte = new Date(hasta);
  }

  const skip = (Number(pagina) - 1) * Number(porPagina);

  const [total, facturas, sumas] = await Promise.all([
    prisma.factura.count({ where }),
    prisma.factura.findMany({
      where,
      include: {
        cliente: { select: { id: true, nombre: true, tipo: true } },
        caso: { select: { id: true, numero: true, titulo: true } },
      },
      orderBy: { fecha: 'desc' },
      skip,
      take: Number(porPagina),
    }),
    prisma.factura.groupBy({
      by: ['estado'],
      where: { firmaId },
      _sum: { monto: true },
      _count: { estado: true },
    }),
  ]);

  const resumenPorEstado = sumas.reduce((acc, s) => {
    acc[s.estado] = { count: s._count.estado, total: Number(s._sum.monto || 0) };
    return acc;
  }, {});

  return {
    datos: facturas,
    paginacion: {
      total,
      pagina: Number(pagina),
      porPagina: Number(porPagina),
      totalPaginas: Math.ceil(total / Number(porPagina)),
    },
    resumenPorEstado,
  };
};

export const obtener = async (id, firmaId) => {
  const factura = await prisma.factura.findFirst({
    where: { id, firmaId },
    include: {
      cliente: { select: { id: true, nombre: true, cedula: true, ruc: true, email: true } },
      caso: {
        select: {
          id: true, numero: true, titulo: true, tipo: true,
          abogado: { select: { nombre: true, numeroIdoneidad: true } },
          honorarioConfig: true,
        },
      },
      firma: { select: { nombre: true, ruc: true, telefono: true, email: true, direccion: true } },
    },
  });
  if (!factura) throw new NotFoundError('Factura no encontrada.');
  return factura;
};

// ─── CREAR ────────────────────────────────────────────────────────────────────

export const crear = async (datos, firmaId, user) => {
  if (user.rol === 'PASANTE') throw new ForbiddenError('Los pasantes no pueden crear facturas.');

  // Verificar cliente
  const cliente = await prisma.cliente.findFirst({ where: { id: datos.clienteId, firmaId } });
  if (!cliente) throw new NotFoundError('Cliente no encontrado.');

  // Verificar caso (si se proporcionó)
  if (datos.casoId) {
    const caso = await prisma.caso.findFirst({ where: { id: datos.casoId, firmaId } });
    if (!caso) throw new NotFoundError('Caso no encontrado.');
  }

  const numero = await generarNumero(firmaId);

  return prisma.factura.create({
    data: {
      firmaId,
      clienteId: datos.clienteId,
      casoId: datos.casoId || null,
      numero,
      monto: datos.monto,
      estado: 'BORRADOR',
      fecha: new Date(),
      vence: datos.vence ? new Date(datos.vence) : null,
      notas: datos.notas || null,
      destinatariosAdicionales: datos.destinatariosAdicionales?.length
        ? datos.destinatariosAdicionales
        : undefined,
    },
    include: {
      cliente: { select: { id: true, nombre: true } },
      caso: { select: { id: true, numero: true, titulo: true } },
    },
  });
};

// ─── GENERAR DESDE CASO ───────────────────────────────────────────────────────
// Calcula automáticamente el monto según HonorarioConfig

export const generarDesdeCaso = async (casoId, extras, firmaId, user) => {
  if (user.rol === 'PASANTE') throw new ForbiddenError('Acceso denegado.');

  const caso = await prisma.caso.findFirst({
    where: { id: casoId, firmaId },
    include: { cliente: true, honorarioConfig: true },
  });
  if (!caso) throw new NotFoundError('Caso no encontrado.');
  if (!caso.honorarioConfig) {
    throw new ValidationError('El caso no tiene configuración de honorarios. Configúrela primero.');
  }

  const { monto, detalle, horas } = await calcularMontoDesdeConfig(casoId);

  // Agregar gastos reembolsables no facturados
  const gastosReembolsables = await prisma.gasto.findMany({
    where: { casoId, reembolsable: true, reembolsado: false },
  });
  const totalGastos = gastosReembolsables.reduce((s, g) => s + Number(g.monto), 0);

  const montoTotal = monto + totalGastos + Number(extras?.ajuste || 0);
  const numero = await generarNumero(firmaId);

  // Calcular fecha de vencimiento (30 días por defecto)
  const vence = new Date();
  vence.setDate(vence.getDate() + (extras?.diasVence || 30));

  const factura = await prisma.factura.create({
    data: {
      firmaId,
      clienteId: caso.clienteId,
      casoId,
      numero,
      monto: montoTotal,
      estado: 'BORRADOR',
      fecha: new Date(),
      vence,
      notas: [
        detalle,
        totalGastos > 0 ? `Gastos reembolsables: B/. ${totalGastos.toFixed(2)}` : null,
        extras?.notas,
      ]
        .filter(Boolean)
        .join('\n'),
    },
    include: {
      cliente: { select: { id: true, nombre: true } },
      caso: { select: { id: true, numero: true, titulo: true } },
    },
  });

  // Marcar las horas facturables como facturadas
  if (horas > 0) {
    await prisma.registroHoras.updateMany({
      where: { casoId, facturable: true, facturaId: null },
      data: { facturaId: factura.id },
    });
  }

  // Marcar gastos reembolsables como reembolsados
  if (gastosReembolsables.length > 0) {
    await prisma.gasto.updateMany({
      where: { id: { in: gastosReembolsables.map((g) => g.id) } },
      data: { reembolsado: true },
    });
  }

  return { factura, desglose: { honorarios: monto, gastos: totalGastos, ajuste: extras?.ajuste || 0, total: montoTotal } };
};

// ─── ACTUALIZAR ──────────────────────────────────────────────────────────────

export const actualizar = async (id, datos, firmaId, user) => {
  if (user.rol === 'PASANTE') throw new ForbiddenError('Los pasantes no pueden editar facturas.');

  const factura = await prisma.factura.findFirst({ where: { id, firmaId } });
  if (!factura) throw new NotFoundError('Factura no encontrada.');

  const cambios = {};
  if (datos.clienteId !== undefined) {
    const cliente = await prisma.cliente.findFirst({ where: { id: datos.clienteId, firmaId } });
    if (!cliente) throw new NotFoundError('Cliente no encontrado.');
    cambios.clienteId = datos.clienteId;
  }
  if (datos.monto !== undefined) cambios.monto = datos.monto;
  if (datos.vence !== undefined) cambios.vence = datos.vence ? new Date(datos.vence) : null;
  if (datos.notas !== undefined) cambios.notas = datos.notas || null;
  if (datos.destinatariosAdicionales !== undefined)
    cambios.destinatariosAdicionales = datos.destinatariosAdicionales?.length
      ? datos.destinatariosAdicionales
      : null;

  if (Object.keys(cambios).length === 0) throw new ValidationError('No se enviaron cambios.');

  return prisma.factura.update({
    where: { id },
    data: cambios,
    include: {
      cliente: { select: { id: true, nombre: true, cedula: true, ruc: true, email: true } },
      caso: { select: { id: true, numero: true, titulo: true } },
      firma: { select: { nombre: true, ruc: true, telefono: true, email: true, direccion: true } },
    },
  });
};

// ─── CAMBIAR ESTADO ───────────────────────────────────────────────────────────

export const cambiarEstado = async (id, nuevoEstado, firmaId, user) => {
  if (user.rol === 'PASANTE') throw new ForbiddenError('Acceso denegado.');

  const factura = await prisma.factura.findFirst({ where: { id, firmaId } });
  if (!factura) throw new NotFoundError('Factura no encontrada.');

  const transicionesValidas = {
    BORRADOR: ['ENVIADA', 'ANULADA'],
    ENVIADA: ['PAGADA', 'VENCIDA', 'ANULADA'],
    PAGADA: [],
    VENCIDA: ['PAGADA', 'ANULADA'],
    ANULADA: [],
  };

  if (!transicionesValidas[factura.estado]?.includes(nuevoEstado)) {
    throw new ValidationError(
      `No se puede cambiar el estado de ${factura.estado} a ${nuevoEstado}.`
    );
  }

  const facturaActualizada = await prisma.factura.update({
    where: { id },
    data: { estado: nuevoEstado },
  });

  if (nuevoEstado === 'ENVIADA') {
    const facturaCompleta = await prisma.factura.findUnique({
      where: { id },
      include: {
        cliente: { select: { nombre: true, email: true } },
        firma: { select: { id: true, nombre: true } },
      },
    });
    const emailCliente = facturaCompleta?.cliente?.email;
    if (emailCliente) {
      const tmpl = templates.facturaEnviada({
        factura: facturaActualizada,
        cliente: facturaCompleta.cliente,
        firma: facturaCompleta.firma,
      });
      enviarEmail({
        firmaId,
        casoId: facturaActualizada.casoId ?? null,
        tipo: 'FACTURA_ENVIADA',
        asunto: tmpl.asunto,
        html: tmpl.html,
        destinatario: emailCliente,
      }).catch(() => {});
    }
  }

  return facturaActualizada;
};

// ─── AGING REPORT ─────────────────────────────────────────────────────────────
// Cuentas por cobrar categorizadas por antigüedad de la deuda

export const agingReport = async (firmaId) => {
  const hoy = new Date();

  // Auto-vencer facturas enviadas con fecha de vencimiento pasada
  await prisma.factura.updateMany({
    where: {
      firmaId,
      estado: 'ENVIADA',
      vence: { lt: hoy },
    },
    data: { estado: 'VENCIDA' },
  });

  const pendientes = await prisma.factura.findMany({
    where: {
      firmaId,
      estado: { in: ['ENVIADA', 'VENCIDA'] },
    },
    include: {
      cliente: { select: { id: true, nombre: true, email: true, telefono: true } },
      caso: { select: { id: true, numero: true, titulo: true } },
    },
    orderBy: { fecha: 'asc' },
  });

  const buckets = {
    corriente: [],      // No vencidas
    '1-30': [],         // Vencidas 1-30 días
    '31-60': [],        // Vencidas 31-60 días
    '61-90': [],        // Vencidas 61-90 días
    'mas90': [],        // Vencidas más de 90 días
  };

  for (const f of pendientes) {
    if (!f.vence || f.vence > hoy) {
      buckets.corriente.push(f);
      continue;
    }
    const dias = Math.ceil((hoy - new Date(f.vence)) / (1000 * 60 * 60 * 24));
    if (dias <= 30) buckets['1-30'].push(f);
    else if (dias <= 60) buckets['31-60'].push(f);
    else if (dias <= 90) buckets['61-90'].push(f);
    else buckets['mas90'].push(f);
  }

  const sumarBucket = (arr) => arr.reduce((s, f) => s + Number(f.monto), 0);

  return {
    buckets,
    totales: {
      corriente: sumarBucket(buckets.corriente),
      '1-30': sumarBucket(buckets['1-30']),
      '31-60': sumarBucket(buckets['31-60']),
      '61-90': sumarBucket(buckets['61-90']),
      mas90: sumarBucket(buckets['mas90']),
      total: pendientes.reduce((s, f) => s + Number(f.monto), 0),
    },
  };
};
