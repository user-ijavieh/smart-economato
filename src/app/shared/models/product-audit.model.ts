export interface ProductAudit {
  id: number;
  productId: number;
  productName: string;
  userId: number;
  userName: string;
  quantity: number;
  movementType: 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'RECEPCION' | 'PRODUCCION';
  movementDate: string;
  previousStock: number;
  currentStock: number;
  actionDescription: string;
  previousState?: string;
  newState?: string;
}
