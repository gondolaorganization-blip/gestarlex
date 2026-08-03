import prisma from '../lib/prisma.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

/**
 * Localiza un caso dentro de la firma aplicando la misma restricción que el resto
 * del sistema: un PASANTE solo alcanza los casos que tiene asignados.
 */
const casoDeLaFirma = async (casoId, firmaId, user) => {
  const caso = await prisma.caso.findFirst({
    where: { id: casoId, firmaId },
    select: {
      id: true,
      estado: true,
      abogadoId: true,
      abogados: { select: { abogadoId: true } },
    },
  });
  if (!caso) throw new NotFoundError('Caso no encontrado.');

  if (user.rol === 'PASANTE') {
    const asignado =
      caso.abogadoId === user.sub || caso.abogados.some((a) => a.abogadoId === user.sub);
    if (!asignado) throw new ForbiddenError('Solo puedes ver casos asignados a ti.');
  }

  return caso;
};

// ─── REGISTRAR ACTIVIDAD ──────────────────────────────────────────────────────

/**
 * Deja constancia de actividad en el caso sin cambiar su estado.
 *
 * Se apoya en CasoHistorial (estadoAntes === estadoDespues), así que la nota
 * aparece en el timeline que ya muestra la web, y refresca updatedAt para que
 * el caso suba en los listados ordenados por actividad reciente.
 */
export const registrarActividad = async (casoId, nota, firmaId, user) => {
  const caso = await casoDeLaFirma(casoId, firmaId, user);

  const [actualizado, historial] = await prisma.$transaction([
    prisma.caso.update({
      where: { id: caso.id },
      data: { updatedAt: new Date() },
      select: { id: true, numero: true, titulo: true, estado: true, updatedAt: true },
    }),
    prisma.casoHistorial.create({
      data: {
        casoId: caso.id,
        estadoAntes: caso.estado,
        estadoDespues: caso.estado,
        nota,
        abogadoId: user.sub,
      },
    }),
  ]);

  return { caso: actualizado, actividad: historial };
};

// ─── REFERENCIAR DOCUMENTO ────────────────────────────────────────────────────

/**
 * Registra un documento del caso apuntando a una URL externa.
 * El campo `archivo` del modelo admite path o URL, así que no se sube binario:
 * el archivo vive donde ya esté (Drive, etc.) y aquí queda la referencia.
 */
export const referenciarDocumento = async (casoId, datos, firmaId, user) => {
  if (user.rol === 'PASANTE' && datos.confidencial) {
    throw new ForbiddenError('Los pasantes no pueden registrar documentos confidenciales.');
  }

  await casoDeLaFirma(casoId, firmaId, user);

  // Mismo control de versiones que la subida por la web
  const existente = await prisma.documento.findFirst({
    where: { casoId, nombre: datos.nombre },
    orderBy: { version: 'desc' },
  });

  return prisma.documento.create({
    data: {
      casoId,
      nombre: datos.nombre,
      tipo: datos.tipo || null,
      archivo: datos.url,
      mimeType: null, // no hay binario: es una referencia externa
      tamanoBytes: null,
      version: existente ? existente.version + 1 : 1,
      subidoPorId: user.sub,
      confidencial: datos.confidencial === true,
      descripcion: datos.descripcion || null,
    },
    select: {
      id: true, nombre: true, tipo: true, archivo: true, version: true,
      fechaSubida: true, confidencial: true, descripcion: true,
      subidoPor: { select: { id: true, nombre: true } },
    },
  });
};
