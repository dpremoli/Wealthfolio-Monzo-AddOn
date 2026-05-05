# Monzo Proxy

A lightweight FastAPI backend proxy that handles Monzo OAuth and proxies authenticated API
requests. Required by the Wealthfolio Monzo Addon.

## Setup

1. Register a **confidential** OAuth client at https://developers.monzo.com
2. Set `Redirect URI` to `http://localhost:8000/callback`
3. Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

4. Install dependencies and start:

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /auth | Generate Monzo OAuth URL + state |
| GET | /callback | OAuth callback — exchanges code for tokens |
| GET | /token-status?state= | Poll for tokens after OAuth |
| POST | /refresh | Refresh access token |
| GET | /accounts | Proxy to Monzo `/accounts` |
| GET | /transactions | Proxy to Monzo `/transactions` |

## Security

Tokens are **never stored** by the proxy. They live in memory only between the OAuth callback
and the addon's first `/token-status` poll (seconds). After that, the Wealthfolio addon stores
them in the OS keyring via the encrypted secrets API.

## Development

```bash
uvicorn main:app --reload
```
