# Monzo → Wealthfolio Integration

A bridge between your Monzo bank account and Wealthfolio investment tracker. Automatically import your bank transactions as activities with zero manual effort.

**Architecture**: FastAPI proxy (holds client credentials securely) + TypeScript addon (runs in Wealthfolio, provides UI).

## Quick Start

### Prerequisites

- Python 3.9+
- [Monzo API credentials](https://developers.monzo.com/)
- Wealthfolio 3.3.0+ with addon support
- Docker (optional but recommended)

### 1. Get Monzo Credentials

1. Go to [Monzo Developers](https://developers.monzo.com/)
2. Create an OAuth client
3. Set redirect URI to `http://localhost:8000/callback` (or your production URL)
4. Copy your **Client ID** and **Client Secret**

### 2. Start the Proxy

**Option A: Docker (Recommended)**

```bash
docker run -d \
  -e MONZO_CLIENT_ID=your_client_id \
  -e MONZO_CLIENT_SECRET=your_client_secret \
  -p 8000:8000 \
  --name monzo-proxy \
  monzo-addon:latest
```

**Option B: Manual Python**

```bash
cp .env.example .env
# Edit .env with your credentials
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 3. Install Addon in Wealthfolio

1. Build the addon: `cd addon && pnpm build`
2. Create ZIP: `cd addon && pnpm package`
3. In Wealthfolio: Settings → Addons → Upload `addon/dist/monzo-addon-*.zip`
4. Enable the addon

### 4. Configure & Sync

1. Go to "Monzo Sync" in sidebar
2. Settings → Enter proxy URL (e.g., `http://localhost:8000`)
3. Click "Connect Monzo Account" and authenticate
4. Map your Monzo accounts to Wealthfolio accounts
5. Go to dashboard and click "Sync Now"

---

## Unraid Deployment

### Step 1: Get Monzo API Credentials

1. Go to https://developers.monzo.com
2. Sign in with your Monzo account
3. Click **"Create an app"** → name it `Wealthfolio`
4. Select **Confidential (for server-to-server communication)**
5. Set **Redirect URI** to `http://YOUR_UNRAID_IP:8000/callback`
6. Copy your **Client ID** and **Client Secret**

### Step 2: Deploy the Proxy Container

**Via Unraid WebUI:**

1. Go to **Docker** tab → **Add Container**
2. Fill in **Name:** `monzo-proxy`, **Repository:** `python:3.11-slim`
3. Under **Volumes**: Container Path `/app` → Host Path `/mnt/user/appdata/monzo-proxy`
4. Under **Ports**: Container `8000` → Host `8000` (TCP)
5. Under **Environment Variables**:
   - `MONZO_CLIENT_ID` → your client ID
   - `MONZO_CLIENT_SECRET` → your client secret
   - `REDIRECT_URI` → `http://192.168.1.X:8000/callback` (your Unraid IP)
   - `PORT` → `8000`
6. Under **Post Arguments**:
   ```
   bash -c "pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port 8000"
   ```

**Via CLI/SSH:**

```bash
cd /mnt/user/appdata
git clone https://github.com/dpremoli/MonzoAddOn.git monzo-proxy
cd monzo-proxy

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

**Test the proxy:**
```bash
curl http://192.168.1.X:8000/health
# Should return: {"status":"ok"}
```

### Step 3: Build and Load the Addon

```bash
cd addon
npm install
npm run build
npm run bundle   # Creates dist/monzo-addon-1.0.0.zip
```

In Wealthfolio: Settings → Addons → Install from ZIP → upload the generated ZIP.

---

## Architecture

### Proxy (Python FastAPI)

Runs on your machine or server. Responsibilities:

- **OAuth handler**: Issues state tokens, exchanges auth codes for tokens
- **Token manager**: Stores tokens in memory (not persisted), handles refresh
- **Monzo API proxy**: Proxies account and transaction queries with auth header
- **Client credential holder**: Client Secret never leaves the proxy

### Addon (TypeScript/React)

Runs inside Wealthfolio. Responsibilities:

- **UI**: Settings (proxy config, OAuth), Dashboard (sync status)
- **Token storage**: Keeps tokens in OS keyring via `ctx.api.secrets`
- **Sync orchestration**: Fetches transactions, filters, dedupes, imports
- **Account mapping**: Links Monzo accounts to Wealthfolio accounts

### Token Flow

```
User clicks "Connect"
  ↓
Addon → Proxy GET /auth → Returns auth URL + state
  ↓
Addon opens browser to Monzo auth URL
  ↓
User approves → Monzo redirects to Proxy /callback with code
  ↓
Proxy exchanges code for tokens (using Client Secret)
  ↓
Tokens stored in Proxy memory dict pending_tokens[state]
  ↓
Addon polls Proxy GET /token-status?state=X every 2s
  ↓
Proxy returns tokens → Addon stores in OS keyring
```

### Sync Flow

```
User clicks "Sync Now"
  ↓
Addon gets tokens from OS keyring
  ↓
If tokens expired (> 5 min until expiry), call Proxy POST /refresh
  ↓
For each mapped account:
  - Fetch transactions since last sync
  - Filter: skip pending (settled=""), skip pots
  - Check for duplicates via checkImport
  - Import non-duplicates
  ↓
Update last_sync timestamp
```

---

## Configuration

### Proxy Environment Variables

```bash
MONZO_CLIENT_ID=your_client_id           # Required
MONZO_CLIENT_SECRET=your_client_secret   # Required
REDIRECT_URI=http://localhost:8000/callback
PORT=8000
```

### Addon Configuration (UI)

1. **Proxy URL**: Full URL to your running proxy
2. **Monzo Authentication**: One-click OAuth via browser
3. **Account Mapping**: Link each Monzo account to Wealthfolio account

---

## API Reference

### Proxy Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| GET | `/auth` | Get Monzo OAuth URL + state token |
| GET | `/callback?code=X&state=Y` | OAuth callback (Monzo redirects here) |
| GET | `/token-status?state=X` | Poll for tokens after OAuth |
| POST | `/refresh` | Refresh expired access token |
| GET | `/accounts?account_type=uk_retail` | List user's Monzo accounts |
| GET | `/transactions?account_id=X&since=Y` | List transactions for account |

---

## Data Privacy & Security

- **No credential storage in addon**: Client Secret never leaves proxy
- **Tokens in OS keyring**: Addon stores via `ctx.api.secrets` (encrypted)
- **Proxy is stateless**: Tokens not persisted (in-memory only)
- **HTTPS in production**: Configure redirect URI and proxy with TLS
- **No third-party**: All data stays between your machine, Monzo, and Wealthfolio

---

## Docker Deployment

### Build Image

```bash
docker build -t monzo-addon:latest .
```

### Run Container

```bash
docker run -d \
  -e MONZO_CLIENT_ID=your_id \
  -e MONZO_CLIENT_SECRET=your_secret \
  -e REDIRECT_URI=https://your-domain.com:8000/callback \
  -p 8000:8000 \
  --restart unless-stopped \
  --name monzo-proxy \
  monzo-addon:latest
```

### Docker Compose

```yaml
version: "3.8"
services:
  monzo-proxy:
    image: monzo-addon:latest
    ports:
      - "8000:8000"
    environment:
      MONZO_CLIENT_ID: ${MONZO_CLIENT_ID}
      MONZO_CLIENT_SECRET: ${MONZO_CLIENT_SECRET}
      REDIRECT_URI: ${REDIRECT_URI:-http://localhost:8000/callback}
    restart: unless-stopped
```

---

## Development

### Install Dependencies

**Proxy**:
```bash
pip install -r requirements.txt
```

**Addon**:
```bash
cd addon
pnpm install
```

### Run Locally

**Proxy** (terminal 1):
```bash
uvicorn main:app --reload
```

**Addon dev server** (terminal 2):
```bash
cd addon
pnpm dev:server
```

### Build Addon

```bash
cd addon
pnpm build        # Creates dist/addon.js
pnpm package      # Creates dist/monzo-addon-1.0.0.zip
```

---

## Troubleshooting

### Proxy won't start

```bash
# Check Python version
python --version  # Should be 3.9+

# Verify dependencies
pip install -r requirements.txt

# Check port 8000 is available
lsof -i :8000

# Check Docker logs
docker logs monzo-proxy
```

### Addon can't reach proxy

**Test connectivity:**
```bash
curl http://YOUR_PROXY_IP:8000/health
# Should return: {"status":"ok"}
```

**If using bridge network:**
- Use the proxy's container IP (e.g., `http://172.17.0.5:8000`)
- Or use `--network host` when creating proxy container

### "Proxy URL not configured" in Wealthfolio

1. Go to Settings page in addon
2. Enter proxy URL (e.g., `http://localhost:8000`)
3. Click "Save Proxy URL"

### Authentication fails

- Check proxy is running: `curl http://localhost:8000/auth`
- Verify Client ID and Secret are correct
- Check `REDIRECT_URI` matches your host IP (not `172.x.x.x` internal IP)
- Check proxy logs for OAuth errors

### OAuth callback fails

- Ensure `REDIRECT_URI` in proxy matches your Monzo app credentials exactly
- Use your Unraid/host IP, not a Docker internal IP or `localhost`

### Transactions not syncing

- Ensure addon is authenticated (Settings → Connect Monzo)
- Verify accounts are mapped
- Check browser console for errors: F12 → Console
- Check proxy logs: `docker logs monzo-proxy`

### Duplicate transactions

- Normal on first sync (`checkImport` dedupes automatically)
- Each transaction has a unique Monzo ID used as idempotency key

---

## FAQ

**Q: Can I run this on the same container as Wealthfolio?**
A: Not easily. The proxy needs Python; Wealthfolio is a Node.js/Tauri app. Separate containers are cleaner.

**Q: What if my Unraid IP changes?**
A: The proxy container still works. Just update the proxy URL in Wealthfolio addon settings.

**Q: How often should I sync?**
A: Manually whenever you want, or set up a cron job calling the proxy's `/transactions` endpoint.

**Q: Will pending transactions import?**
A: No. The addon filters them out (only syncs settled transactions).

**Q: Can multiple Monzo accounts map to the same Wealthfolio account?**
A: Yes. Transactions from each Monzo account will merge into the same Wealthfolio account.

---

## Project Structure

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
    │   │   ├── proxy-client.ts
    │   │   └── mapper.ts
    │   ├── hooks/
    │   │   ├── use-tokens.ts
    │   │   └── use-sync.ts
    │   └── pages/
    │       ├── settings-page.tsx
    │       └── dashboard-page.tsx
```

---

## Performance

- **Sync time**: ~1s per 100 transactions
- **Token refresh**: Automatic when < 5 min to expiry
- **Rate limits**: Monzo allows 10 requests/sec per account
- **Memory**: Proxy uses ~50MB (pending_tokens dict cleared after 5 min timeout)

## Future Enhancements

- [ ] Scheduled syncs (background)
- [ ] Pot transfers categorization
- [ ] Multi-currency support
- [ ] Split transactions

## License

MIT

## Support

- Monzo API docs: https://docs.monzo.com/
- Wealthfolio addon SDK: https://github.com/afadil/wealthfolio

---

**⚠️ Security Note**: Never commit `.env` or expose Client Secret. Use environment variables or secure vaults in production.
