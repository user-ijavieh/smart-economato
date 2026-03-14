export interface ProductBatchResponseDTO {
  id: number;
  productId: number;
  productName: string;
  expirationDate: string | null;
  initialQuantity: number;
  remainingQuantity: number;
  receivedAt: string;
  depleted: boolean;
  expired: boolean;
  daysUntilExpiration: number;
}
