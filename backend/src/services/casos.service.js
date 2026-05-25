import prisma from '../lib/prisma.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const selectCasoBase = {
  id: true,
  firmaId: true,
  numero: true,
  titulo: true,
  tipo: true,
  juzgado: true,
  juez: true,
  contraparte: true,
  estado: true,
  fechaApertura: true,
  fechaCierre: true,
  descripcion: true,
  createdAt: true,
  updatedAt: true,
  cliente: { select: { id: true, nombre: true, tipo: true, cedula: true, ruc: true } },
  clientesAdicionales: {
    select: {
      rol: true,
      cliente: { select: { id: true, nombre: true, tipo: true, cedula: true, ruc: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
  abogado: { select: { id: true, nombre: true, rol: true, numeroIdoneidad: true } },
  abogados: {
    select: {
      rol: true,
      abogado: { select: { id: true, nombre: true, rol: true } },
    },
  },
};

const verificarAcceso = (caso, user) => {
  if (caso.firmaId !== user.firmaId) throw new ForbiddenError('Acceso denegado.');
  if (user.rol === 'PASANTE') {
    const asignado =
      caso.abogadoId === user.sub ||
      caso.abogados?.some((a) => a.abogado?.id === user.sub);
    if (!asignado) throw new ForbiddenError('Solo puedes ver casos asignados a ti.');
  }
};

// ─── LISTAR ───────────────────────────────────────────────────────────────────

export const listar = async (firmaId, user, filtros = {}) => {
  const {
    estado,
    tipo,
    abogadoId,
    clienteId,
    busqueda,
    pagina = 1,
    porPagina = 20,
    ordenPor = 'updatedAt',
    direccion = 'desc',
  } = filtros;

  const where = { firmaId };

  // Pasante solo ve sus casos
  if (user.rol === 'PASANTE') {
    where.OR = [
      { abogadoId: user.sub },
      { abogados: { some: { abogadoId: user.sub } } },
    ];
  }

  if (estado) where.estado = estado;
  if (tipo) where.tipo = tipo;
  if (abogadoId) {
    where.OR = [
      { abogadoId },
      { abogados: { some: { abogadoId } } },
    ];
  }
  if (clienteId) where.clienteId = clienteId;
  if (busqueda) {
    where.OR = [
      { titulo: { contains: busqueda, mode: 'insensitive' } },
      { numero: { contains: busqueda, mode: 'insensitive' } },
      { contraparte: { contains: busqueda, mode: 'insensitive' } },
      { juzgado: { contains: busqueda, mode: 'insensitive' } },
    ];
  }

  const skip = (Number(pagina) - 1) * Number(porPagina);

  const [total, casos] = await Promise.all([
    prisma.caso.count({ where }),
    prisma.caso.findMany({
      where,
      select: {
        ...selectCasoBase,
        _count: {
          select: {
            audiencias: true,
            terminos: true,
            tareas: true,
            documentos: true,
          },
        },
      },
      orderBy: { [ordenPor]: direccion },
      skip,
      take: Number(porPagina),
    }),
  ]);

  return {
    datos: casos,
    paginacion: {
      total,
      pagina: Number(pagina),
      porPagina: Number(porPagina),
      totalPaginas: Math.ceil(total / Number(porPagina)),
    },
  };
};

// ─── KANBAN ───────────────────────────────────────────────────────────────────

export const kanban = async (firmaId, user) => {
  const where = { firmaId };
  if (user.rol === 'PASANTE') {
    where.OR = [
      { abogadoId: user.sub },
      { abogados: { some: { abogadoId: user.sub } } },
    ];
  }

  const casos = await prisma.caso.findMany({
    where,
    select: {
      id: true,
      numero: true,
      titulo: true,
      tipo: true,
      estado: true,
      fechaApertura: true,
      cliente: { select: { id: true, nombre: true } },
      abogado: { select: { id: true, nombre: true } },
      _count: { select: { audiencias: true, terminos: true, tareas: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const estados = ['ACTIVO', 'SUSPENDIDO', 'CERRADO', 'ARCHIVADO'];
  return estados.reduce((acc, estado) => {
    acc[estado] = casos.filter((c) => c.estado === estado);
    return acc;
  }, {});
};

// ─── OBTENER ──────────────────────────────────────────────────────────────────

export const obtener = async (id, user) => {
  const caso = await prisma.caso.findUnique({
    where: { id },
    select: {
      ...selectCasoBase,
      honorarioConfig: true,
      _count: {
        select: {
          audiencias: true,
          terminos: true,
          tareas: true,
          documentos: true,
          registrosHoras: true,
          gastos: true,
          comunicaciones: true,
        },
      },
    },
  });

  if (!caso) throw new NotFoundError('Caso no encontrado.');
  verificarAcceso(caso, user);
  return caso;
};

// ─── CREAR ────────────────────────────────────────────────────────────────────

export const crear = async (firmaId, datos, user) => {
  if (user.rol === 'PASANTE') {
    throw new ForbiddenError('Los pasantes no pueden crear casos.');
  }

  // Verificar que el número de expediente no exista en la firma
  const existe = await prisma.caso.findUnique({
    where: { firmaId_numero: { firmaId, numero: datos.numero } },
  });
  if (existe) throw new ValidationError(`El número de expediente ${datos.numero} ya existe.`);

  // Verificar que cliente y abogado pertenezcan a la firma
  const [cliente, abogado] = await Promise.all([
    prisma.cliente.findFirst({ where: { id: datos.clienteId, firmaId } }),
    prisma.abogado.findFirst({ where: { id: datos.abogadoId, firmaId } }),
  ]);
  if (!cliente) throw new NotFoundError('Cliente no encontrado en esta firma.');
  if (!abogado) throw new NotFoundError('Abogado no encontrado en esta firma.');

  const caso = await prisma.caso.create({
    data: {
      firmaId,
      clienteId: datos.clienteId,
      abogadoId: datos.abogadoId,
      numero: datos.numero,
      titulo: datos.titulo,
      tipo: datos.tipo || 'CIVIL',
      juzgado: datos.juzgado,
      juez: datos.juez,
      contraparte: datos.contraparte,
      estado: 'ACTIVO',
      fechaApertura: datos.fechaApertura ? new Date(datos.fechaApertura) : new Date(),
      descripcion: datos.descripcion,
      historial: {
        create: {
          estadoDespues: 'ACTIVO',
          nota: 'Caso creado.',
          abogadoId: user.sub,
        },
      },
    },
    select: selectCasoBase,
  });

  // Crear configuración de honorarios si se provee
  if (datos.honorario) {
    await prisma.honorarioConfig.create({
      data: { casoId: caso.id, ...datos.honorario },
    });
  }

  return caso;
};

// ─── ACTUALIZAR ───────────────────────────────────────────────────────────────

export const actualizar = async (id, datos, user) => {
  const caso = await prisma.caso.findUnique({ where: { id } });
  if (!caso) throw new NotFoundError('Caso no encontrado.');
  verificarAcceso(caso, user);

  if (user.rol === 'PASANTE') {
    throw new ForbiddenError('Los pasantes no pueden editar casos.');
  }

  // Si cambia el abogado principal, verificar que pertenezca a la firma
  if (datos.abogadoId && datos.abogadoId !== caso.abogadoId) {
    const abogado = await prisma.abogado.findFirst({
      where: { id: datos.abogadoId, firmaId: caso.firmaId },
    });
    if (!abogado) throw new NotFoundError('Abogado no encontrado en esta firma.');
  }

  return prisma.caso.update({
    where: { id },
    data: {
      ...(datos.titulo && { titulo: datos.titulo }),
      ...(datos.tipo && { tipo: datos.tipo }),
      ...(datos.juzgado !== undefined && { juzgado: datos.juzgado }),
      ...(datos.juez !== undefined && { juez: datos.juez }),
      ...(datos.contraparte !== undefined && { contraparte: datos.contraparte }),
      ...(datos.abogadoId && { abogadoId: datos.abogadoId }),
      ...(datos.descripcion !== undefined && { descripcion: datos.descripcion }),
      ...(datos.fechaApertura && { fechaApertura: new Date(datos.fechaApertura) }),
    },
    select: selectCasoBase,
  });
};

// ─── CAMBIAR ESTADO ───────────────────────────────────────────────────────────

export const cambiarEstado = async (id, nuevoEstado, nota, user) => {
  const caso = await prisma.caso.findUnique({ where: { id } });
  if (!caso) throw new NotFoundError('Caso no encontrado.');
  verificarAcceso(caso, user);

  if (user.rol === 'PASANTE') {
    throw new ForbiddenError('Los pasantes no pueden cambiar el estado de un caso.');
  }

  if (caso.estado === nuevoEstado) {
    throw new ValidationError(`El caso ya se encuentra en estado ${nuevoEstado}.`);
  }

  const [casoActualizado] = await prisma.$transaction([
    prisma.caso.update({
      where: { id },
      data: {
        estado: nuevoEstado,
        ...(nuevoEstado === 'CERRADO' && { fechaCierre: new Date() }),
        ...(nuevoEstado === 'ACTIVO' && { fechaCierre: null }),
      },
      select: selectCasoBase,
    }),
    prisma.casoHistorial.create({
      data: {
        casoId: id,
        estadoAntes: caso.estado,
        estadoDespues: nuevoEstado,
        nota: nota || null,
        abogadoId: user.sub,
      },
    }),
  ]);

  return casoActualizado;
};

// ─── ASIGNAR ABOGADO ──────────────────────────────────────────────────────────

export const agregarCliente = async (casoId, clienteId, rol, user) => {
  const caso = await prisma.caso.findUnique({ where: { id: casoId } });
  if (!caso) throw new NotFoundError('Caso no encontrado.');
  verificarAcceso(caso, user);

  if (!['ADMIN', 'SOCIO'].includes(user.rol)) {
    throw new ForbiddenError('Solo socios o administradores pueden agregar clientes al caso.');
  }
  if (caso.clienteId === clienteId) {
    throw new ValidationError('Este cliente ya es el cliente principal del caso.');
  }

  const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, firmaId: caso.firmaId } });
  if (!cliente) throw new NotFoundError('Cliente no encontrado en esta firma.');

  return prisma.casoCliente.upsert({
    where: { casoId_clienteId: { casoId, clienteId } },
    create: { casoId, clienteId, rol: rol || null },
    update: { rol: rol || null },
    include: { cliente: { select: { id: true, nombre: true, tipo: true, cedula: true, ruc: true } } },
  });
};

export const removerCliente = async (casoId, clienteId, user) => {
  const caso = await prisma.caso.findUnique({ where: { id: casoId } });
  if (!caso) throw new NotFoundError('Caso no encontrado.');
  verificarAcceso(caso, user);

  if (!['ADMIN', 'SOCIO'].includes(user.rol)) {
    throw new ForbiddenError('Solo socios o administradores pueden remover clientes del caso.');
  }

  await prisma.casoCliente.delete({
    where: { casoId_clienteId: { casoId, clienteId } },
  });
};

export const asignarAbogado = async (casoId, abogadoId, rol, user) => {
  const caso = await prisma.caso.findUnique({ where: { id: casoId } });
  if (!caso) throw new NotFoundError('Caso no encontrado.');
  verificarAcceso(caso, user);

  if (!['ADMIN', 'SOCIO'].includes(user.rol)) {
    throw new ForbiddenError('Solo socios o administradores pueden asignar abogados.');
  }

  const abogado = await prisma.abogado.findFirst({
    where: { id: abogadoId, firmaId: caso.firmaId },
  });
  if (!abogado) throw new NotFoundError('Abogado no encontrado en esta firma.');

  return prisma.casoAbogado.upsert({
    where: { casoId_abogadoId: { casoId, abogadoId } },
    create: { casoId, abogadoId, rol: rol || null },
    update: { rol: rol || null },
  });
};

export const removerAbogado = async (casoId, abogadoId, user) => {
  const caso = await prisma.caso.findUnique({ where: { id: casoId } });
  if (!caso) throw new NotFoundError('Caso no encontrado.');
  verificarAcceso(caso, user);

  if (!['ADMIN', 'SOCIO'].includes(user.rol)) {
    throw new ForbiddenError('Solo socios o administradores pueden remover abogados.');
  }

  if (caso.abogadoId === abogadoId) {
    throw new ValidationError('No se puede remover al abogado responsable principal. Reasigne primero el caso.');
  }

  await prisma.casoAbogado.delete({
    where: { casoId_abogadoId: { casoId, abogadoId } },
  });
};

// ─── TIMELINE ─────────────────────────────────────────────────────────────────

export const timeline = async (casoId, user) => {
  const caso = await prisma.caso.findUnique({
    where: { id: casoId },
    select: {
      id: true,
      firmaId: true,
      abogadoId: true,
      titulo: true,
      fechaApertura: true,
      abogados: { select: { abogadoId: true } },
    },
  });
  if (!caso) throw new NotFoundError('Caso no encontrado.');
  verificarAcceso(caso, user);

  const [historial, audiencias, terminos, documentos, tareas, comunicaciones, horas] =
    await Promise.all([
      prisma.casoHistorial.findMany({
        where: { casoId },
        orderBy: { fecha: 'desc' },
      }),
      prisma.audiencia.findMany({
        where: { casoId },
        orderBy: { fecha: 'desc' },
      }),
      prisma.terminoProcesal.findMany({
        where: { casoId },
        orderBy: { fechaVence: 'desc' },
      }),
      prisma.documento.findMany({
        where: { casoId },
        select: {
          id: true, nombre: true, tipo: true, version: true,
          fechaSubida: true, confidencial: true,
          subidoPor: { select: { nombre: true } },
        },
        orderBy: { fechaSubida: 'desc' },
      }),
      prisma.tarea.findMany({
        where: { casoId },
        select: {
          id: true, descripcion: true, estado: true, prioridad: true,
          fechaLimite: true, completadaEn: true,
          abogado: { select: { nombre: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.comunicacion.findMany({
        where: { casoId },
        select: {
          id: true, tipo: true, descripcion: true, fecha: true,
          abogado: { select: { nombre: true } },
          cliente: { select: { nombre: true } },
        },
        orderBy: { fecha: 'desc' },
      }),
      prisma.registroHoras.findMany({
        where: { casoId },
        select: {
          id: true, fecha: true, horas: true, descripcion: true, facturable: true,
          abogado: { select: { nombre: true } },
        },
        orderBy: { fecha: 'desc' },
      }),
    ]);

  const eventos = [
    // Apertura del caso
    {
      tipo: 'CASO_CREADO',
      fecha: caso.fechaApertura,
      titulo: 'Caso abierto',
      descripcion: caso.titulo,
      icono: 'folder-open',
    },

    // Cambios de estado
    ...historial.map((h) => ({
      tipo: 'ESTADO_CAMBIADO',
      fecha: h.fecha,
      titulo: h.estadoAntes
        ? `Estado: ${h.estadoAntes} → ${h.estadoDespues}`
        : `Estado inicial: ${h.estadoDespues}`,
      descripcion: h.nota,
      meta: { estadoAntes: h.estadoAntes, estadoDespues: h.estadoDespues },
      icono: 'git-branch',
    })),

    // Audiencias
    ...audiencias.map((a) => ({
      tipo: 'AUDIENCIA',
      fecha: a.fecha,
      titulo: a.titulo,
      descripcion: [a.tipo, a.juzgado].filter(Boolean).join(' — '),
      estado: a.estado,
      resultado: a.resultado,
      meta: { audienciaId: a.id, hora: a.hora, juzgado: a.juzgado },
      icono: 'gavel',
    })),

    // Términos procesales
    ...terminos.map((t) => ({
      tipo: 'TERMINO',
      fecha: t.fechaVence,
      titulo: t.descripcion,
      estado: t.estado,
      prioridad: t.prioridad,
      meta: { terminoId: t.id, diasAlerta: t.diasAlerta, completadoEn: t.completadoEn },
      icono: 'clock',
    })),

    // Documentos
    ...documentos.map((d) => ({
      tipo: 'DOCUMENTO',
      fecha: d.fechaSubida,
      titulo: d.nombre,
      descripcion: `${d.tipo || 'Documento'} — v${d.version}${d.confidencial ? ' [CONFIDENCIAL]' : ''}`,
      actor: d.subidoPor?.nombre,
      meta: { documentoId: d.id, version: d.version, confidencial: d.confidencial },
      icono: 'file',
    })),

    // Tareas
    ...tareas.map((t) => ({
      tipo: 'TAREA',
      fecha: t.completadaEn || t.fechaLimite || new Date(),
      titulo: t.descripcion,
      estado: t.estado,
      prioridad: t.prioridad,
      actor: t.abogado?.nombre,
      meta: { tareaId: t.id, completadaEn: t.completadaEn },
      icono: 'check-square',
    })),

    // Comunicaciones
    ...comunicaciones.map((c) => ({
      tipo: 'COMUNICACION',
      fecha: c.fecha,
      titulo: `${c.tipo} con ${c.cliente?.nombre}`,
      descripcion: c.descripcion,
      actor: c.abogado?.nombre,
      meta: { comunicacionId: c.id, tipoCom: c.tipo },
      icono: 'message-circle',
    })),

    // Registro de horas
    ...horas.map((h) => ({
      tipo: 'HORAS',
      fecha: h.fecha,
      titulo: `${Number(h.horas).toFixed(1)}h — ${h.descripcion}`,
      descripcion: h.facturable ? 'Facturable' : 'No facturable',
      actor: h.abogado?.nombre,
      meta: { registroId: h.id, horas: h.horas, facturable: h.facturable },
      icono: 'timer',
    })),
  ];

  // Ordenar por fecha descendente (más reciente primero)
  eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  return eventos;
};

// ─── ESTADÍSTICAS DEL CASO ────────────────────────────────────────────────────

export const estadisticas = async (casoId, user) => {
  const caso = await prisma.caso.findUnique({ where: { id: casoId } });
  if (!caso) throw new NotFoundError('Caso no encontrado.');
  verificarAcceso(caso, user);

  const [horasTotales, horasFacturables, gastosTotales, tareasPendientes, terminosVencidos] =
    await Promise.all([
      prisma.registroHoras.aggregate({
        where: { casoId },
        _sum: { horas: true },
      }),
      prisma.registroHoras.aggregate({
        where: { casoId, facturable: true },
        _sum: { horas: true },
      }),
      prisma.gasto.aggregate({
        where: { casoId },
        _sum: { monto: true },
      }),
      prisma.tarea.count({ where: { casoId, estado: { in: ['PENDIENTE', 'EN_PROCESO'] } } }),
      prisma.terminoProcesal.count({
        where: { casoId, estado: 'VENCIDO' },
      }),
    ]);

  const honorario = await prisma.honorarioConfig.findUnique({ where: { casoId } });
  const horasFact = Number(horasFacturables._sum.horas || 0);
  const tarifaHora = Number(honorario?.tarifaHora || 0);

  return {
    horas: {
      total: Number(horasTotales._sum.horas || 0),
      facturables: horasFact,
      valorFacturable: horasFact * tarifaHora,
    },
    gastos: {
      total: Number(gastosTotales._sum.monto || 0),
    },
    tareasPendientes,
    terminosVencidos,
    honorarioConfig: honorario,
  };
};
