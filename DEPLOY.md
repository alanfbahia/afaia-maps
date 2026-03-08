# 🚀 Deploy – Afaia Maps no Railway + Neon.tech

## Pré-requisitos
- Conta gratuita no [Railway](https://railway.app)
- Conta gratuita no [Neon.tech](https://neon.tech)
- Git instalado na sua máquina
- Node.js 20+ (para testar localmente)

---

## PARTE 1 – Banco de Dados (Neon.tech)

### 1.1 Criar banco no Neon
1. Acesse [neon.tech](https://neon.tech) → **Sign Up** (gratuito)
2. Clique em **"New Project"**
3. Escolha região: **US East (Ohio)** ou **South America (São Paulo)**
4. Nome do banco: `afaiamaps`
5. Copie a **Connection String** (começa com `postgresql://...`)

### 1.2 Ativar PostGIS
No console SQL do Neon:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 1.3 Executar o schema
```bash
# No terminal, com psql instalado:
psql "postgresql://USER:PASS@HOST/afaiamaps?sslmode=require" \
     -f backend/src/db/schema.sql

# OU usando o migration runner do projeto:
cd backend
cp .env.example .env
# Edite .env com sua DATABASE_URL
npm install
npm run migrate
```

---

## PARTE 2 – Backend no Railway

### 2.1 Preparar o repositório
```bash
# Inicializa git se necessário
git init
git add .
git commit -m "feat: afaia maps backend inicial"

# Sobe para o GitHub
gh repo create afaia-maps --public
git push -u origin main
```

### 2.2 Criar projeto no Railway
1. Acesse [railway.app](https://railway.app) → **New Project**
2. Clique em **"Deploy from GitHub repo"**
3. Selecione seu repositório `afaia-maps`
4. Railway detecta o `Dockerfile` automaticamente

### 2.3 Configurar Root Directory
- Nas configurações do serviço → **Root Directory**: `backend`

### 2.4 Configurar variáveis de ambiente
No painel Railway → **Variables**:

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASS@HOST/afaiamaps?sslmode=require
JWT_SECRET=gere_uma_string_aleatoria_256bits_aqui
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://SEU-FRONTEND.vercel.app
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE_MB=200
```

> **Gerar JWT_SECRET seguro:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### 2.5 Adicionar volume persistente
1. Railway → seu serviço → **Settings** → **Volumes**
2. Mount path: `/app/uploads`
3. Isso persiste os arquivos de upload

### 2.6 Deploy
O Railway faz deploy automático a cada push. Para deploy manual:
```bash
railway up
```

### 2.7 Verificar
Após deploy, acesse:
```
https://SEU-APP.railway.app/health
```
Resposta esperada:
```json
{ "status": "ok", "db": "connected", "ts": "2024-..." }
```

---

## PARTE 3 – Frontend (Vercel / Netlify)

### Opção A – Vercel (recomendado)
```bash
cd frontend
npx vercel --prod
```

Ou via interface:
1. [vercel.com](https://vercel.com) → **New Project**
2. Importe o repositório
3. Root directory: `frontend`
4. Framework: **Other** (site estático)

### Opção B – Netlify
1. [netlify.com](https://netlify.com) → **New site from Git**
2. Root directory: `frontend`
3. Publish directory: `frontend`

### Opção C – Railway (mesmo projeto)
Adicione um segundo serviço no Railway:
- Imagem nginx:alpine
- Mount volume: `./frontend:/usr/share/nginx/html`
- Porta: 80

---

## PARTE 4 – Configuração pós-deploy

### 4.1 Atualizar API_BASE no frontend
Em `frontend/js/api.js`, o `API_BASE` é detectado automaticamente:
- `localhost` → `http://localhost:3000/api/v1`
- Produção → `/api/v1` (via proxy nginx)

Para domínio separado, altere:
```javascript
const API_BASE = 'https://seu-backend.railway.app/api/v1';
```

### 4.2 Criar usuário admin inicial
```bash
# Conecte ao banco Neon e execute:
psql $DATABASE_URL -c "
UPDATE users SET role = 'admin' 
WHERE email = 'seu@email.com';
"
```

### 4.3 HTTPS obrigatório para GPS
O GPS (`navigator.geolocation`) exige **HTTPS** em produção.
Railway e Vercel fornecem SSL automático ✅

---

## PARTE 5 – Rodar localmente com Docker

```bash
# 1. Clone o repositório
git clone https://github.com/SEU-USER/afaia-maps.git
cd afaia-maps

# 2. Configure o .env
cp backend/.env.example backend/.env
# Edite backend/.env com suas credenciais

# 3. Sobe tudo
docker-compose up -d

# 4. Aplica o schema
docker-compose exec api npm run migrate

# 5. Acesse
# Frontend: http://localhost:5173
# API:      http://localhost:3000
# Health:   http://localhost:3000/health
```

---

## PARTE 6 – Usar sem Docker (desenvolvimento)

```bash
# Terminal 1 – PostgreSQL local (ou use o Neon)
# Instale PostgreSQL + PostGIS e crie o banco

# Terminal 2 – Backend
cd backend
cp .env.example .env    # edite com suas configs
npm install
npm run migrate         # aplica o schema
npm run dev             # inicia com hot reload

# Terminal 3 – Frontend
cd frontend
npx serve .             # servidor estático simples
# OU abra index.html diretamente no browser
```

---

## Custos estimados (planos gratuitos)

| Serviço | Plano gratuito | Limitação |
|---|---|---|
| **Neon.tech** | Free | 512 MB storage, 1 compute |
| **Railway** | Free trial | $5/mês após trial |
| **Vercel** | Hobby (free) | 100 GB bandwidth |
| **Total inicial** | **~$0** | Para protótipo/MVP |

---

## Troubleshooting

### Erro: "Cannot connect to database"
- Verifique `DATABASE_URL` no Railway
- Neon requer `?sslmode=require` na connection string

### Erro: "PostGIS not found"
- Execute no console Neon: `CREATE EXTENSION IF NOT EXISTS postgis;`

### GPS não funciona
- Certifique-se de estar em HTTPS
- No Android: permita localização "precisão alta" nas configurações

### Upload falha com erro 413
- Aumente `MAX_FILE_SIZE_MB` nas variáveis de ambiente
- No nginx, adicione: `client_max_body_size 200M;`

### CORS error
- Adicione o domínio do frontend em `FRONTEND_URL` no Railway
- Verifique a configuração cors em `backend/src/index.js`
