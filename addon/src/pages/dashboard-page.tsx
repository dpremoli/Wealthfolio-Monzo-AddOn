import { useQuery } from "@tanstack/react-query";
import type { AddonContext } from "@wealthfolio/addon-sdk";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wealthfolio/ui";
import React from "react";
import { useSync } from "../hooks/use-sync";
import { getTokens } from "../hooks/use-tokens";

const LAST_SYNC_KEY = "monzo_last_sync";

export default function DashboardPage({ ctx }: { ctx: AddonContext }) {
  const { isSyncing, lastResult, error, sync } = useSync(ctx);

  const { data: tokens } = useQuery({
    queryKey: ["monzo_tokens"],
    queryFn: () => getTokens(ctx),
  });

  const { data: lastSyncIso } = useQuery({
    queryKey: ["monzo_last_sync"],
    queryFn: async () => {
      const raw = await ctx.api.secrets.get(LAST_SYNC_KEY);
      return raw ? (JSON.parse(raw) as string) : null;
    },
  });

  const lastSyncDisplay = lastSyncIso ? new Date(lastSyncIso).toLocaleString() : "Never";

  return (
    <div className="space-y-6 p-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Monzo Sync</h1>
          <p className="text-muted-foreground mt-1">Sync Monzo transactions into Wealthfolio.</p>
        </div>
        <Button onClick={sync} disabled={isSyncing || !tokens} size="lg">
          {isSyncing ? "Syncing…" : "Sync Now"}
        </Button>
      </div>

      {!tokens && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Not connected to Monzo.{" "}
              <button
                className="underline"
                onClick={() => ctx.api.navigation.navigate("/addons/monzo/settings")}
              >
                Open Settings
              </button>{" "}
              to connect.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>Last sync: {lastSyncDisplay}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isSyncing && (
            <p className="text-sm text-muted-foreground animate-pulse">Syncing transactions…</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {lastResult && !isSyncing && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{lastResult.imported} imported</Badge>
              <Badge variant="outline">{lastResult.duplicates} duplicates skipped</Badge>
              {lastResult.skipped > 0 && (
                <Badge variant="outline">{lastResult.skipped} skipped</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
