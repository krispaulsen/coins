# Coin Collection Catalog

Catalog and value a personal numismatic collection. Users sign in, add coins and other items with photos and metal composition, and see **melt value** from live spot prices.

| Layer | Tech | Host (free tier) |
|-------|------|------------------|
| Frontend | React (Vite, JSX) + Tailwind | Vercel Hobby |
| API | Node.js + Express | Render Free Web Service |
| Database + images | MongoDB Atlas M0 + GridFS | MongoDB Atlas |
| Spot prices | MetalMetric (primary), AURUM (fallback) | No API key |

**JavaScript only** — no TypeScript on client or server.

---

## Repository layout

```
coin-collection/
  client/                 # React + Vite SPA
    src/pages/            # Login, Register, Dashboard, ItemDetail, ItemForm
    src/components/       # Layout, CompositionEditor, ImageSlotUpload, etc.
    src/api/client.js     # Axios + JWT interceptor
    vercel.json
  server/                 # Express API
    src/routes/           # auth, items, images, metals
    src/models/           # User, Item, SpotPriceCache
    src/services/         # gridfs, spotPrices, metalValue
    render.yaml
  README.md
```

---

## Local development

### Prerequisites

- Node.js 20+
- A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) M0 cluster (or local MongoDB)

### 1. MongoDB Atlas

1. Create a free **M0** cluster.
2. Create a database user (username + password).
3. Network Access → allow `0.0.0.0/0` for local/dev (tighten later if you like).
4. Connect → Drivers → copy the URI, replace `<password>`, and set the DB name, e.g. `coin-collection`:

   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/coin-collection?retryWrites=true&w=majority
   ```

### 2. Server

```bash
cd server
cp .env.example .env
# Edit .env: MONGODB_URI, JWT_SECRET, CLIENT_URL
npm install
npm run dev
```

Generate a JWT secret:

```bash
# PowerShell
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]]).ToLower()

# or OpenSSL if available
openssl rand -hex 32
```

Server defaults to `http://localhost:5000`. Health check: `GET /api/health`.

### 3. Client

```bash
cd client
cp .env.example .env
# VITE_API_URL=http://localhost:5000
npm install
npm run dev
```

App defaults to `http://localhost:5173`.

### Environment variables

**Server (`server/.env`)**

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | Atlas connection string |
| `JWT_SECRET` | Signing secret for auth tokens |
| `CLIENT_URL` | Allowed CORS origin(s), comma-separated |
| `PORT` | HTTP port (default `5000`) |

**Client (`client/.env`)**

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | API base URL (no trailing `/api`) |

No paid third-party API keys are required for the MVP.

---

## Features

- **Auth** — email/password register & login, JWT (7-day expiry), rate-limited auth routes
- **Items** — CRUD for coins, tokens, medals, banknotes, etc., scoped to the signed-in user
- **Images** — obverse, reverse, and additional photos stored in GridFS; resized with `sharp` (max 1200px JPEG)
- **Composition** — metal rows (gold, silver, copper, platinum, palladium, nickel) with percent and purity
- **Melt value** — troy-oz weight × spot price, cached ~60 minutes in MongoDB

### Metal value formula

For each composition row:

```
metalWeightOz = (weightGrams × percent/100 × purity) / 31.1034768
entryValue    = metalWeightOz × pricePerTroyOzUsd
```

Sum of entries → `metalValueUsd` on the item.

### API overview

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Return JWT |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/items` | List / create |
| GET/PUT/DELETE | `/api/items/:id` | Detail / update / delete |
| POST | `/api/items/:id/images/:slot` | Upload (`obverse` \| `reverse` \| `additional`) |
| DELETE | `/api/items/:id/images/:fileId` | Remove image |
| GET | `/api/images/:fileId` | Stream image (auth + ownership) |
| GET | `/api/metals/spot` | Cached spot prices |
| POST | `/api/items/:id/recalculate-value` | Refresh melt value |

---

## Deploy (free tiers)

### 1. GitHub

```bash
git init
git add .
git commit -m "Initial coin collection catalog app"
# Create empty repo on GitHub, then:
git remote add origin https://github.com/YOUR_USER/coin-collection.git
git branch -M main
git push -u origin main
```

### 2. Render (API)

1. New **Web Service** from the GitHub repo (Free plan).
2. Root directory: `server`
3. Build: `npm install`
4. Start: `npm start`
5. Env vars: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL` (set after Vercel URL is known)
6. Optional blueprint: `server/render.yaml`

Free tier sleeps after ~15 minutes idle (~30s cold start).

Atlas Network Access must allow Render (use `0.0.0.0/0` on free tier).

### 3. Vercel (frontend)

1. Import the same GitHub repo (Hobby).
2. Root directory: `client`
3. Framework: Vite
4. Env: `VITE_API_URL` = `https://YOUR-SERVICE.onrender.com`
5. SPA rewrites are in `client/vercel.json`

### 4. Wire CORS

Set Render `CLIENT_URL` to your Vercel production URL (and preview origins if needed, comma-separated).

### 5. Smoke test

Register → login → add item → upload obverse/reverse → set composition + weight → confirm melt value.

---

## Security notes

- Passwords hashed with bcrypt (cost 12)
- Item and image routes enforce ownership
- Auth endpoints rate-limited
- Uploads: JPEG/PNG/WebP only, max 5 MB, resized server-side
- Never put `JWT_SECRET` or `MONGODB_URI` in the client

---

## Out of scope (MVP)

Multi-user sharing, collector (numismatic) value vs melt, barcode/PCGS lookup, CSV import/export, native mobile apps.
