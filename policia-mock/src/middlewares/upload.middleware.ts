import multer from 'multer';
import path from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { env } from '../config/env.js';
import { ApiError } from '../utils/errors.js';
import type { ValidatedFile } from '../models/evidencia.model.js';
const formats: Record<string,string[]> = { 'image/jpeg':['.jpg','.jpeg'], 'image/png':['.png'], 'image/webp':['.webp'], 'application/pdf':['.pdf'], 'video/mp4':['.mp4'] };
const invalid = () => new ApiError(415,'ARCHIVO_INVALIDO','El tipo, extensión o contenido del archivo no es válido.');
export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_EVIDENCE_SIZE_MB*1024*1024, files:6, fields:1, parts:7, fieldSize:65536 },
  fileFilter: (_req,file,cb) => {
    const allowed = formats[file.mimetype]?.includes(path.extname(file.originalname).toLowerCase()) && (file.fieldname !== 'foto' || file.mimetype.startsWith('image/'));
    if (allowed) cb(null,true); else cb(invalid());
  }
}).fields([{name:'foto',maxCount:1},{name:'evidencias',maxCount:5}]);
export async function validateFiles(files: Express.Multer.File[]): Promise<ValidatedFile[]> {
  const result: ValidatedFile[] = [];
  for (const f of files) {
    const max = f.fieldname === 'foto' ? env.MAX_PHOTO_SIZE_MB : env.MAX_EVIDENCE_SIZE_MB;
    if (f.size > max*1024*1024) throw new ApiError(413,'ARCHIVO_DEMASIADO_GRANDE',`${f.fieldname}: máximo ${max} MB.`);
    if (!f.size) throw invalid();
    let buffer=f.buffer;
    try {
      if (f.mimetype.startsWith('image/')) {
        const image=sharp(buffer,{failOn:'warning',limitInputPixels:25000000,animated:true});
        const meta=await image.metadata();
        if (`image/${meta.format}`!==f.mimetype || (meta.pages??1)>1) throw invalid();
        buffer=await image.rotate().toBuffer();
      } else if (f.mimetype==='application/pdf') {
        if (!buffer.subarray(0,5).equals(Buffer.from('%PDF-'))) throw invalid();
        const pdf=await PDFDocument.load(buffer,{ignoreEncryption:false,throwOnInvalidObject:true});
        if (!pdf.getPageCount()) throw invalid();
      } else {
        if (buffer.length<12 || buffer.toString('ascii',4,8)!=='ftyp') throw invalid();
        const dir=await mkdtemp(path.join(tmpdir(),'denuncia-video-'));
        try {
          const file=path.join(dir,'video.mp4'); await writeFile(file,buffer);
          const {stdout}=await promisify(execFile)('ffprobe',['-v','error','-show_format','-show_streams','-of','json',file],{timeout:15000,maxBuffer:1024*1024,windowsHide:true});
          const probe=JSON.parse(stdout);
          if (!probe.format?.format_name?.split(',').includes('mp4') || !probe.streams?.some((s:{codec_type:string;codec_name?:string})=>s.codec_type==='video' && s.codec_name)) throw invalid();
        } finally { await rm(dir,{recursive:true,force:true}); }
      }
    } catch { throw invalid(); }
    if (buffer.length>max*1024*1024) throw new ApiError(413,'ARCHIVO_DEMASIADO_GRANDE','El archivo procesado supera el límite.');
    result.push({buffer, extension:formats[f.mimetype][0].slice(1),mime:f.mimetype,
      original:path.basename(f.originalname.replaceAll('\\','/')).replace(/[\x00-\x1f\x7f]/g,'').slice(0,255)||'archivo',field:f.fieldname as 'foto'|'evidencias'});
  }
  return result;
}
