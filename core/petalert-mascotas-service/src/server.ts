import { mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { app } from './app.js';
import { pool } from './config/database.js';
import { env, uploadDir } from './config/env.js';
import { migrate } from './config/migrate.js';
import { cleanPhotos } from './services/photos.service.js';
import { logger } from './utils/logger.js';
try {
  for (let attempt = 1; ; attempt++) {
    try { await pool.query('SELECT 1'); break; }
    catch (e) { if (attempt >= 15) throw e; await delay(2000); }
  }
  await migrate(); await mkdir(uploadDir, { recursive: true }); await cleanPhotos();
  const server = app.listen(env.PORT, '0.0.0.0', () => logger.info(`PetAlert disponible en puerto ${env.PORT}`));
  const timer = setInterval(() => { void cleanPhotos().catch(() => logger.error('Limpieza de fotos pendiente')); }, 60000).unref();
  let stopping = false;
  const shutdown = () => {
    if (stopping) return; stopping = true; clearInterval(timer);
    const deadline = setTimeout(() => process.exit(1), 15000).unref();
    server.close(() => { void pool.end().then(() => { clearTimeout(deadline); process.exit(0); }); });
  };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
} catch { logger.error('No fue posible iniciar el servicio; revise PostgreSQL y las migraciones.'); await pool.end(); process.exitCode = 1; }
