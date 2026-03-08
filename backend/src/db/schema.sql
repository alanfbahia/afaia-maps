-- ============================================================
--  AFAIA MAPS – Schema PostgreSQL + PostGIS
--  Compatível com Neon.tech (serverless PostgreSQL)
--  Execute: psql $DATABASE_URL -f schema.sql
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- ────────────────────────────────────────────────────────────
--  USERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'user'
                CHECK (role IN ('user','admin','superadmin')),
  plan          TEXT NOT NULL DEFAULT 'explorer'
                CHECK (plan IN ('explorer','professional','corporate')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  reset_token   TEXT,
  reset_expires TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ────────────────────────────────────────────────────────────
--  PROJECTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#2563eb',
  icon        TEXT DEFAULT 'map',
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','archived','completed')),
  bounds      geometry(Polygon, 4326),   -- área geográfica do projeto
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_bounds ON projects USING GIST(bounds);

-- Membros de projeto (colaboração)
CREATE TABLE IF NOT EXISTS project_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'viewer'
             CHECK (role IN ('viewer','editor','admin')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- ────────────────────────────────────────────────────────────
--  MAPS (Biblioteca de mapas)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maps (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  file_type       TEXT NOT NULL
                  CHECK (file_type IN ('geopdf','geotiff','mbtiles','geojson','kml','gpx','image')),
  file_path       TEXT NOT NULL,        -- caminho no servidor / URL storage
  file_size       BIGINT,               -- bytes
  thumbnail_path  TEXT,
  -- Georreferenciamento
  is_georeferenced BOOLEAN DEFAULT FALSE,
  bounds          geometry(Polygon, 4326),
  crs             TEXT DEFAULT 'EPSG:4326',
  min_zoom        INT DEFAULT 0,
  max_zoom        INT DEFAULT 18,
  -- GeoPDF específico
  geodpf_status   TEXT DEFAULT 'pending'
                  CHECK (geodpf_status IN ('pending','processing','ready','error','not_applicable')),
  geodpf_metadata JSONB,               -- CRS, layers, bounds extraídos
  -- Visibilidade
  is_public       BOOLEAN DEFAULT FALSE,
  is_offline      BOOLEAN DEFAULT FALSE,-- disponível offline
  -- Metadados
  tags            TEXT[] DEFAULT '{}',
  extra_metadata  JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maps_user      ON maps(user_id);
CREATE INDEX IF NOT EXISTS idx_maps_project   ON maps(project_id);
CREATE INDEX IF NOT EXISTS idx_maps_bounds    ON maps USING GIST(bounds);
CREATE INDEX IF NOT EXISTS idx_maps_file_type ON maps(file_type);

-- ────────────────────────────────────────────────────────────
--  TRACKS (Trilhas GPS)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  name          TEXT NOT NULL DEFAULT 'Nova Trilha',
  description   TEXT,
  color         TEXT DEFAULT '#ef4444',
  -- Geometria PostGIS
  geom          geometry(LineStringZ, 4326),  -- rota com altitude
  -- Estatísticas calculadas
  distance_m    FLOAT,      -- metros
  duration_s    INT,        -- segundos
  elevation_gain_m FLOAT,
  elevation_loss_m FLOAT,
  avg_speed_kmh FLOAT,
  max_speed_kmh FLOAT,
  min_elevation_m FLOAT,
  max_elevation_m FLOAT,
  -- Timestamps do campo
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  -- Estado
  status        TEXT DEFAULT 'active'
                CHECK (status IN ('recording','active','archived')),
  is_public     BOOLEAN DEFAULT FALSE,
  -- Sincronização offline
  device_id     TEXT,
  client_id     TEXT UNIQUE,           -- ID gerado no device para dedup
  synced_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracks_user    ON tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_tracks_project ON tracks(project_id);
CREATE INDEX IF NOT EXISTS idx_tracks_geom    ON tracks USING GIST(geom);

-- Pontos brutos da trilha (stream de GPS)
CREATE TABLE IF NOT EXISTS track_points (
  id         BIGSERIAL PRIMARY KEY,
  track_id   UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  altitude   FLOAT,
  accuracy   FLOAT,
  speed      FLOAT,
  heading    FLOAT,
  recorded_at TIMESTAMPTZ NOT NULL,
  geom       geometry(PointZ, 4326) GENERATED ALWAYS AS (
               ST_SetSRID(ST_MakePoint(lng, lat, COALESCE(altitude,0)), 4326)
             ) STORED
);

CREATE INDEX IF NOT EXISTS idx_track_points_track ON track_points(track_id);
CREATE INDEX IF NOT EXISTS idx_track_points_geom  ON track_points USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_track_points_time  ON track_points(recorded_at);

-- ────────────────────────────────────────────────────────────
--  WAYPOINTS / POIs
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waypoints (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  track_id    UUID REFERENCES tracks(id) ON DELETE SET NULL,
  name        TEXT NOT NULL DEFAULT 'Waypoint',
  description TEXT,
  symbol      TEXT DEFAULT 'pin',
  color       TEXT DEFAULT '#f59e0b',
  -- Geometria
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  altitude    FLOAT,
  accuracy    FLOAT,
  geom        geometry(PointZ, 4326) GENERATED ALWAYS AS (
                ST_SetSRID(ST_MakePoint(lng, lat, COALESCE(altitude,0)), 4326)
              ) STORED,
  -- Formulário de campo (JSON livre)
  form_data   JSONB DEFAULT '{}',
  -- Imagens associadas
  photos      TEXT[] DEFAULT '{}',     -- caminhos das fotos
  -- Sincronização offline
  device_id   TEXT,
  client_id   TEXT UNIQUE,
  synced_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waypoints_user    ON waypoints(user_id);
CREATE INDEX IF NOT EXISTS idx_waypoints_project ON waypoints(project_id);
CREATE INDEX IF NOT EXISTS idx_waypoints_geom    ON waypoints USING GIST(geom);

-- ────────────────────────────────────────────────────────────
--  PHOTOS (Fotos georreferenciadas)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS photos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  waypoint_id  UUID REFERENCES waypoints(id) ON DELETE SET NULL,
  track_id     UUID REFERENCES tracks(id) ON DELETE SET NULL,
  file_path    TEXT NOT NULL,
  thumbnail_path TEXT,
  -- EXIF / GPS
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  altitude     FLOAT,
  bearing      FLOAT,
  geom         geometry(Point, 4326),
  -- Metadados
  caption      TEXT,
  taken_at     TIMESTAMPTZ,
  device_id    TEXT,
  client_id    TEXT UNIQUE,
  synced_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photos_user    ON photos(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_project ON photos(project_id);
CREATE INDEX IF NOT EXISTS idx_photos_geom    ON photos USING GIST(geom);

-- ────────────────────────────────────────────────────────────
--  SYNC QUEUE (fila de sincronização offline)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_queue (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id   TEXT NOT NULL,
  entity_type TEXT NOT NULL
              CHECK (entity_type IN ('track','track_points','waypoint','photo','project')),
  entity_id   TEXT NOT NULL,   -- client_id do device
  operation   TEXT NOT NULL
              CHECK (operation IN ('create','update','delete')),
  payload     JSONB NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','processing','done','error')),
  error_msg   TEXT,
  attempts    INT DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_user   ON sync_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sync_device ON sync_queue(device_id);

-- ────────────────────────────────────────────────────────────
--  GEODPF PIPELINE (fila de processamento)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geodpf_jobs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  map_id      UUID NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'queued'
              CHECK (status IN ('queued','validating','extracting','converting','done','error')),
  progress    INT DEFAULT 0,     -- 0-100
  log         TEXT[] DEFAULT '{}',
  error_msg   TEXT,
  result      JSONB,             -- bounds, crs, layers, etc.
  started_at  TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geodpf_map    ON geodpf_jobs(map_id);
CREATE INDEX IF NOT EXISTS idx_geodpf_status ON geodpf_jobs(status);

-- ────────────────────────────────────────────────────────────
--  SESSIONS (revogação de tokens)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device_id  TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_user ON refresh_tokens(user_id);

-- ────────────────────────────────────────────────────────────
--  TRIGGERS – atualiza updated_at automaticamente
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','projects','maps','tracks','waypoints']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
  END LOOP;
END $$;
