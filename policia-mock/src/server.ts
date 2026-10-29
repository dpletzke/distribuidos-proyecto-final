import { mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { app } from './app.js';
import { pool, ensureDatabase } from './config/database.js';
import { env,uploadDir } from './config/env.js';
import { migrate } from './config/migrate.js';
import { cleanFiles } from './services/files.service.js';
import { logger } from './utils/logger.js';
try {
  for(let n=0;;n++) {try{await ensureDatabase();break;}catch(e){if(n>=14)throw e;await delay(2000);}}
  await migrate();await mkdir(uploadDir,{recursive:true});await cleanFiles();
  const server=app.listen(env.PORT,'0.0.0.0',()=>logger.info(`ProteccionAnimal disponible en puerto ${env.PORT}`));
  const timer=setInterval(()=>{void cleanFiles().catch(()=>logger.error('Limpieza pendiente'));},60000).unref();
  let stopping=false;
  const shutdown=()=>{if(stopping)return;stopping=true;clearInterval(timer);const deadline=setTimeout(()=>process.exit(1),15000).unref();server.close(()=>{void pool.end().then(()=>{clearTimeout(deadline);process.exit(0);});});};
  process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}catch{logger.error('No fue posible iniciar ProteccionAnimal. Revise PostgreSQL, permisos CREATEDB y migraciones.');await pool.end();process.exitCode=1;}
