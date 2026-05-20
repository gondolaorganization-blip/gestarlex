import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error.js';
import { initCronJobs } from './cron/reminders.cron.js';

// Rutas
import authRoutes from './routes/auth.routes.js';
import abogadosRoutes from './routes/abogados.routes.js';
import clientesRoutes from './routes/clientes.routes.js';
import casosRoutes from './routes/casos.routes.js';
import audienciasRoutes from './routes/audiencias.routes.js';
import terminosRoutes from './routes/terminos.routes.js';
import calendarioRoutes from './routes/calendario.routes.js';
import documentosRoutes from './routes/documentos.routes.js';
import plantillasRoutes from './routes/plantillas.routes.js';
import poderesRoutes from './routes/poderes.routes.js';
import honorariosRoutes from './routes/honorarios.routes.js';
import gastosRoutes from './routes/gastos.routes.js';
import facturasRoutes from './routes/facturas.routes.js';
import timerRoutes from './routes/timer.routes.js';
import comunicacionesRoutes from './routes/comunicaciones.routes.js';
import tareasRoutes from './routes/tareas.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import reportesRoutes from './routes/reportes.routes.js';
import iaRoutes from './routes/ia.routes.js';
import adminRoutes from './routes/admin.routes.js';
import paypalRoutes from './routes/paypal.routes.js';

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://lex.gestarsoft.com',
  'https://gestarlex.onrender.com',
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
  credentials: true,
}));
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); },
}));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'GESTARLEX',
    version: '1.0.0',
    env: process.env.NODE_ENV,
    rutas: 18,
  });
});

// ─── API ──────────────────────────────────────────────────────────────────────
app.use('/api/auth',           authRoutes);
app.use('/api/abogados',       abogadosRoutes);
app.use('/api/clientes',       clientesRoutes);
app.use('/api/casos',          casosRoutes);
app.use('/api/audiencias',     audienciasRoutes);
app.use('/api/terminos',       terminosRoutes);
app.use('/api/calendario',     calendarioRoutes);
app.use('/api/documentos',     documentosRoutes);
app.use('/api/plantillas',     plantillasRoutes);
app.use('/api/poderes',        poderesRoutes);
app.use('/api/honorarios',     honorariosRoutes);
app.use('/api/gastos',         gastosRoutes);
app.use('/api/facturas',       facturasRoutes);
app.use('/api/timer',          timerRoutes);
app.use('/api/comunicaciones', comunicacionesRoutes);
app.use('/api/tareas',         tareasRoutes);
app.use('/api/dashboard',      dashboardRoutes);
app.use('/api/reportes',       reportesRoutes);
app.use('/api/ia',             iaRoutes);
app.use('/api/admin',          adminRoutes);
app.use('/api/paypal',         paypalRoutes);

// 404
app.use((_req, res) => res.status(404).json({ ok: false, message: 'Ruta no encontrada.' }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`GESTARLEX API corriendo en http://localhost:${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
  initCronJobs();
});

export default app;
