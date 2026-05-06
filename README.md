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

## API Reference

### Proxy Endpoints

All endpoints handle CORS (allow all origins for browser addon).

**GET /auth**
- Returns: `{url: string, state: string}`
- Purpose: Get Monzo OAuth URL and state token

**GET /callback?code=X&state=Y**
- Purpose: OAuth callback (called by Monzo after user approves)
- Returns: HTML confirmation page
- Side effect: Stores tokens in `pending_tokens[state]`

**GET /token-status?state=X**
- Returns: `{ready: bool, tokens?: {...}}`
- Purpose: Poll for tokens after OAuth
- Side effect: Pops from pending_tokens on success

**POST /refresh**
- Body: `{refresh_token: string}`
- Returns: `{access_token, refresh_token, expires_in, token_type}`
- Purpose: Refresh expired access token
- Note: Monzo returns new refresh_token (single-use)

**GET /accounts?account_type=uk_retail**
- Query: Authorization header (addon passes as query param)
- Returns: `{accounts: MonzoAccount[]}`
- Purpose: List user's accounts

**GET /transactions?account_id=X&since=Y**
- Query: Authorization header, account_id, since (optional ISO date)
- Returns: `{transactions: MonzoTransaction[]}`
- Purpose: Fetch transactions with optional incremental sync

## Data Privacy & Security

- **No credential storage in addon**: Client Secret never leaves proxy
- **Tokens in OS keyring**: Addon stores via `ctx.api.secrets` (encrypted)
- **Proxy is stateless**: Tokens not persisted (in-memory only)
- **HTTPS in production**: Configure redirect URI and proxy with TLS
- **No third-party**: All data stays between your machine, Monzo, and Wealthfolio

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

## Troubleshooting

### Proxy won't start

```bash
# Check Python version
python --version  # Should be 3.9+

# Verify dependencies
pip install -r requirements.txt

# Check port 8000 is available
lsof -i :8000
```

### "Proxy URL not configured" in Wealthfolio

1. Go to Settings page in addon
2. Enter proxy URL (e.g., `http://localhost:8000`)
3. Click "Save Proxy URL"
4. Go back to main dashboard

### Authentication fails

- Check proxy is running: `curl http://localhost:8000/auth`
- Verify Client ID and Secret are correct
- Check .env file: `cat .env` (never commit this!)
- Check proxy logs for OAuth errors

### Transactions not syncing

- Ensure addon is authenticated (Settings → Connect Monzo)
- Verify accounts are mapped
- Check browser console for errors: F12 → Console
- Check proxy logs: `docker logs monzo-proxy`

### Duplicate transactions

- Normal on first sync (checkImport dedupes)
- Run sync again if duplicates appear
- Each transaction has unique Monzo ID (idempotencyKey)

## Performance

- **Sync time**: ~1s per 100 transactions
- **Token refresh**: Automatic when < 5 min to expiry
- **Rate limits**: Monzo allows 10 requests/sec per account
- **Memory**: Proxy uses ~50MB (in-memory pending_tokens dict cleared after 5 min timeout)

## Future Enhancements

- [ ] Scheduled syncs (background)
- [ ] Pot transfers categorization
- [ ] Multi-currency support
- [ ] Split transactions
- [ ] Decline reason logging

## License

MIT

## Support

- Check `addon/README.md` for addon-specific troubleshooting
- Monzo API docs: https://docs.monzo.com/
- Wealthfolio addon SDK: https://github.com/afadil/wealthfolio

---

**⚠️ Security Note**: Never commit `.env` or expose Client Secret. Use environment variables or secure vaults in production.
