// ============================================================
//  Middleware – Upload de arquivos (multer adapter para Hono)
// ============================================================
import multer from 'multer';
import { join, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_SIZE   = parseInt(process.env.MAX_FILE_SIZE_MB || '200') * 1024 * 1024;

// Tipos permitidos por categoria
const ALLOWED_TYPES = {
  map:   ['.pdf','.tif','.tiff','.geotiff','.mbtiles','.kml','.kmz','.gpx','.geojson','.json'],
  photo: ['.jpg','.jpeg','.png','.webp','.heic'],
  any:   ['.pdf','.tif','.tiff','.geotiff','.mbtiles','.kml','.kmz','.gpx','.geojson','.json',
           '.jpg','.jpeg','.png','.webp','.heic'],
};

function createStorage(subdir) {
  const dir = join(UPLOAD_DIR, subdir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename:    (req, file, cb) => {
      const ext  = extname(file.originalname).toLowerCase();
      const name = `${uuidv4()}${ext}`;
      cb(null, name);
    },
  });
}

function fileFilter(category) {
  return (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (ALLOWED_TYPES[category].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo não permitido: ${ext}`));
    }
  };
}

export const uploadMap = multer({
  storage:    createStorage('maps'),
  limits:     { fileSize: MAX_SIZE },
  fileFilter: fileFilter('map'),
});

export const uploadPhoto = multer({
  storage:    createStorage('photos'),
  limits:     { fileSize: 20 * 1024 * 1024 },
  fileFilter: fileFilter('photo'),
});

/**
 * Adapta multer para uso com Hono (que usa Web Request)
 */
export function multerHono(multerInstance, field) {
  return (c, next) => {
    return new Promise((resolve, reject) => {
      const handler = field === 'single'
        ? multerInstance.single('file')
        : multerInstance.array('files', 10);

      // Hono usa a req nativa do Node via c.env.incoming
      const req = c.env?.incoming || c.req.raw;
      const res = c.env?.outgoing  || {};

      handler(req, res, (err) => {
        if (err) {
          c.json({ error: err.message }, 400).then(resolve).catch(reject);
          return;
        }
        // Injeta arquivo no contexto Hono
        if (req.file)  c.set('file',  req.file);
        if (req.files) c.set('files', req.files);
        next().then(resolve).catch(reject);
      });
    });
  };
}
