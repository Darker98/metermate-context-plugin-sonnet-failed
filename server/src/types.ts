export type TransactionType =
  | 'subscription'
  | 'usage'
  | 'plan_change'
  | 'lifecycle'
  | 'invoice'
  | 'digest';

export type TransactionState = 'started' | 'in_progress' | 'completed' | 'failed';

export type CollectionMethodType = 'automatic' | 'remittance';

export type LifecycleAction = 'pause' | 'resume' | 'cancel' | 'reactivate';

export type CancelType = 'immediate' | 'end-of-period';

export type PlanTiming = 'prorate' | 'at-renewal';

export interface Transaction {
  txnId: string;
  consultantId: string;
  clientEmail: string;
  type: TransactionType;
  state: TransactionState;
  channelId?: string;
  channelName?: string;
  subscriptionId?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PendingPlanChange {
  txnRef: string;
  targetHandle: string;
  timing: PlanTiming;
  proratedAmount: number;
}

export interface SessionData {
  sessionId: string;
  lastSubmission?: unknown;
  lastResult?: unknown;
  pendingPlanChange?: PendingPlanChange;
  createdAt: number;
  updatedAt: number;
}

export interface Consultant {
  id: string;
  name: string;
  email: string;
}

export interface ApiResponse<T = unknown> {
  status: 'ok' | 'maxio_failed' | 'invalid' | 'session_expired';
  txnId?: string;
  channelId?: string;
  channelName?: string;
  error?: string;
  data?: T;
}

export interface BlockKitBlock {
  type: string;
  [key: string]: unknown;
}

export interface ProductCacheEntry {
  handle: string;
  name: string;
  priceInCents: number;
  intervalUnit: string;
}
