import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { env, uploadDir } from './config/env.js';
import { pool } from './config/database.js';
import { openapi } from './config/swagger.js';
import { mascotasRouter } from './routes/mascotas.routes.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { ApiError } from './utils/errors.js';
export const app = express();
app.disable('x-powered-by');
app.use(helmet(), cors({ origin: env.CORS_ORIGIN.split(',').map(s => s.trim()) }), express.json({ limit: '64kb' }));
app.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'OK', service: 'petalert-mascotas-service', database: 'connected' }); }
  catch { res.status(503).json({ codigo: 'BASE_DATOS_NO_DISPONIBLE', mensaje: 'Base de datos no disponible.' }); }
});
app.get('/openapi.json', (_req, res) => { res.json(openapi); });
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi));
app.use('/uploads', express.static(uploadDir, { dotfiles: 'deny', index: false, redirect: false }));
app.use('/api/mascotas', mascotasRouter);
app.use((_req, _res, next) => next(new ApiError(404, 'RUTA_NO_ENCONTRADA', 'Recurso no encontrado.')));
app.use(errorHandler);
