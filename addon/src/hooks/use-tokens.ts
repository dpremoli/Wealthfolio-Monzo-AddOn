import { useCallback } from "react";
import { useAddonContext } from "@wealthfolio/addon-sdk";
import { MonzoTokens } from "@/types";

const STORAGE_KEY = "monzo_tokens";

export function useTokens() {
  const ctx = useAddonContext();

  const getTokens = useCallback(async (): Promise<MonzoTokens | null> => {
    try {
      const stored = await ctx.api.secrets.get(STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }, [ctx.api.secrets]);

  const setTokens = useCallback(
    async (tokens: MonzoTokens) => {
      await ctx.api.secrets.set(STORAGE_KEY, JSON.stringify(tokens));
    },
    [ctx.api.secrets]
  );

  const clearTokens = useCallback(async () => {
    await ctx.api.secrets.delete(STORAGE_KEY);
  }, [ctx.api.secrets]);

  const isTokenExpired = useCallback((tokens: MonzoTokens | null): boolean => {
    if (!tokens) return true;
    const expiresAt = tokens.expires_at;
    const buffer = 5 * 60 * 1000;
    return Date.now() > expiresAt - buffer;
  }, []);

  return {
    getTokens,
    setTokens,
    clearTokens,
    isTokenExpired,
  };
}
