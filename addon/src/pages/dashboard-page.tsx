import { useEffect, useState } from "react";
import { useAddonContext } from "@wealthfolio/addon-sdk";
import { Button } from "@wealthfolio/ui";
import { useSync } from "@/hooks/use-sync";
import { useTokens } from "@/hooks/use-tokens";
import { SyncResult } from "@/types";

export function DashboardPage() {
  const ctx = useAddonContext();
  const { sync, getLastSync } = useSync();
  const { getTokens } = useTokens();

  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proxyUrl, setProxyUrl] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await ctx.api.secrets.get("monzo_proxy_url");
        if (stored) setProxyUrl(stored);

        const last = await getLastSync();
        if (last) setLastSync(last);
      } catch {}
    };
    load();
  }, [ctx.api.secrets, getLastSync]);

  const handleSync = async () => {
    if (!proxyUrl) {
      setError("Proxy URL not configured");
      return;
    }

    const tokens = await getTokens();
    if (!tokens) {
      setError("Not authenticated. Please go to Settings to connect.");
      return;
    }

    setSyncing(true);
    setError(null);

    try {
      const result = await sync(proxyUrl);
      setSyncResult(result);
      const now = new Date().toISOString();
      setLastSync(now);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">Monzo Sync</h1>

        {lastSync && (
          <p className="text-sm text-gray-600 mb-4">
            Last sync: {new Date(lastSync).toLocaleString()}
          </p>
        )}

        <Button onClick={handleSync} disabled={syncing}>
          {syncing ? "Syncing..." : "Sync Now"}
        </Button>
      </div>

      {syncResult && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded">
            <div className="text-2xl font-bold text-blue-600">
              {syncResult.imported}
            </div>
            <div className="text-sm text-gray-600">Imported</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded">
            <div className="text-2xl font-bold text-yellow-600">
              {syncResult.skipped}
            </div>
            <div className="text-sm text-gray-600">Skipped</div>
          </div>
          <div className="bg-purple-50 p-4 rounded">
            <div className="text-2xl font-bold text-purple-600">
              {syncResult.duplicates}
            </div>
            <div className="text-sm text-gray-600">Duplicates</div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded">{error}</div>
      )}
    </div>
  );
}
