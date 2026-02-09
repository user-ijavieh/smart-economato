export interface Product {
  id: number;
  name: string;
  type?: string;
  unit: string;
  price: number;
  productCode?: string;
  stock: number;
  minStock: number;
  supplier?: Supplier;
}

export interface ProductRequest {
  name: string;
  barcode?: string;
  price: number;
  unitPrice?: number;
  stock: number;
  minStock: number;
  unit: string;
  brand?: string;
  expirationDate?: string;
  description?: string;
  image?: string;
  active?: boolean;
  supplierId?: number;
}

export interface Supplier {
  id: number;
  name: string;
  contact: string;
}
