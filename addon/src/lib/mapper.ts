import type { ActivityImport } from "@wealthfolio/addon-sdk";
import type { MonzoTransaction } from "../types";

// ActivityType values from @wealthfolio/addon-sdk
const DEPOSIT = "DEPOSIT" as ActivityImport["activityType"];
const WITHDRAWAL = "WITHDRAWAL" as ActivityImport["activityType"];

export function isPending(tx: MonzoTransaction): boolean {
  return tx.settled === "";
}

export function isPotTransfer(tx: MonzoTransaction): boolean {
  return tx.metadata?.provider_category === "uk_retail_pot";
}

export function mapTransactionToActivity(
  tx: MonzoTransaction,
  wealthfolioAccountId: string,
): ActivityImport {
  return {
    id: tx.id,
    accountId: wealthfolioAccountId,
    activityType: tx.amount >= 0 ? DEPOSIT : WITHDRAWAL,
    date: tx.created,
    amount: Math.abs(tx.amount) / 100,
    currency: tx.currency,
    comment: tx.description || tx.notes || undefined,
  };
}
