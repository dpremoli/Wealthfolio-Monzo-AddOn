# Monzo → Wealthfolio Addon

A production-grade bridge between Monzo Bank and the Wealthfolio investment tracker.
Automates the import of cash transactions into a Wealthfolio cash account.

## Structure

```
/
├── main.py          # FastAPI proxy (handles OAuth + proxies Monzo API calls)
├── requirements.txt
├── .env.example
└── addon/           # Wealthfolio TypeScript addon
    ├── manifest.json
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── addon.tsx        # Addon entry point
        ├── types.ts
        ├── lib/
        │   ├── proxy-client.ts  # HTTP client for the proxy
        │   └── mapper.ts        # Monzo tx → ActivityImport
        ├── hooks/
        │   ├── use-tokens.ts    # OS-keyring token storage via ctx.api.secrets
        │   └── use-sync.ts      # Full sync orchestration
        └── pages/
            ├── settings-page.tsx  # Proxy URL + OAuth + account mapping
            └── dashboard-page.tsx # Sync status + Sync Now button
```

## How It Works

1. **Proxy** (`main.py`) runs locally and holds `MONZO_CLIENT_SECRET`
2. **Addon** authenticates via OAuth: opens Monzo auth URL, polls `/token-status`
3. **Tokens** stored in Wealthfolio’s OS keyring via `ctx.api.secrets` — never on disk
4. **Sync**: fetches settled (non-pending, non-pot) transactions → deduplicates via `checkImport` → imports

## Quick Start

### 1. Proxy

```bash
cp .env.example .env
# Fill in MONZO_CLIENT_ID and MONZO_CLIENT_SECRET from https://developers.monzo.com
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Addon

```bash
cd addon
npm install
npm run build
# Load dist/addon.js + manifest.json in Wealthfolio
```

### 3. First Use

1. In Wealthfolio, open **Monzo Sync → Settings**
2. Enter proxy URL (`http://localhost:8000`) and save
3. Click **Connect Monzo** — authenticate in the browser window
4. Map each Monzo account to a Wealthfolio cash account
5. Go to **Monzo Sync** and click **Sync Now**

## Security

- `MONZO_CLIENT_SECRET` lives only in the proxy `.env` — never sent to the browser
- Access/refresh tokens stored in the OS keyring via Wealthfolio’s encrypted secrets API
- Tokens are never written to disk or localStorage
- Proxy is stateless: tokens pass through per-request only
