export type SyncAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'STATUS_CHANGE'
  | 'CONFIRM'
  | 'REVERT'
  | 'RECEIVE'
  | 'RECEIVE';

export type SyncAffectedDomain =
  | 'product'
  | 'supplier'
  | 'recipe'
  | 'order'
  | 'weekly_plan'
  | 'ledger'
  | 'batch'
  | 'stock_alerts'
  | 'user'
  | 'config'
  | 'allergen'
  | 'incident';

export interface SyncEvent {
  entityType: string;
  entityId: number | null;
  entityIds: number[];
  action: SyncAction;
  affectedDomains: SyncAffectedDomain[];
  changedBy: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
