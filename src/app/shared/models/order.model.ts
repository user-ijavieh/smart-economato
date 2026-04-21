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

export interface OrderReviewLockStatus {
  orderId: number;
  locked: boolean;
  lockedByUserId?: number;
  lockedByUsername?: string;
  lockedByDisplayName?: string;
  acquiredAt?: string;
  lastSeenAt?: string;
  expiresAt?: string;
  currentUserOwner?: boolean;
  currentUserAdmin?: boolean;
}

export interface OrderCollaborationUser {
  userId: number;
  username: string;
  displayName: string;
  joinedAt?: string;
}

export interface OrderCollaborationFieldLock {
  fieldPath: string;
  lockedByUserId: number;
  lockedByUsername: string;
  lockedByDisplayName: string;
  lockedAt?: string;
  expiresAt?: string;
}

export interface OrderReviewCollaborationState {
  orderId: number;
  locked: boolean;
  lockedByUserId?: number;
  lockedByUsername?: string;
  lockedByDisplayName?: string;
  currentUserOwner?: boolean;
  currentUserAdmin?: boolean;
  currentUserCollaborator?: boolean;
  currentUserCanAdmit?: boolean;
  collaborators: OrderCollaborationUser[];
  pendingRequests: OrderCollaborationUser[];
  fieldLocks: OrderCollaborationFieldLock[];
  fieldValues: Record<string, unknown>;
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
  lotQuantity?: number;
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

export interface ProductOrderQuantity {
  orderId: number;
  status: OrderStatus;
  quantity: number;
  supplierName?: string | null;
  orderDate?: string;
}

export interface OrdersByProductsRequest {
  productIds: number[];
  statuses?: OrderStatus[];
}

export interface OrdersByProductsResponse {
  orders: Order[];
  totalQuantityPerProduct: Record<string, number>;
  orderCountPerProduct: Record<string, number>;
  ordersByProduct: Record<string, ProductOrderQuantity[]>;
}
