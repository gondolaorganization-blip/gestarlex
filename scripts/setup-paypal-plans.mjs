/**
 * setup-paypal-plans.mjs
 *
 * Crea automáticamente los productos y planes de suscripción en PayPal Live.
 * Uso:
 *   PAYPAL_CLIENT_ID=xxx PAYPAL_CLIENT_SECRET=yyy node scripts/setup-paypal-plans.mjs
 *
 * Al finalizar imprime los env vars listos para pegar en Render.
 */

const BASE = 'https://api-m.paypal.com';

const CLIENT_ID     = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const BACKEND_URL   = process.env.BACKEND_URL || 'https://gestarlex-backend.onrender.com';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌  Faltan credenciales. Úsalo así:\n');
  console.error('  PAYPAL_CLIENT_ID=xxx PAYPAL_CLIENT_SECRET=yyy node scripts/setup-paypal-plans.mjs\n');
  process.exit(1);
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getToken() {
  const cred = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${cred}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('No se pudo obtener token: ' + JSON.stringify(data));
  return data.access_token;
}

async function pp(token, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `gestarlex-${Date.now()}-${Math.random()}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

// ── Planes GestarLex ──────────────────────────────────────────────────────────

const PLANES = [
  { key: 'SOLO',       nombre: 'GestarLex Solo',       precio: '39.99' },
  { key: 'FIRMA',      nombre: 'GestarLex Firma',      precio: '99.00' },
  { key: 'ENTERPRISE', nombre: 'GestarLex Enterprise', precio: '199.00' },
];

function buildPlan(productId, nombre, precio) {
  return {
    product_id: productId,
    name: nombre,
    status: 'ACTIVE',
    billing_cycles: [{
      frequency: { interval_unit: 'MONTH', interval_count: 1 },
      tenure_type: 'REGULAR',
      sequence: 1,
      total_cycles: 0,
      pricing_scheme: { fixed_price: { value: precio, currency_code: 'USD' } },
    }],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: { value: '0', currency_code: 'USD' },
      setup_fee_failure_action: 'CONTINUE',
      payment_failure_threshold: 3,
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔄  Conectando con PayPal Live...\n');
  const token = await getToken();
  console.log('✅  Token obtenido.\n');

  // 1. Crear producto
  console.log('📦  Creando producto GestarLex...');
  const producto = await pp(token, 'POST', '/v1/catalogs/products', {
    name: 'GestarLex',
    description: 'Software de gestión legal para firmas de abogados en Panamá.',
    type: 'SERVICE',
    category: 'SOFTWARE',
  });

  if (!producto.id) {
    console.error('❌  Error al crear producto:', JSON.stringify(producto, null, 2));
    process.exit(1);
  }
  console.log(`✅  Producto creado: ${producto.id}\n`);

  // 2. Crear planes
  const planIds = {};
  for (const plan of PLANES) {
    console.log(`💳  Creando plan ${plan.nombre} (USD ${plan.precio}/mes)...`);
    const res = await pp(token, 'POST', '/v1/billing/plans', buildPlan(producto.id, plan.nombre, plan.precio));

    if (!res.id) {
      console.error(`❌  Error al crear plan ${plan.key}:`, JSON.stringify(res, null, 2));
      process.exit(1);
    }
    planIds[plan.key] = res.id;
    console.log(`✅  ${plan.key}: ${res.id}`);
  }

  // 3. Crear webhook
  console.log('\n🔔  Creando webhook...');
  const webhookUrl = `${BACKEND_URL}/api/paypal/webhook`;
  const webhook = await pp(token, 'POST', '/v1/notifications/webhooks', {
    url: webhookUrl,
    event_types: [
      { name: 'BILLING.SUBSCRIPTION.ACTIVATED' },
      { name: 'BILLING.SUBSCRIPTION.RE-ACTIVATED' },
      { name: 'BILLING.SUBSCRIPTION.CANCELLED' },
      { name: 'BILLING.SUBSCRIPTION.SUSPENDED' },
      { name: 'BILLING.SUBSCRIPTION.EXPIRED' },
      { name: 'PAYMENT.SALE.COMPLETED' },
    ],
  });

  let webhookId = webhook.id;
  if (!webhookId) {
    console.warn('⚠️   No se pudo crear el webhook automáticamente. Créalo manualmente en developer.paypal.com');
    console.warn('    URL:', webhookUrl);
    webhookId = 'CREAR_MANUALMENTE';
  } else {
    console.log(`✅  Webhook creado: ${webhookId}`);
  }

  // 4. Imprimir env vars
  console.log('\n' + '═'.repeat(60));
  console.log('🎉  TODO LISTO. Agrega estos env vars en Render:\n');
  console.log('── Backend de GestarLex ──────────────────────────────────');
  console.log(`PAYPAL_CLIENT_ID=${CLIENT_ID}`);
  console.log(`PAYPAL_CLIENT_SECRET=${CLIENT_SECRET}`);
  console.log(`PAYPAL_PLAN_ID_SOLO=${planIds.SOLO}`);
  console.log(`PAYPAL_PLAN_ID_FIRMA=${planIds.FIRMA}`);
  console.log(`PAYPAL_PLAN_ID_ENTERPRISE=${planIds.ENTERPRISE}`);
  console.log(`PAYPAL_WEBHOOK_ID=${webhookId}`);
  console.log('\n── Frontend de GestarLex ─────────────────────────────────');
  console.log(`VITE_PAYPAL_CLIENT_ID=${CLIENT_ID}`);
  console.log('═'.repeat(60) + '\n');
}

main().catch((err) => {
  console.error('\n❌  Error inesperado:', err.message);
  process.exit(1);
});
