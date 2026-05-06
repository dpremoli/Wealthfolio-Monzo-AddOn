import { useCallback } from "react";
import { useAddonContext } from "@wealthfolio/addon-sdk";
import { MonzoProxyClient } from "@/lib/proxy-client";
import {
  isPending,
  isPotTransfer,
  mapTransactionToActivity,
} from "@/lib/mapper";
import { AccountMapping, MonzoTokens, SyncResult } from "@/types";
import { useTokens } from "./use-tokens";

const LAST_SYNC_KEY = "monzo_last_sync";
const ACCOUNT_MAPPING_KEY = "monzo_account_mapping";

export function useSync() {
  const ctx = useAddonContext();
  const { getTokens, setTokens, isTokenExpired } = useTokens();

  const getLastSync = useCallback(async (): Promise<string | null> => {
    try {
      return await ctx.api.secrets.get(LAST_SYNC_KEY);
    } catch {
      return null;
    }
  }, [ctx.api.secrets]);

  const setLastSync = useCallback(
    async (timestamp: string) => {
      await ctx.api.secrets.set(LAST_SYNC_KEY, timestamp);
    },
    [ctx.api.secrets]
  );

  const getAccountMapping = useCallback(async (): Promise<AccountMapping> => {
    try {
      const mapping = await ctx.api.secrets.get(ACCOUNT_MAPPING_KEY);
      return mapping ? JSON.parse(mapping) : {};
    } catch {
      return {};
    }
  }, [ctx.api.secrets]);

  const setAccountMapping = useCallback(
    async (mapping: AccountMapping) => {
      await ctx.api.secrets.set(ACCOUNT_MAPPING_KEY, JSON.stringify(mapping));
    },
    [ctx.api.secrets]
  );

  const sync = useCallback(
    async (proxyUrl: string): Promise<SyncResult> => {
      const result: SyncResult = {
        imported: 0,
        skipped: 0,
        duplicates: 0,
      };

      let tokens = await getTokens();
      if (!tokens) throw new Error("Not authenticated");

      if (isTokenExpired(tokens)) {
        const refreshed = await new MonzoProxyClient(proxyUrl).refreshToken(
          tokens.refresh_token
        );
        tokens = refreshed;
        await setTokens(tokens);
      }

      const lastSync = await getLastSync();
      const mapping = await getAccountMapping();

      const client = new MonzoProxyClient(proxyUrl);

      for (const [monzoId, wealthfolioId] of Object.entries(mapping)) {
        const transactions = await client.getTransactions(
          tokens.access_token,
          monzoId,
          lastSync
        );

        const filtered = transactions.filter(
          (tx) => !isPending(tx) && !isPotTransfer(tx)
        );

        const activities = filtered.map(mapTransactionToActivity);

        const checked = await ctx.api.activities.checkImport(activities);
        const nonDuplicates = checked.filter(
          (a) => !a.duplicateOfId
        );

        if (nonDuplicates.length > 0) {
          await ctx.api.activities.import(
            nonDuplicates,
            wealthfolioId
          );
          result.imported += nonDuplicates.length;
        }

        result.duplicates += checked.length - nonDuplicates.length;
        result.skipped += filtered.length - checked.length;
      }

      await setLastSync(new Date().toISOString());

      return result;
    },
    [ctx.api.activities, getTokens, setTokens, isTokenExpired, getLastSync, setLastSync, getAccountMapping]
  );

  return {
    sync,
    getLastSync,
    setLastSync,
    getAccountMapping,
    setAccountMapping,
  };
}
