export type OrderStatus = 'CREATED' | 'PENDING' | 'REVIEW' | 'CONFIRMED' | 'CANCELLED' | 'INCOMPLETE';

export interface Order {
  id: number;
  userId: number;
  userName: string;
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
  quantityReceived?: number;
  unitPrice: number;
  subtotal?: number;
}

export interface OrderRequest {
  userId: number;
  details: { productId: number; quantity: number; unitPrice: number }[];
}

export interface OrderReceptionRequest {
  orderId: number;
  status: OrderStatus;
  items: { productId: number; quantityReceived: number }[];
}
