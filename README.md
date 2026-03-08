# Afaia Maps 🗺️

Aplicativo de mapeamento de campo com GPS offline — trilhas, waypoints, mapas MBTiles e sincronização.

> **Stack**: Node.js + Hono · PostgreSQL + PostGIS · PWA + Capacitor (Android/iOS) · Leaflet · IndexedDB

---

## ✅ Funcionalidades Implementadas

### Frontend PWA
- [x] Login / Cadastro (JWT)
- [x] Dashboard com estatísticas
- [x] Mapa principal (Leaflet + OpenStreetMap)
- [x] Gravação de trilhas GPS em tempo real
- [x] Waypoints com fotos georreferenciadas
- [x] Biblioteca de mapas (MBTiles, GeoPDF, GPX, KML, GeoJSON)
- [x] **Suporte MBTiles offline**: upload, metadados, uso como base layer
- [x] Projetos para organizar mapas e trilhas
- [x] Sincronização offline com fila de operações
- [x] Admin panel
- [x] **PWA completa**: manifest.json, service worker v3, instalável

### Service Worker v3
- [x] Cache-first para tiles externos (OSM, ArcGIS, etc.)
- [x] **Cache agressivo para tiles MBTiles** (`/tiles/*`) – 90 dias
- [x] Network-first para API com fallback offline
- [x] App shell cacheado no install
- [x] Background sync
- [x] Push notifications
- [x] Pré-cache de arquivos de mapa sob demanda

### Capacitor (Android/iOS)
- [x] `capacitor.config.json` configurado (appId: `com.afaiamaps.app`)
- [x] `package.json` com todos os plugins Capacitor v6
- [x] `android-config/AndroidManifest.xml` (GPS, câmera, armazenamento)
- [x] `ios-config/Info.plist` (permissões iOS)
- [x] `frontend/js/capacitor.js` (ponte nativa: GPS, câmera, háptico, etc.)
- [x] `frontend/css/mobile.css` (safe-area, notch, design mobile-first)
- [x] Ícones SVG (`frontend/icons/icon.svg`, `icon-maskable.svg`)
- [x] Script gerador de ícones e splash (`scripts/generate-icons.js`)

### Backend Node.js (Hono)
- [x] Auth: registro, login, JWT, refresh, logout
- [x] Mapas: upload, listagem, metadados, deleção
- [x] **MBTiles**: validação, extração de metadata, rota de tiles
- [x] Rota `GET /tiles/:mapId/:z/:x/:y.png` com LRU cache SQLite
- [x] Rota `GET /tiles/:mapId/info` com metadados completos
- [x] Trilhas GPS: CRUD + pontos (track_points)
- [x] Waypoints: CRUD + fotos
- [x] Projetos: CRUD + membros
- [x] Sincronização: fila offline, resolução de conflitos
- [x] Fotos: upload, GPS tag, vinculação
- [x] Admin: usuários, estatísticas
- [x] Pipeline GeoPDF (módulo isolado, pronto para GDAL)

### Banco de Dados
- [x] Schema PostgreSQL + PostGIS (11 tabelas)
- [x] Campos MBTiles: `type`, `min_zoom`, `max_zoom`, `bounds` (GEOMETRY), `tile_format`
- [x] Índices: GIST em bounds, B-tree em user_id, project_id, file_type

### Infraestrutura
- [x] `docker-compose.yml` (PostgreSQL/PostGIS 16 + API + Nginx)
- [x] `backend/Dockerfile`
- [x] `nginx.conf`
- [x] `DEPLOY.md` (Railway)
- [x] `CAPACITOR.md` (build Android/iOS)
- [x] `MBTILES.md` (geração, importação, limites)

---

## 🏗️ Estrutura de Pastas

```
afaia-maps/
├── frontend/                    ← PWA (webDir do Capacitor)
│   ├── index.html               ← Landing/splash
│   ├── login.html               ← Login/cadastro
│   ├── app.html                 ← Mapa principal (Leaflet)
│   ├── maps-library.html        ← Biblioteca de mapas (MBTiles UI)
│   ├── manifest.json            ← PWA manifest (conformidade total)
│   ├── sw.js                    ← Service Worker v3 (MBTiles + tiles)
│   ├── icons/
│   │   ├── icon.svg             ← Ícone fonte
│   │   └── icon-maskable.svg    ← Ícone maskable (Android)
│   ├── css/
│   │   ├── app.css
│   │   └── mobile.css           ← Safe-area, notch, mobile-first
│   └── js/
│       ├── api.js               ← Cliente HTTP + autenticação
│       ├── auth.js              ← Gerenciamento de sessão
│       ├── db.js                ← IndexedDB (dados offline)
│       ├── map.js               ← Leaflet + GPS
│       ├── tracks.js            ← Gravação de trilhas
│       ├── waypoints.js         ← Waypoints
│       ├── sync.js              ← Fila de sincronização
│       ├── mbtiles.js           ← Integração MBTiles + Leaflet ← NOVO
│       └── capacitor.js         ← Ponte Capacitor nativa
│
├── backend/                     ← API Node.js
│   ├── package.json             ← + better-sqlite3
│   ├── Dockerfile
│   ├── .env.example
│   └── src/
│       ├── index.js             ← Entry point (Hono)
│       ├── db/
│       │   ├── schema.sql       ← PostgreSQL + PostGIS
│       │   └── client.js        ← pg Pool
│       ├── middleware/
│       │   ├── auth.js          ← JWT middleware
│       │   └── upload.js        ← Multer config
│       ├── routes/
│       │   ├── auth.js
│       │   ├── maps.js          ← Upload com extração MBTiles
│       │   ├── tiles.js         ← Servidor de tiles ← NOVO/ATUALIZADO
│       │   ├── tracks.js
│       │   ├── waypoints.js
│       │   ├── projects.js
│       │   ├── sync.js
│       │   ├── photos.js
│       │   └── admin.js
│       └── modules/
│           ├── mbtiles/
│           │   ├── cache.js     ← LRU SQLite connections
│           │   └── metadata.js  ← Extração de metadata ← NOVO
│           └── geodpf/
│               ├── validate.js
│               ├── extract.js
│               └── queue.js
│
├── android-config/
│   └── AndroidManifest.xml      ← GPS, câmera, armazenamento
├── ios-config/
│   └── Info.plist               ← Permissões iOS
├── scripts/
│   └── generate-icons.js        ← Gera ícones + splash screens
│
├── capacitor.config.json        ← appId, plugins, permissões
├── package.json                 ← Scripts cap:add, cap:sync, etc.
├── docker-compose.yml
├── nginx.conf
├── DEPLOY.md                    ← Railway deploy
├── CAPACITOR.md                 ← Build Android/iOS
├── MBTILES.md                   ← Geração e uso de MBTiles
└── README.md
```

---

## 🚀 Como Rodar Localmente

### 1. Com Docker Compose (recomendado)

```bash
# Clone e entre na pasta
cd afaia-maps

# Crie o .env a partir do exemplo
cp backend/.env.example backend/.env
# Edite backend/.env com suas configurações

# Suba tudo
docker-compose up -d

# Acesse
# Frontend: http://localhost:80
# API:      http://localhost:3000
# DB:       localhost:5432
```

### 2. Manual

```bash
# Backend
cd backend
npm install
# Configure .env
npm run migrate   # Cria tabelas
npm run dev       # Inicia na porta 3000

# Frontend (em outro terminal)
cd ..
npm install       # Instala Capacitor CLI
npm run dev       # Serve em http://localhost:5173
```

---

## 📱 Build do Aplicativo (Capacitor)

### Pré-requisitos
- Node.js ≥ 18
- Android Studio (para Android)
- Xcode ≥ 14 + macOS (para iOS)

### Passo a passo

```bash
# 1. Instale dependências
npm install

# 2. Gere ícones e splash screens
npm install sharp     # só na primeira vez
npm run icons

# 3. Adicione plataformas (só uma vez)
npm run cap:add:android
npm run cap:add:ios   # macOS only

# 4. Copie AndroidManifest.xml
cp android-config/AndroidManifest.xml android/app/src/main/AndroidManifest.xml

# 5. Sincronize assets
npm run cap:sync

# 6. Abra no IDE e rode
npm run android   # Abre Android Studio
npm run ios       # Abre Xcode
```

### Scripts disponíveis

| Script | Descrição |
|---|---|
| `npm run dev` | Serve frontend em localhost:5173 |
| `npm run build:prod` | Build de produção |
| `npm run cap:sync` | Sync frontend → nativo |
| `npm run android` | Abre Android Studio |
| `npm run ios` | Abre Xcode |
| `npm run icons` | Gera todos os ícones/splash |

---

## 🗄️ API Endpoints Principais

### Auth
| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/api/v1/auth/register` | Cadastro |
| POST | `/api/v1/auth/login` | Login → JWT |
| POST | `/api/v1/auth/refresh` | Refresh token |

### Mapas
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/v1/maps` | Listar mapas |
| POST | `/api/v1/maps/upload` | Upload (multipart) |
| GET | `/api/v1/maps/:id` | Detalhes |
| DELETE | `/api/v1/maps/:id` | Deletar |

### Tiles MBTiles
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/tiles/:id/:z/:x/:y.png` | Tile PNG/JPEG |
| GET | `/tiles/:id/info` | Metadados |
| GET | `/tiles/:id/preview` | Tile de preview |
| GET | `/tiles/stats` | Cache LRU stats |

### Trilhas & Waypoints
| Método | Endpoint | Descrição |
|---|---|---|
| GET/POST | `/api/v1/tracks` | Trilhas |
| POST | `/api/v1/tracks/:id/points` | Pontos GPS |
| GET/POST | `/api/v1/waypoints` | Waypoints |

---

## 🔐 Variáveis de Ambiente (backend/.env)

```env
# Banco de dados (Neon.tech)
DATABASE_URL=postgresql://user:pass@host/afaiamaps?sslmode=require

# JWT
JWT_SECRET=sua-chave-secreta-aqui
JWT_EXPIRES_IN=7d

# Servidor
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://seu-frontend.com

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=5120   # 5 GB para MBTiles grandes
```

---

## ☁️ Deploy

Veja [`DEPLOY.md`](DEPLOY.md) para instruções completas de deploy no Railway.

**Resumo rápido (Railway):**
1. Crie projeto no Railway, adicione repositório
2. Adicione serviço PostgreSQL + habilite PostGIS
3. Configure variáveis de ambiente
4. Root directory: `backend`
5. Build: `npm install && npm run migrate`
6. Start: `npm start`

---

## 📖 Documentação Adicional

- [`CAPACITOR.md`](CAPACITOR.md) — Build completo Android/iOS
- [`MBTILES.md`](MBTILES.md) — Geração, importação e uso de MBTiles
- [`DEPLOY.md`](DEPLOY.md) — Deploy no Railway com Neon.tech

---

## 🔄 Próximos Passos Recomendados

1. **Processamento GeoPDF real** — integrar GDAL/Python no pipeline `modules/geodpf`
2. **Tiles vetoriais** — suporte a MVT/PBF via `tippecanoe`
3. **Download de região** — UI para baixar tiles de uma área para offline
4. **Sincronização robusta** — conflict resolution com CRDT
5. **Mapas colaborativos** — compartilhamento por projeto
6. **Relatórios de campo** — formulários customizados por projeto

---

## 📄 Licença

UNLICENSED — Todos os direitos reservados. Desenvolvido para uso interno.

---

*Última atualização: 2026-03-08 · Afaia Maps v1.0*
