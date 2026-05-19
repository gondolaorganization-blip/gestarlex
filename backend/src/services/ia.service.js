import Anthropic from '@anthropic-ai/sdk';
import prisma from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { extraerTexto } from './extractor.service.js';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2048;

// Límite mensual de consultas por plan (-1 = ilimitado)
const AI_LIMITS = { SOLO: 100, FIRMA: 500, ENTERPRISE: -1 };

const SYSTEM_PROMPT = `Eres un asistente legal especializado para firmas de abogados en Panamá.
Tu nombre es GESTARLEX Asistente. Respondes en español panameño, de forma clara y profesional.

Tienes conocimiento actualizado de:
- Ley 402 de 2023 (Código Procesal Civil de Panamá)
- Código de Trabajo de la República de Panamá
- Código Civil de Panamá
- Código Penal de Panamá
- Acuerdo 49 de 2001 del Órgano Judicial (honorarios)
- Procedimientos ante el Órgano Judicial, MITRADEL, MICI y otras entidades
- Constitución Política de la República de Panamá

Reglas:
- Sé conciso pero completo. Usa párrafos cortos.
- Si la pregunta requiere información específica del caso que no tienes, indícalo claramente.
- No inventes jurisprudencia ni números de ley que no conozcas. Si no sabes, dilo.
- Cuando cites normativa, especifica el artículo y la ley.
- No brindes asesoría que reemplace al criterio profesional del abogado.
- Cuando redactes documentos o borradores, usa formato legal panameño estándar.`;

function buildCasoContext(caso, documentosConTexto) {
  if (!caso) return '';

  const lines = [
    '\n\n--- CONTEXTO DEL CASO ---',
    `Número: ${caso.numero}`,
    `Título: ${caso.titulo}`,
    `Tipo: ${caso.tipo}`,
    `Estado: ${caso.estado}`,
    `Cliente: ${caso.cliente?.nombre ?? 'N/D'}`,
    `Abogado responsable: ${caso.abogado?.nombre ?? 'N/D'}`,
  ];

  if (caso.juzgado) lines.push(`Juzgado: ${caso.juzgado}`);
  if (caso.juez) lines.push(`Juez: ${caso.juez}`);
  if (caso.contraparte) lines.push(`Contraparte: ${caso.contraparte}`);
  if (caso.descripcion) lines.push(`Descripción: ${caso.descripcion}`);

  if (caso.audiencias?.length) {
    lines.push('\nPróximas audiencias:');
    caso.audiencias.forEach((a) =>
      lines.push(`  - ${a.titulo} · ${new Date(a.fecha).toLocaleDateString('es-PA')} ${a.hora ?? ''} (${a.estado})`),
    );
  }

  if (caso.terminos?.length) {
    lines.push('\nTérminos procesales pendientes:');
    caso.terminos.forEach((t) =>
      lines.push(`  - ${t.descripcion} · vence ${new Date(t.fechaVence).toLocaleDateString('es-PA')} (${t.estado})`),
    );
  }

  if (caso.documentos?.length) {
    lines.push('\nDocumentos del caso:');
    caso.documentos.forEach((d) => lines.push(`  - ${d.nombre}${d.tipo ? ` (${d.tipo})` : ''}`));
  }

  if (documentosConTexto?.length) {
    lines.push('\n--- CONTENIDO DE DOCUMENTOS ---');
    documentosConTexto.forEach(({ nombre, texto }) => {
      lines.push(`\n[${nombre}]\n${texto}`);
    });
    lines.push('--- FIN DOCUMENTOS ---');
  }

  lines.push('---');
  return lines.join('\n');
}

async function verificarYIncrementarLimite(firmaId) {
  const firma = await prisma.firma.findUnique({
    where: { id: firmaId },
    select: { plan: true, aiConsultasMes: true, aiConsultasResetEn: true },
  });

  if (!firma) throw new AppError('Firma no encontrada.', 404);

  const limite = AI_LIMITS[firma.plan] ?? 100;
  const ahora = new Date();

  // Resetear contador si entramos en un nuevo mes
  if (!firma.aiConsultasResetEn || firma.aiConsultasResetEn <= ahora) {
    const proximoMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
    await prisma.firma.update({
      where: { id: firmaId },
      data: { aiConsultasMes: 0, aiConsultasResetEn: proximoMes },
    });
    firma.aiConsultasMes = 0;
  }

  if (limite !== -1 && firma.aiConsultasMes >= limite) {
    throw new AppError(
      `Has alcanzado el límite de ${limite} consultas IA este mes. Actualiza tu plan para continuar.`,
      429,
    );
  }

  await prisma.firma.update({
    where: { id: firmaId },
    data: { aiConsultasMes: { increment: 1 } },
  });

  return { consultasUsadas: firma.aiConsultasMes + 1, limite };
}

export const consultar = async ({ mensaje, casoId, historial = [], incluirDocumentos = false, firmaId }) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AppError('El asistente IA no está configurado. Configure ANTHROPIC_API_KEY en el servidor.', 503);
  }

  const uso = firmaId ? await verificarYIncrementarLimite(firmaId) : null;

  let caso = null;
  let documentosConTexto = [];

  if (casoId) {
    caso = await prisma.caso.findUnique({
      where: { id: casoId },
      select: {
        numero: true, titulo: true, tipo: true, estado: true,
        juzgado: true, juez: true, contraparte: true, descripcion: true,
        cliente:  { select: { nombre: true } },
        abogado:  { select: { nombre: true } },
        audiencias: {
          where: { estado: 'PENDIENTE' },
          orderBy: { fecha: 'asc' },
          take: 5,
          select: { titulo: true, fecha: true, hora: true, estado: true },
        },
        terminos: {
          where: { estado: 'PENDIENTE' },
          orderBy: { fechaVence: 'asc' },
          take: 5,
          select: { descripcion: true, fechaVence: true, estado: true },
        },
        documentos: {
          orderBy: { fechaSubida: 'desc' },
          select: { id: true, nombre: true, tipo: true, archivo: true, mimeType: true },
        },
      },
    });

    if (caso && incluirDocumentos && caso.documentos?.length) {
      const extracciones = await Promise.all(
        caso.documentos.map(async (doc) => {
          const texto = await extraerTexto(doc.archivo, doc.mimeType);
          return texto ? { nombre: doc.nombre, texto } : null;
        }),
      );
      documentosConTexto = extracciones.filter(Boolean);
    }
  }

  const contexto = buildCasoContext(caso, documentosConTexto);
  const systemFinal = contexto ? `${SYSTEM_PROMPT}${contexto}` : SYSTEM_PROMPT;

  const mensajesAnteriores = historial.slice(-20).map((m) => ({
    role: m.rol === 'assistant' ? 'assistant' : 'user',
    content: m.contenido,
  }));

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemFinal,
    messages: [
      ...mensajesAnteriores,
      { role: 'user', content: mensaje },
    ],
  });

  const respuesta = response.content[0]?.text ?? '';
  return {
    respuesta,
    modelo: MODEL,
    docsLeidos: documentosConTexto.length,
    uso: uso ?? undefined,
  };
};
