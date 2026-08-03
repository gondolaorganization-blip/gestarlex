import crypto from 'crypto';

const PREFIJO = 'glx';
const BYTES_ENTROPIA = 32; // 256 bits

/**
 * Genera una API key nueva.
 * Devuelve el valor en claro (se muestra UNA sola vez) y lo que se persiste.
 */
export const generarApiKey = () => {
  const secreto = crypto.randomBytes(BYTES_ENTROPIA).toString('base64url');
  const valor = `${PREFIJO}_${secreto}`;
  return {
    valor,
    prefijo: valor.slice(0, 12),
    hash: hashApiKey(valor),
  };
};

/**
 * SHA-256 — no bcrypt a propósito: la key se verifica en cada request y bcrypt
 * agregaría ~100ms por llamada. Con 256 bits de entropía aleatoria no hay
 * diccionario que atacar, así que un hash rápido es la elección correcta.
 */
export const hashApiKey = (valor) =>
  crypto.createHash('sha256').update(valor).digest('hex');

export const esFormatoValido = (valor) =>
  typeof valor === 'string' && valor.startsWith(`${PREFIJO}_`) && valor.length > 20;
