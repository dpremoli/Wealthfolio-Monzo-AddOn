import type { ActivityImport } from "@wealthfolio/addon-sdk";
import type { MonzoTransaction } from "../types";

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
  const amountInMajorUnits = Math.abs(tx.amount) / 100;
  const dateString = new Date(tx.created).toISOString().split("T")[0]; // YYYY-MM-DD
  const currency = tx.currency || "GBP";

  return {
    id: tx.id,
    accountId: wealthfolioAccountId,
    activityType: tx.amount >= 0 ? DEPOSIT : WITHDRAWAL,
    date: dateString,
    amount: Math.round(amountInMajorUnits * 100) / 100,
    currency,
    symbol: currency, // required by the API; use currency code for cash transactions
    isValid: true,    // required
    isDraft: false,   // required
    comment: tx.description || tx.notes || undefined,
  };
}
