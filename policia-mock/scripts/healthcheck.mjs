// Comprobacion interna TCP + SQL; no agrega una ruta HTTP.
import net from 'node:net';
import pg from 'pg';
const client=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,connectionTimeoutMillis:3000});
try {
  await new Promise((resolve,reject)=>{const s=net.connect(Number(process.env.PORT??3000),'127.0.0.1');s.setTimeout(3000);s.once('connect',()=>{s.end();resolve();});s.once('error',reject);s.once('timeout',()=>{s.destroy();reject(new Error('timeout'));});});
  await client.connect();await client.query('SELECT 1 FROM "Denuncias" LIMIT 0');await client.end();
}catch{await client.end().catch(()=>{});process.exitCode=1;}
