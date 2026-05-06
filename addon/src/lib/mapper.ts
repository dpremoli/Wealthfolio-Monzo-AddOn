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
  // Convert Monzo amount from pence (minor units) to decimal
  const amountInPounds = Math.abs(tx.amount) / 100;
  
  // Parse the date - Monzo returns ISO string
  const dateObj = new Date(tx.created);
  const dateString = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  const activity: ActivityImport = {
    id: tx.id,
    accountId: wealthfolioAccountId,
    activityType: tx.amount >= 0 ? DEPOSIT : WITHDRAWAL,
    date: dateString,
    amount: Math.round(amountInPounds * 100) / 100, // Round to 2 decimals
  };
  
  // Add optional fields only if they exist
  if (tx.description) {
    activity.comment = tx.description;
  } else if (tx.notes) {
    activity.comment = tx.notes;
  }
  
  return activity;
}
