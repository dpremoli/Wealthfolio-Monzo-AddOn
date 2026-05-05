export interface MonzoTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // ms since epoch
  token_type: string;
  user_id: string;
}

export interface MonzoAccount {
  id: string;
  description: string;
  created: string;
}

export interface MonzoTransaction {
  id: string;
  created: string;
  settled: string; // empty string if pending, ISO timestamp if settled
  amount: number; // minor units (pence), negative = debit, positive = credit
  currency: string;
  description: string;
  notes: string;
  category: string;
  is_load: boolean;
  metadata: Record<string, string>;
  decline_reason?: string | null;
}

export interface AccountMapping {
  [monzoAccountId: string]: string; // maps to wealthfolioAccountId
}

export interface SyncResult {
  imported: number;
  skipped: number;
  duplicates: number;
}
