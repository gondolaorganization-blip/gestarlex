import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AppError } from '../utils/errors.js';

const MAX_MB = Number(process.env.MAX_FILE_SIZE_MB || 25);
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Tipos MIME permitidos para documentos legales
const MIME_PERMITIDOS = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
]);

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    // Organizar: uploads/{firmaId}/{casoId}/
    const firmaId = req.user?.firmaId || 'unknown';
    const casoId = req.params.casoId || 'general';
    const dir = path.join(UPLOAD_DIR, firmaId, casoId);

    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 60);
    const ts = Date.now();
    cb(null, `${ts}-${base}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (MIME_PERMITIDOS.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`Tipo de archivo no permitido: ${file.mimetype}. Use PDF, Word, Excel o imágenes.`, 415));
  }
};

export const uploadDocumento = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
}).single('archivo');

// Wrapper que convierte errores de multer a AppError
export const handleUpload = (req, res, next) => {
  uploadDocumento(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(`El archivo supera el límite de ${MAX_MB}MB.`, 413));
    }
    next(err);
  });
};
