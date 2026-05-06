# Monzo → Wealthfolio Addon

A production-grade bridge between Monzo Bank and Wealthfolio. Automatically sync cash transactions from Monzo into your Wealthfolio portfolio.

---

## 🎯 Overview

This project consists of two parts:

1. **Proxy** (Python/FastAPI) — runs locally, handles OAuth and API proxying
2. **Addon** (TypeScript/React) — loads into Wealthfolio, provides UI for setup and sync

```
┌─────────────────────────────────────────┐
│  Wealthfolio (Docker container)         │
│  ├─ Main UI                             │
│  └─ Monzo Addon (loaded)                │
│      └─ communicates with proxy         │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│  Monzo Proxy (separate Docker container)│
│  - Handles OAuth flow                   │
│  - Proxies Monzo API calls              │
│  - Stores secrets securely              │
└─────────────────────────────────────────┘
            ↓
        Monzo API
```

---

## 📦 Unraid Deployment (Recommended)

### Step 1: Get Monzo API Credentials

1. Go to https://developers.monzo.com
2. Sign in with your Monzo account (or create one)
3. Click **"Create an app"** → name it `Wealthfolio`
4. Select **Confidential (for server-to-server communication)**
5. Set **Redirect URI** to `http://localhost:8000/callback`
6. Copy your **Client ID** and **Client Secret** (save these)

### Step 2: Deploy the Proxy Container

**Via Unraid WebUI (easiest):**

1. Go to **Docker** tab
2. Click **Add Container**
3. Fill in:
   - **Name:** `monzo-proxy`
   - **Repository:** `python:3.11-slim`
   - **Console shell command:** `bash`
   - **Console port:** (leave blank)
4. Click **Advanced view**
5. Under **Volumes**, add:
   - **Container Path:** `/app`
   - **Host Path:** `/mnt/user/appdata/monzo-proxy` (create this folder first)
6. Under **Ports**, add:
   - **Container Port:** `8000`
   - **Host Port:** `8000`
   - **Connection Type:** `TCP`
7. Under **Environment Variables**, add:
   - **Key:** `MONZO_CLIENT_ID` → **Value:** `(your client ID)`
   - **Key:** `MONZO_CLIENT_SECRET` → **Value:** `(your client secret)`
   - **Key:** `REDIRECT_URI` → **Value:** `http://192.168.1.X:8000/callback` (your Unraid IP, not 172.x.x.x)
   - **Key:** `PORT` → **Value:** `8000`
8. Under **Post Arguments**, add:
```
bash -c "pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port 8000"
```
9. Click **Apply** and **Save**

**Via CLI/SSH (copy-paste):**

First, clone the repo or download the files:
```bash
cd /mnt/user/appdata
git clone https://github.com/dpremoli/MonzoAddOn.git monzo-proxy
cd monzo-proxy
```

Then run:
```bash
docker run -d \
  --name monzo-proxy \
  --restart unless-stopped \
  -p 8000:8000 \
  -e MONZO_CLIENT_ID="your_client_id" \
  -e MONZO_CLIENT_SECRET="your_client_secret" \
  -e REDIRECT_URI="http://192.168.1.X:8000/callback" \
  -v /mnt/user/appdata/monzo-proxy:/app \
  -w /app \
  python:3.11-slim \
  bash -c "pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port 8000"
```

Replace `192.168.1.X` with your Unraid server's IP address.

**Test the proxy:**
```bash
curl http://192.168.1.X:8000/health
# Should return: {"status":"ok"}
```

### Step 3: Build the Addon

On your local machine (Mac/Linux/Windows):

```bash
cd addon
npm install
npm run build

# Alternatively, create a bundle ZIP:
npm run bundle
```

This creates:
- `addon/dist/addon.js` (compiled addon code)
- `addon/manifest.json` (addon metadata)

### Step 4: Load the Addon into Wealthfolio

**Option A: Copy files directly to Wealthfolio's addon directory**

On your Unraid server via SSH:
```bash
# Find Wealthfolio's appdata folder (usually contains data/ subdirectory)
# Copy addon files:
cp /path/to/addon/manifest.json /mnt/user/appdata/wealthfolio/addons/
cp /path/to/addon/dist/addon.js /mnt/user/appdata/wealthfolio/addons/monzo-addon.js

# Restart Wealthfolio container
docker restart wealthfolio
```

**Option B: Use Wealthfolio's addon manager** (if available in your version)

1. In Wealthfolio, look for **Settings → Addons** or **Add-ons Manager**
2. Click **"Install from files"** or similar
3. Upload `addon/manifest.json` and `addon/dist/addon.js`

### Step 5: Configure the Addon

1. Open Wealthfolio
2. Look for **Monzo Sync** in the sidebar (should appear after load)
3. Click **Monzo Sync → Settings**
4. Enter proxy URL: **`http://192.168.1.X:8000`** (your Unraid IP)
5. Click **Connect Monzo**
6. A browser window will open — authenticate with Monzo
7. Once authenticated, return to Settings
8. Map your Monzo account to a Wealthfolio cash account
9. Click **Save Mapping**
10. Go to **Monzo Sync** main page
11. Click **Sync Now** to import transactions

---

## 🖥️ Docker Troubleshooting

### Container won't start

**Check logs:**
```bash
docker logs monzo-proxy
```

**Common issues:**
- `ModuleNotFoundError: No module named 'fastapi'` → pip install failed. Check network.
- `Address already in use` → Port 8000 is occupied. Change host port to `8001:8000`.
- `MONZO_CLIENT_ID not found` → Environment variables not set properly in Docker.

### Addon can't reach proxy

**Test connectivity from Wealthfolio container:**
```bash
docker exec wealthfolio curl http://172.17.0.X:8000/health
# OR if on host network:
curl http://localhost:8000/health
```

**If using bridge network:**
- Use the proxy's container IP (e.g., `http://172.17.0.5:8000`)
- OR use `--network host` when creating proxy container (more direct, less isolated)

**If Wealthfolio can't access proxy:**
- Make sure both containers are on the same Docker network
- Or expose proxy on host port (which we did above with `-p 8000:8000`)

### OAuth callback fails

**Check that `REDIRECT_URI` matches:**
- In Monzo app credentials: `http://YOUR_UNRAID_IP:8000/callback`
- NOT `http://172.17.0.X:8000/callback` (internal IP)
- NOT `http://localhost:8000/callback` (unless testing locally)

---

## 🔒 Security

✅ **Client Secret**
- Stored only in proxy container `.env` (or environment variables)
- Never sent to browser or Wealthfolio addon
- Never logged or exposed

✅ **Access/Refresh Tokens**
- Stored in Wealthfolio's OS keyring (encrypted)
- Never written to disk or localStorage
- Automatically refreshed before expiry

✅ **Proxy Stateless**
- Tokens only live in proxy memory during OAuth callback → polling window (few seconds)
- After addon stores them in keyring, proxy has no token data

---

## 📋 Full Architecture

### Proxy Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| GET | `/auth` | Get Monzo OAuth URL |
| GET | `/callback?code=X&state=Y` | OAuth callback (Monzo redirects here) |
| GET | `/token-status?state=X` | Poll for tokens after OAuth |
| POST | `/refresh` | Refresh expired access token |
| GET | `/accounts?account_type=uk_retail` | List user's Monzo accounts |
| GET | `/transactions?account_id=X&since=Y` | List transactions for account |

### Addon Features

- **Settings Page**
  - Enter proxy URL
  - OAuth connect button (opens browser)
  - Account mapping UI (Monzo → Wealthfolio)

- **Dashboard Page**
  - Sync Now button
  - Last sync timestamp
  - Results (imported, skipped, duplicates)
  - Connection status

- **Background Sync**
  - Incremental: only fetches transactions since last sync
  - Deduplication: `checkImport` API prevents duplicates
  - Filtering: skips pending transactions and pot transfers
  - Token refresh: automatic with 5-minute buffer

---

## 🛠️ Development

### Modify the Addon

```bash
cd addon
npm install          # First time only
npm run dev          # Watch mode (rebuilds on save)
# Or for one-time build:
npm run build
```

### Deploy Modified Addon

```bash
npm run bundle       # Creates dist/monzo-addon-1.0.0.zip
# Copy addon/dist/addon.js to Wealthfolio's addon directory
# Restart Wealthfolio
```

### Modify the Proxy

```bash
# SSH into Unraid
docker exec -it monzo-proxy bash
# Edit main.py, then restart
docker restart monzo-proxy
```

---

## 📚 Project Structure

```
/
├── main.py                    # FastAPI proxy
├── requirements.txt           # Python deps
├── .env.example               # Template
├── README.md                  # This file
└── addon/                     # TypeScript addon
    ├── manifest.json
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── src/
    │   ├── addon.tsx          # Entry point
    │   ├── types.ts
    │   ├── lib/
    │   │   ├── proxy-client.ts    # HTTP client
    │   │   └── mapper.ts          # Monzo → ActivityImport
    │   ├── hooks/
    │   │   ├── use-tokens.ts      # Token management
    │   │   └── use-sync.ts        # Sync logic
    │   └── pages/
    │       ├── settings-page.tsx  # Configuration UI
    │       └── dashboard-page.tsx # Sync status UI
```

---

## ❓ FAQ

**Q: Can I run this on the same container as Wealthfolio?**
A: Not easily. The proxy needs Python; Wealthfolio is a Node.js/Tauri app. Separate containers are cleaner.

**Q: What if my Unraid IP changes?**
A: The proxy container will still work (bound to port 8000). Just update the proxy URL in Wealthfolio addon settings.

**Q: How often should I sync?**
A: Manually whenever you want, or set up a cron job to call the proxy's `/transactions` endpoint regularly.

**Q: Will pending transactions import?**
A: No. Addon filters them out automatically (only syncs settled transactions).

**Q: Can multiple Monzo accounts map to the same Wealthfolio account?**
A: Yes, just map each Monzo account to the same Wealthfolio cash account. Transactions will merge.

---

## 📝 License

MIT

---

## 🙋 Support

- **Proxy won't start?** Check `docker logs monzo-proxy`
- **Addon not loading?** Verify files are in Wealthfolio's addon directory
- **OAuth fails?** Double-check `REDIRECT_URI` matches your Unraid IP
- **Transactions not syncing?** Check proxy URL is reachable from Wealthfolio container

Good luck! 🚀
