export type OrderStatus = 'CREATED' | 'PENDING' | 'REVIEW' | 'COMPLETED' | 'INCOMPLETE';

export interface Order {
  id: number;
  user: { id: number; name: string };
  status: OrderStatus;
  orderDate: string;
  details: OrderDetail[];
}

export interface OrderDetail {
  id: number;
  product: { id: number; name: string };
  quantity: number;
  unitPrice: number;
}

export interface OrderRequest {
  userId: number;
  details: { productId: number; quantity: number; unitPrice: number }[];
}

export interface OrderReceptionRequest {
  orderId: number;
  items: { productId: number; receivedQuantity: number }[];
}
