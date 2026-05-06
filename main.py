import os
import secrets
import httpx
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONZO_CLIENT_ID = os.getenv("MONZO_CLIENT_ID")
MONZO_CLIENT_SECRET = os.getenv("MONZO_CLIENT_SECRET")
REDIRECT_URI = os.getenv("REDIRECT_URI", "http://localhost:8000/callback")
MONZO_AUTH_URL = "https://auth.monzo.com"
MONZO_API_URL = "https://api.monzo.com"

pending_tokens: dict[str, dict] = {}
auth_states: dict[str, str] = {}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    token_type: str
    user_id: str


class AuthUrlResponse(BaseModel):
    url: str
    state: str


class TokenStatusResponse(BaseModel):
    ready: bool
    tokens: Optional[TokenResponse] = None


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenRefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    token_type: str


@app.get("/auth", response_model=AuthUrlResponse)
async def get_auth_url():
    state = secrets.token_urlsafe(32)
    auth_states[state] = state

    auth_url = (
        f"{MONZO_AUTH_URL}/"
        f"?client_id={MONZO_CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code"
        f"&state={state}"
    )

    return {"url": auth_url, "state": state}


@app.get("/callback")
async def callback(code: str = Query(...), state: str = Query(...)):
    if state not in auth_states:
        return HTMLResponse(
            "<html><body><p>Invalid state parameter</p></body></html>",
            status_code=400
        )

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{MONZO_API_URL}/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": MONZO_CLIENT_ID,
                "client_secret": MONZO_CLIENT_SECRET,
                "redirect_uri": REDIRECT_URI,
                "code": code,
            }
        )

    if response.status_code != 200:
        return HTMLResponse(
            "<html><body><p>Failed to exchange authorization code</p></body></html>",
            status_code=400
        )

    token_data = response.json()
    expires_at = datetime.utcnow() + timedelta(seconds=token_data["expires_in"])

    pending_tokens[state] = {
        "access_token": token_data["access_token"],
        "refresh_token": token_data["refresh_token"],
        "expires_in": token_data["expires_in"],
        "expires_at": expires_at.isoformat(),
        "token_type": token_data.get("token_type", "Bearer"),
        "user_id": token_data.get("user_id", ""),
    }

    del auth_states[state]

    return HTMLResponse(
        "<html><body><p>Authorization successful! You can close this window.</p></body></html>"
    )


@app.get("/token-status", response_model=TokenStatusResponse)
async def get_token_status(state: str = Query(...)):
    if state in pending_tokens:
        tokens = pending_tokens.pop(state)
        return {"ready": True, "tokens": tokens}

    return {"ready": False, "tokens": None}


@app.post("/refresh", response_model=TokenRefreshResponse)
async def refresh_token(request: RefreshRequest):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{MONZO_API_URL}/oauth/token",
            data={
                "grant_type": "refresh_token",
                "client_id": MONZO_CLIENT_ID,
                "client_secret": MONZO_CLIENT_SECRET,
                "refresh_token": request.refresh_token,
            }
        )

    if response.status_code != 200:
        return {"status": "error"}, 400

    token_data = response.json()
    return {
        "access_token": token_data["access_token"],
        "refresh_token": token_data["refresh_token"],
        "expires_in": token_data["expires_in"],
        "token_type": token_data.get("token_type", "Bearer"),
    }


@app.get("/accounts")
async def get_accounts(
    authorization: str = Query(..., alias="Authorization"),
    account_type: Optional[str] = Query(None),
):
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": authorization}
        url = f"{MONZO_API_URL}/accounts"
        if account_type:
            url += f"?account_type={account_type}"

        response = await client.get(url, headers=headers)

    if response.status_code != 200:
        return {"error": "Failed to fetch accounts"}, response.status_code

    return response.json()


@app.get("/transactions")
async def get_transactions(
    authorization: str = Query(..., alias="Authorization"),
    account_id: str = Query(...),
    since: Optional[str] = Query(None),
):
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": authorization}
        params = {"account_id": account_id}
        if since:
            params["since"] = since

        response = await client.get(
            f"{MONZO_API_URL}/transactions",
            headers=headers,
            params=params,
        )

    if response.status_code != 200:
        return {"error": "Failed to fetch transactions"}, response.status_code

    return response.json()
