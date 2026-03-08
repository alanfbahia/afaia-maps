// ============================================================
//  AFAIA MAPS – Backend Entry Point
//  Node.js + Hono framework
// ============================================================
import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { serveStatic } from '@hono/node-server/serve-static';

import authRoutes     from './routes/auth.js';
import mapsRoutes     from './routes/maps.js';
import tracksRoutes   from './routes/tracks.js';
import waypointsRoutes from './routes/waypoints.js';
import projectsRoutes from './routes/projects.js';
import syncRoutes     from './routes/sync.js';
import photosRoutes   from './routes/photos.js';
import adminRoutes    from './routes/admin.js';
import tilesRoutes    from './routes/tiles.js';
import { db }         from './db/client.js';
import { closeAll as closeMBTilesCache } from './modules/mbtiles/cache.js';

const app = new Hono();

// ── Middleware global ─────────────────────────────────────
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:80',
    // Railway / produção — adicione seu domínio aqui
  ],
  allowMethods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowHeaders: ['Content-Type','Authorization','X-Device-ID'],
  credentials: true,
}));

// ── Health check ──────────────────────────────────────────
app.get('/health', async (c) => {
  try {
    await db.query('SELECT 1');
    return c.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
  } catch (err) {
    return c.json({ status: 'error', db: err.message }, 503);
  }
});

// ── API v1 ────────────────────────────────────────────────
app.route('/api/v1/auth',      authRoutes);
app.route('/api/v1/maps',      mapsRoutes);
app.route('/api/v1/tracks',    tracksRoutes);
app.route('/api/v1/waypoints', waypointsRoutes);
app.route('/api/v1/projects',  projectsRoutes);
app.route('/api/v1/sync',      syncRoutes);
app.route('/api/v1/photos',    photosRoutes);
app.route('/api/v1/admin',     adminRoutes);

// ── Tiles MBTiles (sem prefixo /api/v1 para compatibilidade Leaflet) ──
app.route('/tiles',            tilesRoutes);

// ── Arquivos de upload (estático) ─────────────────────────
app.use('/uploads/*', serveStatic({ root: './' }));

// ── 404 ───────────────────────────────────────────────────
app.notFound((c) => c.json({ error: 'Route not found' }, 404));

// ── Error handler ─────────────────────────────────────────
app.onError((err, c) => {
  console.error('[ERROR]', err);
  return c.json({ error: err.message || 'Internal server error' }, 500);
});

// ── Graceful shutdown ────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('[APP] Encerrando...');
  closeMBTilesCache();
  process.exit(0);
});

// ── Start ─────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000');

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   AFAIA MAPS API  – porta ${PORT}       ║
  ║   ENV: ${(process.env.NODE_ENV || 'development').padEnd(27)}║
  ╚══════════════════════════════════════╝
  `);
});

export default app;
