export interface OrderAudit {
  id: number;
  orderId: number;
  userId: number;
  userName: string;
  action: string;
  details: string;
  previousState: string | null;
  newState: string | null;
  auditDate: string;
}
