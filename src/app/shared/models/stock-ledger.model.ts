export interface StockLedgerResponseDTO {
  id: number;
  productId: number;
  productName: string;
  expirationDate?: string | null;
  quantityDelta: number;
  resultingStock: number;
  movementType: 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'RECEPCION' | 'PRODUCCION';
  description: string;
  previousHash: string;
  currentHash: string;
  transactionTimestamp: string;
  sequenceNumber: number;
  userName: string;
  orderId: number | null;
  verified: boolean;
}

export interface IntegrityCheckResponseDTO {
  productId: number;
  productName: string;
  valid: boolean;
  message: string;
  errors: string[] | null;
  totalTransactions: number;
}

export interface StockSnapshotResponseDTO {
  productId: number;
  productName: string;
  currentStock: number;
  lastTransactionHash: string;
  lastSequenceNumber: number;
  lastUpdated: string;
  lastVerified: string;
  integrityStatus: 'VALID' | 'CORRUPTED' | 'UNVERIFIED';
}

export interface StockMovementItemDTO {
  productId: number;
  quantityDelta: number;
  expirationDate?: string | null;
  movementType: 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'RECEPCION' | 'PRODUCCION';
  description: string;
}

export interface BatchStockMovementRequestDTO {
  movements: StockMovementItemDTO[];
  reason: string;
  orderId: number | null;
  recipeCookingAuditId: number | null;
}

export interface BatchStockMovementResponseDTO {
  success: boolean;
  processedCount: number;
  totalCount: number;
  message: string;
  transactions: StockLedgerResponseDTO[];
  errorDetail: string | null;
}

export interface DailyConsumptionDTO {
  date: string;
  consumed: number;
}

export interface ConsumptionBreakdownDTO {
  productId: number;
  productName: string;
  unit: string;
  startDate: string;
  endDate: string;
  breakdown: DailyConsumptionDTO[];
}
