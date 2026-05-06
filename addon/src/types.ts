export interface MonzoTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
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
  settled: string;
  amount: number;
  currency: string;
  description: string;
  notes: string;
  category: string;
  is_load: boolean;
  metadata: {
    provider_category?: string;
    [key: string]: any;
  };
  decline_reason?: string;
}

export interface AccountMapping {
  [monzoId: string]: string;
}

export interface SyncResult {
  imported: number;
  skipped: number;
  duplicates: number;
}
