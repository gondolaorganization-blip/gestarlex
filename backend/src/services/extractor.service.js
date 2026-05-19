import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const MAX_CHARS = 8000; // límite por documento para no saturar el contexto

export async function extraerTexto(rutaArchivo, mimeType) {
  const absPath = path.resolve(rutaArchivo);
  if (!fs.existsSync(absPath)) return null;

  const ext = path.extname(absPath).toLowerCase();

  try {
    if (ext === '.docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ path: absPath });
      return result.value?.slice(0, MAX_CHARS) ?? null;
    }

    if (ext === '.pdf' || mimeType === 'application/pdf') {
      const buffer = fs.readFileSync(absPath);
      const result = await pdfParse(buffer);
      return result.text?.slice(0, MAX_CHARS) ?? null;
    }

    if (['.txt', '.md', '.csv'].includes(ext) || (mimeType && mimeType.startsWith('text/'))) {
      const text = fs.readFileSync(absPath, 'utf-8');
      return text.slice(0, MAX_CHARS);
    }

    return null; // tipo no soportado (imagen, binario, etc.)
  } catch {
    return null;
  }
}
