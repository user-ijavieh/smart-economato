export type SyncAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'STATUS_CHANGE'
  | 'CONFIRM'
  | 'REVERT'
  | 'RECEIVE'
  | 'LOCK_ACQUIRED'
  | 'LOCK_RELEASED'
  | 'LOCK_EXPIRED'
  | 'COLLAB_REQUESTED'
  | 'COLLAB_ADMITTED'
  | 'COLLAB_PARTICIPANT_LEFT'
  | 'COLLAB_FIELD_LOCKED'
  | 'COLLAB_FIELD_UNLOCKED'
  | 'COLLAB_FIELD_PATCHED'
  | 'COLLAB_STATE_CLEARED';

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
