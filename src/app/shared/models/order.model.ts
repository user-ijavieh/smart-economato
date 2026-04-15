export type OrderStatus = 'CREATED' | 'PENDING' | 'REVIEW' | 'CONFIRMED' | 'CANCELLED' | 'INCOMPLETE';

export interface Order {
  id: number;
  userId: number;
  userName: string;
  supplierId?: number;
  supplierName?: string;
  status: OrderStatus;
  orderDate: string;
  receptionDate?: string;
  totalPrice?: number;
  details?: OrderDetail[];
}

export interface OrderDetail {
  id?: number;
  orderId?: number;
  productId: number;
  productName: string;
  quantity: number;
  unit?: string;
  quantityReceived?: number;
  expirationDate?: string | null;
  unitPrice: number;
  subtotal?: number;
  lots?: LotReceptionRequest[];
}

export interface OrderRequest {
  userId: number;
  supplierId?: number;
  details: { productId: number; quantity: number; unitPrice: number }[];
}

export interface LotReceptionRequest {
  quantity: number;
  expirationDate: string | null;
  batchCode?: string | null;
}

export interface OrderReceptionRequest {
  orderId: number;
  items: { productId: number; quantityReceived: number; lots: LotReceptionRequest[] }[];
}
