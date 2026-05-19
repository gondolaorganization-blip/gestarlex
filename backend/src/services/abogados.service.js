import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../utils/errors.js';

const LIMITES_PLAN = { SOLO: 1, FIRMA: 5, ENTERPRISE: Infinity };

export const listar = async (firmaId) =>
  prisma.abogado.findMany({
    where: { firmaId },
    select: {
      id: true, firmaId: true, nombre: true, numeroIdoneidad: true,
      especialidad: true, email: true, telefono: true, rol: true,
      activo: true, avatarUrl: true, createdAt: true,
    },
    orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
  });

export const obtener = async (id, firmaId) => {
  const abogado = await prisma.abogado.findFirst({
    where: { id, firmaId },
    select: {
      id: true, firmaId: true, nombre: true, numeroIdoneidad: true,
      especialidad: true, email: true, telefono: true, rol: true,
      activo: true, avatarUrl: true, createdAt: true,
      firma: { select: { nombre: true, plan: true } },
      _count: { select: { casosResponsable: true, casosAsignados: true } },
    },
  });
  if (!abogado) throw new NotFoundError('Abogado no encontrado.');
  return abogado;
};

export const crear = async (firmaId, datos, rolSolicitante) => {
  // Solo ADMIN o SOCIO pueden crear abogados
  if (!['ADMIN', 'SOCIO'].includes(rolSolicitante)) {
    throw new ForbiddenError('Solo socios o administradores pueden agregar abogados.');
  }

  const firma = await prisma.firma.findUnique({ where: { id: firmaId } });
  if (!firma) throw new NotFoundError('Firma no encontrada.');

  // Verificar límite del plan
  const totalActivos = await prisma.abogado.count({ where: { firmaId, activo: true } });
  const limite = LIMITES_PLAN[firma.plan];
  if (totalActivos >= limite) {
    throw new ForbiddenError(
      `El plan ${firma.plan} permite máximo ${limite} abogado(s). Actualice su plan para agregar más.`
    );
  }

  const passwordHash = await bcrypt.hash(datos.password || 'Gestarlex2024!', 12);

  return prisma.abogado.create({
    data: {
      firmaId,
      nombre: datos.nombre,
      numeroIdoneidad: datos.numeroIdoneidad,
      especialidad: datos.especialidad,
      email: datos.email,
      telefono: datos.telefono,
      rol: datos.rol || 'ASOCIADO',
      passwordHash,
    },
    select: {
      id: true, firmaId: true, nombre: true, numeroIdoneidad: true,
      especialidad: true, email: true, telefono: true, rol: true, activo: true,
    },
  });
};

export const actualizar = async (id, firmaId, datos, rolSolicitante, solicitanteId) => {
  const abogado = await prisma.abogado.findFirst({ where: { id, firmaId } });
  if (!abogado) throw new NotFoundError('Abogado no encontrado.');

  // Solo ADMIN/SOCIO pueden cambiar roles; el propio usuario puede editar sus datos básicos
  const esPropioUsuario = solicitanteId === id;
  if (!esPropioUsuario && !['ADMIN', 'SOCIO'].includes(rolSolicitante)) {
    throw new ForbiddenError('No tiene permisos para editar este perfil.');
  }

  // Solo ADMIN/SOCIO pueden cambiar el rol
  if (datos.rol && !['ADMIN', 'SOCIO'].includes(rolSolicitante)) {
    delete datos.rol;
  }

  return prisma.abogado.update({
    where: { id },
    data: {
      ...(datos.nombre && { nombre: datos.nombre }),
      ...(datos.especialidad !== undefined && { especialidad: datos.especialidad }),
      ...(datos.telefono !== undefined && { telefono: datos.telefono }),
      ...(datos.rol && { rol: datos.rol }),
      ...(datos.activo !== undefined && { activo: datos.activo }),
      ...(datos.avatarUrl !== undefined && { avatarUrl: datos.avatarUrl }),
    },
    select: {
      id: true, nombre: true, numeroIdoneidad: true, especialidad: true,
      email: true, telefono: true, rol: true, activo: true, avatarUrl: true,
    },
  });
};

export const desactivar = async (id, firmaId, rolSolicitante) => {
  if (!['ADMIN', 'SOCIO'].includes(rolSolicitante)) {
    throw new ForbiddenError('Solo socios o administradores pueden desactivar abogados.');
  }

  const abogado = await prisma.abogado.findFirst({ where: { id, firmaId } });
  if (!abogado) throw new NotFoundError('Abogado no encontrado.');

  return prisma.abogado.update({ where: { id }, data: { activo: false } });
};
