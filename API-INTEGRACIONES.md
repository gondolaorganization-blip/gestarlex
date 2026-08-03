# GESTARLEX — API interna de integraciones

**Documento para revisión.** Contiene el contexto, las decisiones de diseño y el código
completo de una API interna agregada al backend de GESTARLEX. El objetivo de la revisión
es detectar qué falta, qué está mal planteado y qué riesgos quedaron abiertos.

Estado: implementado, revisado externamente, corregido y **desplegado en producción**.
Base de la API: **`https://gestarlex-backend.onrender.com/api/integraciones`**.

## 0. Cambios de la ronda de revisión (v2)

Una revisión externa señaló cuatro puntos a corregir antes del deploy. Los cuatro están
aplicados y verificados:

| # | Corrección | Estado |
|---|---|---|
| 1 | Rate limit por IP **antes** de autenticar (300/min) + `trust proxy` | ✅ hecho y probado |
| 2 | Resolver el deploy de la migración (P3009 local + vía de producción) | ✅ resuelto |
| 3 | Render del historial con `estadoAntes === estadoDespues` | ✅ hecho y probado |
| 4 | Auditoría mínima: escrituras vía API key distinguibles | ✅ hecho y probado |

Aceptados como deuda para v1, **no tocados**: scopes más granulares, rotación de keys,
rate limit en Redis. El sync de calendario con Google es un trabajo aparte, posterior.

---

## 1. Contexto del proyecto

GESTARLEX es un SaaS de gestión para firmas de abogados en Panamá.

- **Backend**: Node 22 + Express 4 (ESM, `"type": "module"`) + Prisma 5 + PostgreSQL
- **Frontend**: React + Vite (no se tocó en este trabajo)
- **Deploy**: dos servicios separados en Render —
  **backend `https://gestarlex-backend.onrender.com`** y frontend estático
  `https://gestarlex.onrender.com`. Ambos siguen la rama `main` con autodeploy.
  También hay un `docker-compose.prod.yml` para VPS con nginx.
- **Multi-tenant**: todo cuelga de `firmaId`. Una firma = un despacho de abogados.

### 1.1 Cómo se aplica el schema en producción (era el bloqueante)

Había dos rutas de arranque que hacían cosas distintas: `package.json` define
`start:prod = prisma db push --skip-generate && node src/index.js`, y el `Dockerfile`
corría `prisma migrate deploy`. Cuál usaba Render no estaba confirmado, y de eso dependía
que la tabla `api_keys` se creara o no.

**Evidencia encontrada en el historial de git:** el commit que introdujo `start:prod`
dice explícitamente *"start:prod sincroniza el esquema (prisma db push) antes de
arrancar"*, y un commit anterior (`fix(deploy): move prisma CLI to dependencies so it is
available after npm ci --omit=dev`) existe para que el CLI de Prisma esté disponible en
runtime. Si Render usara el Dockerfile, su `CMD` ya corría `migrate deploy` y `start:prod`
no habría hecho falta. Conclusión: **Render corre `npm run start:prod`**, que hace
`db push`.

**Confirmado en producción:** tras el push del commit `74646c9`, el autodeploy corrió y la
tabla `api_keys` quedó creada sin intervención manual. La prueba: una key con formato
válido pero inexistente devuelve `401 {"message":"API key inválida."}` — o sea, la consulta
a `api_keys` se ejecutó. Si la tabla no existiera, Prisma habría lanzado un 500.

**Para que la respuesta no dependa de esa inferencia**, el `CMD` del Dockerfile se cambió
a `npm run start:prod`. Ahora las dos vías hacen exactamente lo mismo y el resultado es el
mismo se despliegue por donde se despliegue.

Esto además elimina un riesgo que no era obvio: la base local tenía el historial de
migraciones incompleto (solo `init` registrado; el resto aplicado con `db push`). Si la
base de producción está igual — y es probable, porque viene del mismo flujo de trabajo —
un `migrate deploy` habría intentado aplicar cinco migraciones sobre objetos ya
existentes, fallando y **dejando el contenedor sin arrancar**. Con las dos vías en
`db push`, ese escenario desaparece.

**Limpieza del historial local (P3009):** se verificó que el contenido de las cinco
migraciones no registradas estuviera realmente en la base (columnas y tablas presentes) y
recién entonces se marcaron con `prisma migrate resolve --applied`. Hoy
`prisma migrate status` responde *"Database schema is up to date!"* y `migrate deploy` es
un no-op.

### 1.2 Cuál es la URL del backend (ojo, hay dos servicios)

Son **dos servicios distintos en Render**, y confundirlos cuesta caro:

| Servicio | URL | Qué sirve |
|---|---|---|
| `gestarlex-backend` | **`https://gestarlex-backend.onrender.com`** | La API. Es la que usan las automatizaciones. |
| frontend estático | `https://gestarlex.onrender.com` | El SPA de React. **No expone la API.** |

El host del frontend devuelve `200` con el HTML del SPA en *cualquier* path, incluidos
`/health` y `/api/...`, porque es el *fallback* de un sitio estático. Una automatización
apuntada ahí recibiría HTML en vez de JSON, sin ningún error que explique por qué. El SPA
llama a `/api` en el mismo origen (`src/api/client.js`) contando con un proxy, que es la
topología del VPS con nginx (`frontend/nginx.conf`), no la de este host.

**Regla práctica:** si `GET /health` no devuelve `{"status":"ok",...}` en JSON, estás
apuntando al servicio equivocado.

---

## 2. Qué se pidió

Una API interna para que dos automatizaciones —una corriendo en Claude Code en una
laptop, y un skill de Claude usado desde el celular— puedan leer y actualizar casos sin
pasar por la interfaz web.

Requisitos explícitos:

1. Leer casos activos y su estado
2. Actualizar estado y "última actividad"
3. Agregar notas de pendiente
4. Referenciar documentos nuevos por caso, si el modelo lo permitía
5. **Autenticación por API key propia**, no con el login del usuario
6. **Permisos de lectura y actualización — nunca borrar**
7. **Limitada a los datos de la firma del dueño de la key** (es multi-tenant)
8. **Alcanzable por internet**, no solo en local

---

## 3. Arquitectura existente que se reusó

### 3.1 Patrón por dominio

Cada área del sistema sigue `routes → controller → service`:

- El **router** aplica middlewares y envuelve los handlers en `asyncHandler`
- El **controller** valida con **zod** y responde con helpers (`ok`, `created`) que
  producen `{ok: true, data}` / `{ok: false, message}`
- El **service** tiene la lógica y habla con Prisma
- Los errores son clases tipadas (`AppError`, `NotFoundError`, `ForbiddenError`,
  `ValidationError`, `SubscriptionError`) que un `errorHandler` global traduce a HTTP

**Punto clave para este diseño:** los services reciben un objeto `user` plano
`{ sub, firmaId, rol }` y no saben nada de JWT. Por eso una API key puede reusarlos
tal cual, sin duplicar reglas de negocio ni de aislamiento.

### 3.2 Autenticación existente (tres capas)

```
authenticate      → JWT Bearer HS256 con JWT_SECRET. Deja req.user = {sub, firmaId, rol, nombre}
verificarAcceso   → capa SaaS: firma activa + suscripción ACTIVO / TRIAL vigente / accessManual
minRol/authorize  → jerarquía ADMIN(4) > SOCIO(3) > ASOCIADO(2) > PASANTE(1)
```

Hay además un canal separado de superadmin (`adminAuthenticate`) que usa el mismo
`JWT_SECRET` pero exige `payload.role === 'superadmin'`.

### 3.3 Aislamiento multi-tenant existente

Los services filtran por `firmaId` en cada consulta, y `casos.service.js` tiene un
chequeo explícito `caso.firmaId !== user.firmaId → ForbiddenError`. Los usuarios con rol
`PASANTE` solo alcanzan casos asignados a ellos.

### 3.4 Modelos relevantes

| Modelo | Campos que importan |
|---|---|
| `Caso` | `estado` enum `ACTIVO/SUSPENDIDO/CERRADO/ARCHIVADO`, `updatedAt` automático. **No tiene campo de "última actividad"** |
| `CasoHistorial` | `estadoAntes`, `estadoDespues`, `nota`, `fecha`, `abogadoId`. Es la bitácora que alimenta el timeline de la web |
| `Tarea` | `casoId`, `abogadoId`, `descripcion`, `fechaLimite`, `estado`, `prioridad`, `notas` |
| `Documento` | `archivo` está documentado en el schema como **"path o URL"** — el modelo ya permitía referenciar algo externo sin subir binario |

---

## 4. Decisiones de diseño

### 4.1 Dónde enganchar la API key — tres opciones evaluadas

**Opción A — Aceptar la API key dentro del `authenticate` existente.**
Si viene `X-API-Key`, se resuelve y se construye el mismo `req.user`. Cero endpoints
nuevos, toda la API queda disponible.
*Descartada*: expone también los `DELETE` que ya existen en casos, documentos y tareas.
Se podría bloquear por método HTTP, pero es un guard frágil: cualquier ruta futura queda
expuesta por defecto.

**Opción B — Router separado que reusa los services. ✅ ELEGIDA**
Un router nuevo en `/api/integraciones` con su propio middleware. La key se resuelve a
`{sub, firmaId, rol}` y se lo pasa a los services existentes, así que el aislamiento por
firma y las reglas de rol siguen funcionando sin duplicar lógica.
El "nunca borrar" no es un permiso que se chequea: **es superficie que no existe**.

**Opción C — JWT de larga duración con claim `scope: 'automation'`.**
Cero migración. *Descartada*: no es revocable sin rotar `JWT_SECRET` (lo cual invalida
las sesiones de todos los usuarios del SaaS), no permite varias keys, y no deja auditoría.

### 4.2 Dónde vive la key — modelo en DB (elegido) vs variable de entorno

Se eligió un **modelo `ApiKey` en la base**. Permite varias keys (una por dispositivo),
revocación inmediata, registro de último uso, y queda listo si algún día se ofrece como
feature a los clientes del SaaS. Costo: una migración.

La alternativa era una variable de entorno (`AUTOMATION_API_KEY`), sin migración, pero
rotar la key implicaría un redeploy y solo serviría para un usuario.

### 4.3 Hash: SHA-256, no bcrypt — decisión deliberada

La key se verifica en **cada request**; bcrypt agregaría ~100ms por llamada. Como el
secreto tiene 256 bits de entropía aleatoria (no es una contraseña elegida por humano),
no hay diccionario que atacar y un hash rápido es la elección correcta. La búsqueda es
por índice único sobre el hash, así que tampoco hay comparación vulnerable a timing.

### 4.4 "Última actividad" — se reusó `CasoHistorial`, sin campo nuevo

Se descartó agregar `ultimaActividadEn` al modelo `Caso`. En su lugar, registrar
actividad escribe una entrada de `CasoHistorial` con `estadoAntes === estadoDespues`
(el estado actual) y refresca `updatedAt`.

Ventaja: la nota aparece automáticamente en el timeline que la web ya muestra, sin tocar
frontend ni migrar. **Punto a revisar:** ¿es un abuso semántico del historial de estados?

### 4.5 Documentos — solo referencia por URL

No se agregó subida de binarios. El campo `archivo` acepta URL, así que la automatización
manda `nombre` + `url` en JSON. Se respeta el versionado automático que ya existía (si el
nombre se repite, `version` incrementa).

Razón adicional: el disco de Render es efímero salvo que haya un disco persistente
montado, así que subir binarios por esta vía sería frágil.

### 4.6 Gestión de keys con el login normal, no con API key

Los endpoints para crear/listar/revocar keys están detrás del JWT normal y exigen rol
`SOCIO` o superior. **Una API key no puede crear ni ampliar otra API key** — no hay
escalada de privilegios por esa vía. Además así se crea la primera key con un simple
curl, sin necesitar acceso de shell en Render.

### 4.7 Rate limit en dos niveles (corregido en v2)

La primera versión tenía el limitador **después** de `apiKeyAuth`, así que una ráfaga con
keys inválidas nunca lo alcanzaba y cada request disparaba una consulta a la base sin
techo. Ahora hay dos barreras:

1. **Por IP, antes de autenticar** — 300/min, en la raíz de `/api/integraciones`. Cubre
   también la gestión de keys. Corta el tráfico basura antes de tocar la base.
2. **Por key, ya autenticado** — 60/min, para acotar el uso de cada automatización.

Requiere `app.set('trust proxy', 1)` para que `req.ip` sea la IP real del cliente. Se usa
`1` y no `true` a propósito: confiar en todos los saltos permitiría falsear la IP vía
`X-Forwarded-For`. Se verificó que `req.ip` no se usa en ninguna otra parte del backend,
así que el cambio no tiene efectos colaterales.

### 4.8 Revocación lógica, no borrado

`POST /keys/:id/revocar` marca `activa: false` + `revocadaEn`. No hay `DELETE` tampoco
acá: queda el rastro de que la key existió.

### 4.9 Marca de origen en el historial (corregido en v2)

Las notas escritas vía API key se guardan con el prefijo `[API: <nombre de la key>]`, de
modo que en el historial y el timeline se distingue lo hecho por una automatización de lo
hecho desde la web. El autor (`abogadoId`) ya lo registraba el service.

Se implementó **en el controller de integraciones**, no en `casos.service`, para no alterar
el comportamiento de la web, que comparte ese service. Hay un test de regresión que lo
comprueba.

Alcance: cubre las operaciones que escriben en `CasoHistorial` (cambio de estado y
actividad). Las tareas y los documentos creados vía API **no llevan marca** — haría falta
una columna `origen` para eso. Ver punto 8.7.

---

## 5. Superficie de la API

Base en producción: **`https://gestarlex-backend.onrender.com/api/integraciones`**
(en local: `http://localhost:3099/api/integraciones`)

### Gestión de keys — autenticado con **JWT normal**, rol SOCIO+

```
GET  /keys              listar (nunca devuelve el hash ni el valor)
POST /keys              crear — devuelve el valor en claro UNA sola vez
POST /keys/:id/revocar  revocación lógica
```

### Automatizaciones — autenticado con **API key**

```
GET   /ping                        verificar la key y ver como quién actúa
GET   /casos?estado=ACTIVO         (ACTIVO por defecto; estado=TODOS para todos)
GET   /casos/:id
GET   /casos/:id/timeline
GET   /pendientes                  bandeja global de tareas no completadas
PATCH /casos/:id/estado            { estado, nota? }
PATCH /casos/:id/actividad         { nota }
POST  /casos/:id/pendientes        { descripcion, fechaLimite?, prioridad?, notas? }
POST  /casos/:id/documentos        { nombre, url, tipo?, descripcion?, confidencial? }
```

**No hay ninguna ruta DELETE, y no es un olvido: es el límite del diseño.**

Scopes: `casos:read` y `casos:write`. No existe un scope de borrado.

La key se manda en el header `X-API-Key`, o como `Authorization: Bearer glx_...`.

---

## 6. Código completo

### 6.1 Modelo nuevo en `backend/prisma/schema.prisma`

Se agregó el modelo `ApiKey` y las relaciones inversas en `Firma` y `Abogado`:

```prisma
model ApiKey {
  id          String    @id @default(cuid())
  firmaId     String
  abogadoId   String    // a quién se le atribuyen las escrituras hechas con esta key
  nombre      String    // "laptop", "celular", etc. — para saber cuál revocar
  prefijo     String    // primeros caracteres visibles, para identificarla sin exponerla
  hash        String    @unique // SHA-256 de la key completa; el valor en claro no se guarda
  scopes      String[]  @default(["casos:read"]) // casos:read | casos:write — nunca borrado
  activa      Boolean   @default(true)
  ultimoUsoEn DateTime?
  expiraEn    DateTime?
  revocadaEn  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  firma   Firma   @relation(fields: [firmaId], references: [id], onDelete: Cascade)
  abogado Abogado @relation(fields: [abogadoId], references: [id], onDelete: Cascade)

  @@index([firmaId])
  @@map("api_keys")
}
```

Más las dos líneas de relación inversa (`apiKeys ApiKey[]`) en `Firma` y `Abogado`.

### 6.2 Migración `backend/prisma/migrations/20260802000001_add_api_keys/migration.sql`

```sql
-- CreateTable: credenciales para automatizaciones externas
CREATE TABLE "api_keys" (
    "id"          TEXT NOT NULL,
    "firmaId"     TEXT NOT NULL,
    "abogadoId"   TEXT NOT NULL,
    "nombre"      TEXT NOT NULL,
    "prefijo"     TEXT NOT NULL,
    "hash"        TEXT NOT NULL,
    "scopes"      TEXT[] DEFAULT ARRAY['casos:read']::TEXT[],
    "activa"      BOOLEAN NOT NULL DEFAULT true,
    "ultimoUsoEn" TIMESTAMP(3),
    "expiraEn"    TIMESTAMP(3),
    "revocadaEn"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_hash_key" ON "api_keys"("hash");

-- CreateIndex
CREATE INDEX "api_keys_firmaId_idx" ON "api_keys"("firmaId");

-- AddForeignKey
ALTER TABLE "api_keys"
  ADD CONSTRAINT "api_keys_firmaId_fkey"
  FOREIGN KEY ("firmaId") REFERENCES "firmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys"
  ADD CONSTRAINT "api_keys_abogadoId_fkey"
  FOREIGN KEY ("abogadoId") REFERENCES "abogados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### 6.3 `backend/src/lib/apiKeys.js`

```js
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
```

### 6.4 `backend/src/middleware/apiKey.js`

```js
import prisma from '../lib/prisma.js';
import { hashApiKey, esFormatoValido } from '../lib/apiKeys.js';
import { UnauthorizedError, ForbiddenError, AppError } from '../utils/errors.js';

// Solo se actualiza ultimoUsoEn si pasó este tiempo, para no escribir en cada request
const INTERVALO_REGISTRO_USO_MS = 60_000;

/**
 * Autentica una automatización externa mediante API key.
 *
 * Acepta la key en el header `X-API-Key` o en `Authorization: Bearer glx_...`.
 * Deja en req.user el mismo shape que produce el JWT ({ sub, firmaId, rol, nombre }),
 * de modo que los services existentes aplican sus reglas de firma y rol sin cambios.
 */
export const apiKeyAuth = async (req, _res, next) => {
  try {
    const header = req.headers['x-api-key'];
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    const valor = header || (esFormatoValido(bearer) ? bearer : null);

    if (!valor) throw new UnauthorizedError('API key no proporcionada.');
    if (!esFormatoValido(valor)) throw new UnauthorizedError('API key inválida.');

    const apiKey = await prisma.apiKey.findUnique({
      where: { hash: hashApiKey(valor) },
      include: {
        abogado: { select: { id: true, nombre: true, rol: true, activo: true, firmaId: true } },
      },
    });

    // Mismo mensaje para key inexistente, revocada o vencida — no damos pistas
    if (!apiKey || !apiKey.activa || apiKey.revocadaEn) {
      throw new UnauthorizedError('API key inválida.');
    }
    if (apiKey.expiraEn && apiKey.expiraEn <= new Date()) {
      throw new UnauthorizedError('API key inválida.');
    }
    if (!apiKey.abogado?.activo) {
      throw new ForbiddenError('El usuario asociado a esta API key está desactivado.');
    }

    req.user = {
      sub: apiKey.abogadoId,
      firmaId: apiKey.firmaId,
      rol: apiKey.abogado.rol,
      nombre: apiKey.abogado.nombre,
      viaApiKey: true,
    };
    req.apiKey = { id: apiKey.id, nombre: apiKey.nombre, scopes: apiKey.scopes };

    // Registro de uso en segundo plano — nunca debe hacer fallar el request
    const desactualizado =
      !apiKey.ultimoUsoEn || Date.now() - apiKey.ultimoUsoEn.getTime() > INTERVALO_REGISTRO_USO_MS;
    if (desactualizado) {
      prisma.apiKey
        .update({ where: { id: apiKey.id }, data: { ultimoUsoEn: new Date() } })
        .catch(() => {});
    }

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Exige que la key tenga el scope indicado.
 * El borrado no existe como scope: no hay rutas de borrado en este router.
 */
export const requireScope = (scope) => (req, _res, next) => {
  if (!req.apiKey) return next(new UnauthorizedError('No autenticado por API key.'));
  if (!req.apiKey.scopes.includes(scope)) {
    return next(new ForbiddenError(`Esta API key no tiene el permiso "${scope}".`));
  }
  next();
};

/**
 * Rate limit en memoria. Suficiente para una sola instancia; con varias, mover a Redis.
 *
 * `clave` decide contra qué se cuenta. Se usa en dos niveles:
 *   - por IP, ANTES de autenticar, para que una ráfaga de keys inválidas no dispare
 *     una consulta a la base por request;
 *   - por key, DESPUÉS de autenticar, para acotar el uso de cada automatización.
 * Requiere `trust proxy` en Express para que req.ip sea la IP real del cliente.
 */
export const rateLimit = ({ max = 60, ventanaMs = 60_000, clave } = {}) => {
  const golpes = new Map();
  const obtenerClave = clave || ((req) => req.apiKey?.id || req.ip || 'desconocido');

  return (req, res, next) => {
    const ahora = Date.now();
    const id = obtenerClave(req);
    const registro = golpes.get(id);

    if (!registro || ahora > registro.reinicia) {
      golpes.set(id, { conteo: 1, reinicia: ahora + ventanaMs });
    } else if (registro.conteo >= max) {
      res.setHeader('Retry-After', Math.ceil((registro.reinicia - ahora) / 1000));
      return next(new AppError('Demasiadas peticiones. Intenta de nuevo en un momento.', 429));
    } else {
      registro.conteo += 1;
    }

    // Limpieza perezosa para que el Map no crezca sin límite
    if (golpes.size > 500) {
      for (const [k, v] of golpes) if (ahora > v.reinicia) golpes.delete(k);
    }

    next();
  };
};
```

### 6.5 `backend/src/services/apiKeys.service.js`

```js
import prisma from '../lib/prisma.js';
import { generarApiKey } from '../lib/apiKeys.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

// Permisos disponibles. No existe un scope de borrado a propósito:
// el router de integraciones no expone ninguna ruta que borre.
export const SCOPES_VALIDOS = ['casos:read', 'casos:write'];

const selectPublico = {
  id: true,
  nombre: true,
  prefijo: true,
  scopes: true,
  activa: true,
  ultimoUsoEn: true,
  expiraEn: true,
  revocadaEn: true,
  createdAt: true,
  abogado: { select: { id: true, nombre: true } },
};

// ─── CREAR ────────────────────────────────────────────────────────────────────

export const crear = async (firmaId, datos, user) => {
  const scopes = datos.scopes?.length ? datos.scopes : ['casos:read'];
  const invalidos = scopes.filter((s) => !SCOPES_VALIDOS.includes(s));
  if (invalidos.length) {
    throw new ValidationError(
      `Permisos no válidos: ${invalidos.join(', ')}. Disponibles: ${SCOPES_VALIDOS.join(', ')}.`,
    );
  }

  // La key actúa en nombre de un abogado — por defecto, quien la crea
  const abogadoId = datos.abogadoId || user.sub;
  const abogado = await prisma.abogado.findFirst({ where: { id: abogadoId, firmaId } });
  if (!abogado) throw new NotFoundError('Abogado no encontrado en esta firma.');

  const { valor, prefijo, hash } = generarApiKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      firmaId,
      abogadoId,
      nombre: datos.nombre,
      prefijo,
      hash,
      scopes,
      expiraEn: datos.expiraEn ? new Date(datos.expiraEn) : null,
    },
    select: selectPublico,
  });

  // `valor` se devuelve una única vez: no queda guardado en ningún lado
  return { ...apiKey, valor };
};

// ─── LISTAR ───────────────────────────────────────────────────────────────────

export const listar = async (firmaId) =>
  prisma.apiKey.findMany({
    where: { firmaId },
    select: selectPublico,
    orderBy: { createdAt: 'desc' },
  });

// ─── REVOCAR ──────────────────────────────────────────────────────────────────

// Revocación lógica, no borrado: la key deja de funcionar pero queda el rastro.
export const revocar = async (id, firmaId) => {
  const apiKey = await prisma.apiKey.findFirst({ where: { id, firmaId } });
  if (!apiKey) throw new NotFoundError('API key no encontrada.');

  return prisma.apiKey.update({
    where: { id },
    data: { activa: false, revocadaEn: new Date() },
    select: selectPublico,
  });
};
```

### 6.6 `backend/src/services/integraciones.service.js`

```js
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
```

### 6.7 `backend/src/controllers/integraciones.controller.js`

```js
import { z } from 'zod';
import * as casosSvc from '../services/casos.service.js';
import * as tareasSvc from '../services/tareas.service.js';
import * as integracionesSvc from '../services/integraciones.service.js';
import * as apiKeysSvc from '../services/apiKeys.service.js';
import { ok, created } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

const ESTADOS = ['ACTIVO', 'SUSPENDIDO', 'CERRADO', 'ARCHIVADO'];
const MAX_POR_PAGINA = 100;

const parsear = (schema, body, mensaje) => {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError(mensaje, result.error.flatten().fieldErrors);
  return result.data;
};

/**
 * Marca la nota con el nombre de la key que la originó, para que en el historial se
 * distinga lo escrito por una automatización de lo escrito desde la web.
 * El autor (abogadoId) ya queda registrado por el service; esto agrega el "por dónde".
 */
const conOrigen = (req, nota) => `[API: ${req.apiKey.nombre}] ${nota ?? ''}`.trimEnd();

// ─── SCHEMAS ──────────────────────────────────────────────────────────────────

const cambiarEstadoSchema = z.object({
  estado: z.enum(ESTADOS),
  nota: z.string().max(1000).optional(),
});

const actividadSchema = z.object({
  nota: z.string().min(3, 'La nota es requerida.').max(1000),
});

const pendienteSchema = z.object({
  descripcion: z.string().min(3, 'Descripción requerida.').max(500),
  fechaLimite: z.string().optional(),
  prioridad: z.enum(['ALTA', 'MEDIA', 'BAJA']).optional(),
  notas: z.string().max(1000).optional(),
  abogadoId: z.string().optional(),
});

const documentoSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido.').max(200),
  // Solo http/https: evita guardar file:// o javascript: que luego se renderizan como enlace
  url: z
    .string()
    .url('Debe ser una URL válida.')
    .refine((v) => /^https?:\/\//i.test(v), 'La URL debe empezar con http:// o https://'),
  tipo: z.string().max(60).optional(),
  descripcion: z.string().max(1000).optional(),
  confidencial: z.boolean().optional(),
});

const crearKeySchema = z.object({
  nombre: z.string().min(2, 'Ponle un nombre para saber cuál revocar después.').max(60),
  scopes: z.array(z.enum(apiKeysSvc.SCOPES_VALIDOS)).optional(),
  abogadoId: z.string().optional(),
  expiraEn: z.string().datetime({ offset: true }).optional(),
});

// ─── DIAGNÓSTICO ──────────────────────────────────────────────────────────────

export const ping = async (req, res) => {
  ok(res, {
    autenticado: true,
    key: req.apiKey.nombre,
    scopes: req.apiKey.scopes,
    actuaComo: { abogadoId: req.user.sub, nombre: req.user.nombre, rol: req.user.rol },
    firmaId: req.user.firmaId,
  });
};

// ─── LECTURA ──────────────────────────────────────────────────────────────────

export const listarCasos = async (req, res) => {
  // Por defecto solo los activos; ?estado=TODOS trae todos
  const estadoQuery = req.query.estado ?? 'ACTIVO';
  if (estadoQuery !== 'TODOS' && !ESTADOS.includes(estadoQuery)) {
    throw new ValidationError(`Estado inválido. Usa: ${ESTADOS.join(', ')} o TODOS.`);
  }

  const porPagina = Math.min(Number(req.query.porPagina) || 20, MAX_POR_PAGINA);

  const data = await casosSvc.listar(req.user.firmaId, req.user, {
    estado: estadoQuery === 'TODOS' ? undefined : estadoQuery,
    tipo: req.query.tipo || undefined,
    busqueda: req.query.busqueda || undefined,
    clienteId: req.query.clienteId || undefined,
    pagina: Number(req.query.pagina) || 1,
    porPagina,
    ordenPor: 'updatedAt',
    direccion: 'desc',
  });

  ok(res, data);
};

export const obtenerCaso = async (req, res) => {
  const data = await casosSvc.obtener(req.params.id, req.user);
  ok(res, data);
};

export const timelineCaso = async (req, res) => {
  const data = await casosSvc.timeline(req.params.id, req.user);
  ok(res, data);
};

export const listarPendientes = async (req, res) => {
  const data = await tareasSvc.todasPendientes(req.user.firmaId, req.user, {
    abogadoId: req.query.abogadoId || undefined,
    prioridad: req.query.prioridad || undefined,
  });
  ok(res, data);
};

// ─── ACTUALIZACIÓN ────────────────────────────────────────────────────────────

export const cambiarEstado = async (req, res) => {
  const datos = parsear(cambiarEstadoSchema, req.body, 'Estado inválido.');
  const data = await casosSvc.cambiarEstado(
    req.params.id,
    datos.estado,
    conOrigen(req, datos.nota),
    req.user,
  );
  ok(res, data);
};

export const registrarActividad = async (req, res) => {
  const datos = parsear(actividadSchema, req.body, 'Nota de actividad inválida.');
  const data = await integracionesSvc.registrarActividad(
    req.params.id,
    conOrigen(req, datos.nota),
    req.user.firmaId,
    req.user,
  );
  created(res, data);
};

export const crearPendiente = async (req, res) => {
  const datos = parsear(pendienteSchema, req.body, 'Datos del pendiente inválidos.');
  const data = await tareasSvc.crear(req.params.id, datos, req.user.firmaId, req.user);
  created(res, data);
};

export const referenciarDocumento = async (req, res) => {
  const datos = parsear(documentoSchema, req.body, 'Datos del documento inválidos.');
  const data = await integracionesSvc.referenciarDocumento(
    req.params.id,
    datos,
    req.user.firmaId,
    req.user,
  );
  created(res, data);
};

// ─── GESTIÓN DE KEYS (con el login normal, no con API key) ────────────────────

export const crearKey = async (req, res) => {
  const datos = parsear(crearKeySchema, req.body, 'Datos de la API key inválidos.');
  const data = await apiKeysSvc.crear(req.user.firmaId, datos, req.user);
  created(res, {
    ...data,
    aviso: 'Guarda "valor" ahora: es la única vez que se muestra.',
  });
};

export const listarKeys = async (req, res) => {
  const data = await apiKeysSvc.listar(req.user.firmaId);
  ok(res, data);
};

export const revocarKey = async (req, res) => {
  const data = await apiKeysSvc.revocar(req.params.id, req.user.firmaId);
  ok(res, data);
};
```

### 6.8 `backend/src/routes/integraciones.routes.js`

```js
import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import { minRol } from '../middleware/roles.js';
import { apiKeyAuth, requireScope, rateLimit } from '../middleware/apiKey.js';
import * as ctrl from '../controllers/integraciones.controller.js';

const router = Router();

// Primera barrera, por IP y ANTES de autenticar: una ráfaga con keys inválidas nunca
// llega a consultar la base. El límite por key viene después, ya autenticado.
// Depende de `trust proxy` (configurado en index.js) para ver la IP real del cliente.
router.use(rateLimit({ max: 300, ventanaMs: 60_000, clave: (req) => req.ip || 'desconocido' }));

// ─── GESTIÓN DE KEYS ──────────────────────────────────────────────────────────
// Se administran con el login normal del abogado, no con una API key:
// una key no puede crear ni ampliar otras keys.

const keys = Router();
keys.use(authenticate, verificarAcceso, minRol('SOCIO'));

keys.get('/', asyncHandler(ctrl.listarKeys));
keys.post('/', asyncHandler(ctrl.crearKey));
keys.post('/:id/revocar', asyncHandler(ctrl.revocarKey));

router.use('/keys', keys);

// ─── API PARA AUTOMATIZACIONES ────────────────────────────────────────────────
// Autenticada por API key. verificarAcceso mantiene la regla de suscripción:
// si la firma está suspendida o vencida, la API tampoco responde.
//
// No hay rutas de borrado en este router, y no es un olvido: es el límite.

const automatizaciones = Router();
automatizaciones.use(apiKeyAuth, rateLimit({ max: 60, ventanaMs: 60_000 }), verificarAcceso);

automatizaciones.get('/ping', asyncHandler(ctrl.ping));

// Lectura
automatizaciones.get('/casos', requireScope('casos:read'), asyncHandler(ctrl.listarCasos));
automatizaciones.get('/casos/:id', requireScope('casos:read'), asyncHandler(ctrl.obtenerCaso));
automatizaciones.get('/casos/:id/timeline', requireScope('casos:read'), asyncHandler(ctrl.timelineCaso));
automatizaciones.get('/pendientes', requireScope('casos:read'), asyncHandler(ctrl.listarPendientes));

// Actualización
automatizaciones.patch('/casos/:id/estado', requireScope('casos:write'), asyncHandler(ctrl.cambiarEstado));
automatizaciones.patch('/casos/:id/actividad', requireScope('casos:write'), asyncHandler(ctrl.registrarActividad));
automatizaciones.post('/casos/:id/pendientes', requireScope('casos:write'), asyncHandler(ctrl.crearPendiente));
automatizaciones.post('/casos/:id/documentos', requireScope('casos:write'), asyncHandler(ctrl.referenciarDocumento));

router.use('/', automatizaciones);

export default router;
```

### 6.9 Cambios en archivos que ya existían

La primera versión no tocaba ningún archivo existente salvo dos líneas en `index.js`.
Las correcciones de la v2 sumaron cuatro cambios acotados más. Todos los diffs:

**`backend/src/index.js`** — montaje del router y `trust proxy`:

```diff
```

**`backend/src/services/casos.service.js`** — solo el armado del timeline (el modelo no cambia):

```diff
```

**`frontend/src/pages/casos/tabs/TabTimeline.jsx`** — ícono para el tipo nuevo:

```diff
```

**`backend/Dockerfile`** — una sola definición del arranque de producción:

```diff
```

---

## 7. Qué se probó

El backend se levantó contra un PostgreSQL local con datos de seed (1 firma, 4 abogados,
3 casos) y se ejecutaron pruebas de punta a punta con curl. Todo lo siguiente corrió de
verdad, no es una lista de intenciones. Los artefactos de prueba se borraron después y la
base quedó como estaba.

### 7.1 Lectura
| Prueba | Resultado |
|---|---|
| `GET /ping` | 200 — devuelve key, scopes, abogado y firmaId |
| `GET /casos` (default) | 200 — 3 casos, todos ACTIVO |
| `GET /casos?estado=TODOS` | 200 |
| `GET /casos?estado=INVENTADO` | 422 con mensaje de estados válidos |
| `GET /casos/:id` | 200 — con contadores de tareas y documentos |
| `GET /pendientes` | 200 — 5 pendientes |

### 7.2 Escritura
| Prueba | Resultado |
|---|---|
| `PATCH /casos/:id/actividad` | 201 — historial con la nota, sin cambiar el estado |
| `POST /casos/:id/pendientes` | 201 — PENDIENTE/ALTA, atribuido al abogado de la key |
| `POST /casos/:id/documentos` | 201 — v1, `archivo` = la URL |
| Mismo nombre de documento otra vez | 201 — **v2**, versionado automático funcionando |
| `PATCH /casos/:id/estado` | 200 — cambió a SUSPENDIDO |
| Cambiar al estado que ya tenía | 422 — "El caso ya se encuentra en estado SUSPENDIDO" |

### 7.3 Seguridad
| Prueba | Resultado |
|---|---|
| Sin key | 401 |
| Key inventada con formato válido | 401 "API key inválida" |
| Key con formato basura | 401 (mismo mensaje, no da pistas) |
| Key `casos:read` intentando `PATCH estado` | **403** "no tiene el permiso casos:write" |
| Key `casos:read` haciendo `GET` | 200 |
| `DELETE /casos/:id` | **404 "Ruta no encontrada"** (la ruta no existe) |
| `DELETE /casos/:id/documentos` | **404** |
| API key intentando crear otra API key | **401** (ese router exige JWT) |
| URL `javascript:alert(1)` en documento | 422 rechazada por zod |
| Nota de actividad de 1 carácter | 422 |
| `GET /keys` | 200 — **no expone `hash` ni `valor`** |
| Key revocada | 401 inmediato |

### 7.4 Aislamiento multi-tenant
Se creó una **segunda firma** con su propio caso ("SECRETO-B-001") y desde la key de la
firma A se intentó alcanzarla:

| Intento desde firma A hacia caso de firma B | Resultado |
|---|---|
| `GET /casos/:id` | 403 |
| `GET /casos/:id/timeline` | 403 |
| `PATCH /casos/:id/estado` | 403 |
| `PATCH /casos/:id/actividad` | 404 |
| `POST /casos/:id/pendientes` | 404 |
| `POST /casos/:id/documentos` | 404 |
| `GET /casos?estado=TODOS` | 200 — 3 casos, **0 fugas** de la firma B |
| `GET /pendientes` | 200 — ninguno de la firma B |
| Asignar un pendiente a un abogado de la firma B | 404 "Abogado no encontrado" |

Verificado por SQL directo: **cero escrituras** en la firma B (historial 0, tareas 0,
documentos 0, estado del caso intacto).

### 7.5 Verificación de las correcciones de la v2

**Corrección 1 — rate limit por IP antes de autenticar.** Se dispararon 320 requests con
una key **inválida**. Resultado: 229×401 y luego **91×429**, con header `Retry-After`.
Antes del arreglo habrían sido 320 respuestas 401 y 320 consultas a la base. El límite por
key (60/min) se probó por separado y sigue funcionando.

**Corrección 3 — render del historial.** Tras registrar actividad sin cambio de estado, el
timeline devuelve:

```
[activity]   Actividad registrada: [API: laptop] Sin novedades del juzgado.
[git-branch] Estado: SUSPENDIDO → ACTIVO
[git-branch] Estado: ACTIVO → SUSPENDIDO
[git-branch] Estado inicial: ACTIVO
```

Entradas del tipo "ACTIVO → ACTIVO": **0**. El evento de actividad sale con `tipo:
'ACTIVIDAD'` e ícono propio, y el frontend tiene la entrada correspondiente en su mapa de
íconos.

**Corrección 4 — auditoría.** Las notas escritas vía API key quedan como
`[API: laptop] Sin novedades del juzgado.` **Test de regresión incluido:** la misma
operación hecha desde la web con el JWT normal guarda `Peritaje recibido, se reanuda.`,
sin marca. La vía web no se alteró.

**Corrección 2 — migraciones.** `prisma migrate status` responde *"Database schema is up
to date!"* y `prisma migrate deploy` es un no-op. Antes fallaba con P3009.

### 7.6 Verificación en producción

Tras el push del commit `74646c9`, Render autodesplegó. Contra
`https://gestarlex-backend.onrender.com`:

| Prueba | Resultado |
|---|---|
| `GET /health` | 200 JSON `{"status":"ok",…,"env":"production"}` en 0.43s |
| `GET /api/integraciones/ping` sin key | **401** `{"message":"API key no proporcionada."}` |
| `GET /api/integraciones/keys` sin JWT | 401 `{"message":"Token no proporcionado."}` |
| Key con formato válido pero inexistente | 401 `{"message":"API key inválida."}` |
| Key con formato basura | 401 (mismo mensaje, no da pistas) |

La cuarta fila es la que confirma que **la tabla `api_keys` se creó sola** con `db push`:
la consulta se ejecutó y no hubo 500.

### 7.7 Lo que NO se probó
- No se probó el comportamiento bajo cold start de Render (~50s cuando el servicio duerme).
- No se probó el `trust proxy` con un proxy real delante ni el rate limit en producción.
- No hay tests automatizados commiteados: la verificación fue manual vía scripts curl.

---

## 8. Estado de los huecos detectados

### 8.1 ✅ CORREGIDO — El rate limit corría después de la autenticación
Era el hallazgo más serio: keys inválidas sin techo, una consulta a la base por request.
Ahora hay un limitador por IP (300/min) **antes** de `apiKeyAuth`, además del de 60/min por
key. Ver 4.7 y la verificación en 7.5.

### 8.2 ⏸ ACEPTADO PARA v1 — El rate limit es en memoria
Funciona con una sola instancia. Si Render escala a varias, cada una tendría su propio
contador. Requeriría Redis. Decisión: se acepta para v1.

### 8.3 ✅ CORREGIDO — Faltaba `trust proxy`
Se agregó `app.set('trust proxy', 1)`. Se usa `1` y no `true` para que no se pueda falsear
la IP vía `X-Forwarded-For`. Se verificó que `req.ip` no se usa en ninguna otra parte del
backend, así que no hay efectos colaterales.

### 8.4 ✅ CORREGIDO — `CasoHistorial` usado para actividad sin cambio de estado
El modelo **no se tocó**, como se pidió. El cambio es solo de presentación: el constructor
del timeline detecta `estadoAntes === estadoDespues` y emite un evento `ACTIVIDAD` con
título "Actividad registrada: <nota>" en vez de "Estado: ACTIVO → ACTIVO". El frontend
sumó la entrada correspondiente en su mapa de íconos (`TabTimeline.jsx`), que ya tenía
fallback, así que no había riesgo de romperlo.

### 8.5 ⏸ ACEPTADO PARA v1 — Los scopes se llaman `casos:*` pero abarcan más
`casos:write` habilita también crear tareas y referenciar documentos. Separarlos en
`tareas:write` y `documentos:write` queda para más adelante.

### 8.6 ⏸ ACEPTADO PARA v1 — No hay rotación de keys
Para rotar hay que crear una nueva y revocar la vieja a mano. `expiraEn` existe en el
modelo pero nada obliga a usarlo.

### 8.7 ◐ PARCIALMENTE CORREGIDO — Auditoría
Las escrituras que pasan por `CasoHistorial` (cambio de estado y actividad) ahora llevan
el prefijo `[API: <nombre de la key>]`, así que se distinguen de las de la web.

**Lo que sigue sin cubrir:** las tareas y los documentos creados vía API no llevan marca —
haría falta una columna `origen` en esas tablas. Y las **lecturas** no se registran en
absoluto; solo existe `ultimoUsoEn` por key, que además se actualiza como máximo una vez
por minuto para no escribir en cada request.

### 8.8 ○ ABIERTO — Las URLs de documentos no se validan más allá del formato
Se exige `http(s)://` pero no se verifica que la URL exista ni que apunte a un dominio
confiable. Cualquiera con la key puede registrar un documento apuntando a cualquier lado.

### 8.9 ○ ABIERTO — Sin tests automatizados en el repo
La verificación fue manual con scripts curl que no quedaron commiteados. No hay nada en el
repo que impida una regresión futura. Es el hueco más grande que queda.

### 8.10 ✅ RESUELTO — Cómo se aplica la migración en producción
Era el bloqueante declarado. Ver 1.1 para el detalle completo: se confirmó por historial de
git que el arranque previsto es `start:prod` (`db push`), se alineó el `CMD` del Dockerfile
a ese mismo script para que las dos vías sean idénticas, y se limpió el P3009 local marcando
como aplicadas las cinco migraciones cuyo contenido ya estaba en la base.

**Resuelto también lo de al lado:** el backend vive en `gestarlex-backend.onrender.com` y
el autodeploy creó la tabla sin intervención manual. Ver 1.2 y 7.6.

### 8.11 ○ ABIERTO POR DISEÑO — La key hereda el rol del abogado dueño
Si la key se ata a un `SOCIO`, hereda permisos de SOCIO dentro de la superficie expuesta.
No hay forma de crear una key *más* restringida que el rol de su dueño más allá de los
scopes. Para el caso de uso actual está bien.

### 8.12 ⚠ NUEVO — `trust proxy` asume que solo se llega por el proxy
Con `trust proxy: 1`, si alguien pudiera conectarse **directo** al proceso (saltándose el
proxy de Render), podría fijar `X-Forwarded-For` y controlar el `req.ip` que ve el
limitador. En Render la app solo es alcanzable a través de su proxy, así que no aplica;
pero si algún día se expone el puerto directo, hay que revisarlo.

---

## 9. Cómo usarla

Base: `https://gestarlex-backend.onrender.com/api/integraciones`

### 9.1 Crear una API key (una sola vez, con el login normal)

Requiere rol `SOCIO` o `ADMIN`. El valor en claro se devuelve **una única vez**:

```bash
API=https://gestarlex-backend.onrender.com

# 1. Login → accessToken
TOKEN=$(curl -s -X POST $API/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"TU_EMAIL","password":"TU_PASSWORD"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.accessToken')

# 2. Crear la key
curl -s -X POST $API/api/integraciones/keys \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"nombre":"casos-jurisconsultas","scopes":["casos:read","casos:write"]}'
```

Guardala fuera del repo, con permisos restringidos:
`~/.gestarlex/casos-jurisconsultas.key` (chmod 600).

### 9.2 Usarla

```bash
API=https://gestarlex-backend.onrender.com/api/integraciones
K=$(cat ~/.gestarlex/casos-jurisconsultas.key)

curl $API/ping                    -H "X-API-Key: $K"   # verificar la key
curl $API/casos                   -H "X-API-Key: $K"   # activos por defecto
curl "$API/casos?estado=TODOS"    -H "X-API-Key: $K"
curl $API/casos/$ID               -H "X-API-Key: $K"
curl $API/casos/$ID/timeline      -H "X-API-Key: $K"
curl $API/pendientes              -H "X-API-Key: $K"

curl -X PATCH $API/casos/$ID/estado    -H "X-API-Key: $K" -H 'Content-Type: application/json' \
  -d '{"estado":"SUSPENDIDO","nota":"En espera de peritaje."}'

curl -X PATCH $API/casos/$ID/actividad -H "X-API-Key: $K" -H 'Content-Type: application/json' \
  -d '{"nota":"Llamé al juzgado, sin novedades."}'

curl -X POST  $API/casos/$ID/pendientes -H "X-API-Key: $K" -H 'Content-Type: application/json' \
  -d '{"descripcion":"Pedir copia del expediente","prioridad":"ALTA"}'

curl -X POST  $API/casos/$ID/documentos -H "X-API-Key: $K" -H 'Content-Type: application/json' \
  -d '{"nombre":"contestacion.pdf","url":"https://drive.google.com/…","tipo":"contestacion"}'
```

### 9.3 Revocar

```bash
curl -X POST $API/keys/<id>/revocar -H "Authorization: Bearer $TOKEN"
```

### 9.4 Cosas a tener en cuenta

- **Cold start**: si el servicio está dormido, el primer request puede tardar ~50s. El
  cliente tiene que tolerarlo (timeout generoso y un reintento).
- **La key se muestra una sola vez.** Si se pierde, se crea otra y se revoca la vieja.
- **No apuntar a `gestarlex.onrender.com`**: ese es el frontend y devuelve HTML. Ver 1.2.

## 10. Preguntas abiertas para una próxima revisión

1. ¿El límite de 300/min por IP y 60/min por key es razonable para dos automatizaciones, o
   conviene ajustarlo?
2. ¿Vale la pena la columna `origen` para cerrar del todo el punto 8.7, o alcanza con la
   marca en las notas del historial?
3. ¿Qué mínimo de tests automatizados (8.9) tendría sentido dejar en el repo?
4. ¿Falta algún endpoint para el caso de uso real, ahora que la API está por desplegarse?
