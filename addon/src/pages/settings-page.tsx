import { useEffect, useState } from "react";
import { useAddonContext } from "@wealthfolio/addon-sdk";
import { Button, Input, Select } from "@wealthfolio/ui";
import { MonzoProxyClient } from "@/lib/proxy-client";
import { MonzoAccount } from "@/types";
import { useTokens } from "@/hooks/use-tokens";
import { useSync } from "@/hooks/use-sync";

export function SettingsPage() {
  const ctx = useAddonContext();
  const { getTokens, setTokens } = useTokens();
  const { getAccountMapping, setAccountMapping } = useSync();

  const [proxyUrl, setProxyUrl] = useState<string>("");
  const [monzoAccounts, setMonzoAccounts] = useState<MonzoAccount[]>([]);
  const [wealthfolioAccounts, setWealthfolioAccounts] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [authInProgress, setAuthInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProxyUrl = async () => {
      try {
        const stored = await ctx.api.secrets.get("monzo_proxy_url");
        if (stored) setProxyUrl(stored);
      } catch {}
    };
    loadProxyUrl();
  }, [ctx.api.secrets]);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const accounts = await ctx.api.accounts.getAll();
        setWealthfolioAccounts(
          accounts.map((a) => ({ id: a.id, name: a.name || a.id }))
        );
      } catch {}
    };
    loadAccounts();
  }, [ctx.api.accounts]);

  useEffect(() => {
    const loadMapping = async () => {
      const stored = await getAccountMapping();
      setMapping(stored);
    };
    loadMapping();
  }, [getAccountMapping]);

  const saveProxyUrl = async () => {
    await ctx.api.secrets.set("monzo_proxy_url", proxyUrl);
  };

  const handleConnect = async () => {
    if (!proxyUrl) {
      setError("Please enter proxy URL first");
      return;
    }

    setAuthInProgress(true);
    setError(null);

    try {
      const client = new MonzoProxyClient(proxyUrl);
      const { url, state } = await client.getAuthUrl();

      window.open(url, "monzo_auth", "width=500,height=600");

      const tokens = await client.pollTokenStatus(state, 150, 2000);
      if (!tokens) {
        setError("Authentication timeout");
        setAuthInProgress(false);
        return;
      }

      await setTokens(tokens);

      const accounts = await client.getAccounts(tokens.access_token);
      setMonzoAccounts(accounts);

      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Authentication failed"
      );
    } finally {
      setAuthInProgress(false);
    }
  };

  const handleMappingChange = (monzoId: string, wealthfolioId: string) => {
    const newMapping = { ...mapping, [monzoId]: wealthfolioId };
    setMapping(newMapping);
  };

  const saveMapping = async () => {
    setLoading(true);
    try {
      await setAccountMapping(mapping);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save mapping"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">Proxy Configuration</h2>
        <div className="space-y-2">
          <Input
            placeholder="http://localhost:8000"
            value={proxyUrl}
            onChange={(e) => setProxyUrl(e.target.value)}
          />
          <Button onClick={saveProxyUrl}>Save Proxy URL</Button>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Authentication</h2>
        <Button
          onClick={handleConnect}
          disabled={authInProgress}
        >
          {authInProgress ? "Authenticating..." : "Connect Monzo Account"}
        </Button>
      </div>

      {monzoAccounts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Account Mapping</h2>
          <div className="space-y-4">
            {monzoAccounts.map((monzoAccount) => (
              <div key={monzoAccount.id} className="flex items-center gap-4">
                <span className="flex-1">{monzoAccount.description}</span>
                <Select
                  value={mapping[monzoAccount.id] || ""}
                  onChange={(value) =>
                    handleMappingChange(monzoAccount.id, value)
                  }
                >
                  <option value="">Select Wealthfolio account...</option>
                  {wealthfolioAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
            <Button onClick={saveMapping} disabled={loading}>
              Save Mapping
            </Button>
          </div>
        </div>
      )}

      {error && <div className="text-red-600 text-sm">{error}</div>}
    </div>
  );
}
