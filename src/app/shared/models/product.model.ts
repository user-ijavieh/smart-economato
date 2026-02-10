export interface Product {
  id: number;
  name: string;
  type?: string;
  unit: string;
  unitPrice: number;
  productCode?: string;
  currentStock: number;
  minStock?: number;
  supplier?: Supplier;
}

export interface ProductRequest {
  name: string;
  type?: string;
  unit: string;
  unitPrice: number;
  productCode?: string;
  currentStock?: number;
  supplierId?: number;
  // Legacy fields for backward compatibility
  stock?: number;
  minStock?: number;
  price?: number;
  barcode?: string;
  brand?: string;
  expirationDate?: string;
  description?: string;
  image?: string;
  active?: boolean;
}

export interface Supplier {
  id: number;
  name: string;
  contact: string;
}
