export type CrisisStatus = 'ACTIVE' | 'LIFTED';

export interface CrisisAffectedBatchDTO {
  batchId: number;
  productId: number;
  productName: string;
  expirationDate: string | null;
  remainingQuantity: number;
  expired: boolean;
  depleted: boolean;
}

export interface CrisisAffectedOrderDTO {
  orderId: number;
  supplierName: string;
  status: string;
  createdAt: string;
  totalItems: number;
}

export interface CrisisAffectedCookingDTO {
  cookingAuditId: number;
  recipeName: string;
  userName: string;
  cookingDate: string;
  quantityCooked: number;
}

export interface CrisisResponseDTO {
  crisisId: number;
  crisisCode: string;
  status: CrisisStatus;
  reason: string;
  supplierName: string;
  quarantinedProducts: Record<string, string>;
  affectedBatches?: CrisisAffectedBatchDTO[];
  affectedOrderIds?: number[];
  affectedOrders?: CrisisAffectedOrderDTO[];
  affectedCookingAuditIds?: number[];
  affectedCookings?: CrisisAffectedCookingDTO[];
  integrityVerified: boolean;
  summary: string;
  timestamp: string;
}

export interface CrisisActivationRequest {
  supplierId: number;
  productIds: number[];
  dateFrom: string;
  dateTo: string;
  reason: string;
}

export interface CrisisLiftRequest {
  crisisId: number;
  availabilityPercentage?: number;
}
