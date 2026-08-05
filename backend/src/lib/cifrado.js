import crypto from 'crypto';

/**
 * Cifrado simétrico para secretos que SÍ hay que poder recuperar en claro
 * (a diferencia de las API keys, que se hashean y nunca se descifran).
 *
 * Caso de uso: el refresh token de Google. Necesitamos el valor original para
 * pedirle access tokens a Google, así que hashearlo no sirve — hay que cifrarlo.
 *
 * AES-256-GCM y no CBC a propósito: GCM es autenticado, o sea que detecta si el
 * ciphertext fue alterado en la base en vez de descifrar basura silenciosamente.
 */

const ALGORITMO = 'aes-256-gcm';
const VERSION = 'v1';
const BYTES_IV = 12;  // 96 bits — el tamaño recomendado para GCM
const BYTES_TAG = 16;

let claveCache = null;

const obtenerClave = () => {
  if (claveCache) return claveCache;

  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY no está definida. Generá una con: ' +
      "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }

  const clave = Buffer.from(raw, 'base64');
  if (clave.length !== 32) {
    throw new Error(`ENCRYPTION_KEY debe ser de 32 bytes en base64 (son ${clave.length}).`);
  }

  claveCache = clave;
  return clave;
};

/**
 * Devuelve "v1.<iv>.<tag>.<ciphertext>", todo en base64url.
 * El prefijo de versión permite rotar el algoritmo más adelante sin romper
 * lo que ya está guardado en la base.
 */
export const cifrar = (textoPlano) => {
  if (textoPlano == null || textoPlano === '') return null;

  const iv = crypto.randomBytes(BYTES_IV);
  const cipher = crypto.createCipheriv(ALGORITMO, obtenerClave(), iv);
  const cifrado = Buffer.concat([cipher.update(String(textoPlano), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    cifrado.toString('base64url'),
  ].join('.');
};

export const descifrar = (valor) => {
  if (!valor) return null;

  const partes = String(valor).split('.');
  if (partes.length !== 4 || partes[0] !== VERSION) {
    throw new Error('Valor cifrado con formato inválido o versión desconocida.');
  }

  const [, ivB64, tagB64, datosB64] = partes;
  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  if (iv.length !== BYTES_IV || tag.length !== BYTES_TAG) {
    throw new Error('Valor cifrado corrupto: IV o tag con tamaño inesperado.');
  }

  const decipher = crypto.createDecipheriv(ALGORITMO, obtenerClave(), iv);
  decipher.setAuthTag(tag);

  // Si alguien alteró el ciphertext, final() tira acá en vez de devolver basura.
  return Buffer.concat([
    decipher.update(Buffer.from(datosB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};

/** Chequeo de arranque: falla temprano y claro si la clave no está bien configurada. */
export const verificarConfiguracionCifrado = () => {
  const prueba = 'gestarlex';
  if (descifrar(cifrar(prueba)) !== prueba) {
    throw new Error('El cifrado no está funcionando correctamente.');
  }
  return true;
};
