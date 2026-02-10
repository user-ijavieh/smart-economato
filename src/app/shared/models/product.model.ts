import { Supplier } from './supplier.model';

// Interfaz para mostrar datos (GET)
export interface Product {
  id: number;
  name: string;
  type?: string;
  unit: string;
  unitPrice: number;
  productCode?: string;
  
  // Stock property - favoring currentStock as per recent changes but keeping stock for compatibility if backend sends it
  stock?: number; 
  currentStock: number;
  minStock: number;
  
  supplier?: Supplier;
  barcode?: string;
  price?: number;
  brand?: string;
  expirationDate?: string;
  description?: string;
  image?: string;
  active?: boolean;
}

// Interfaz para enviar datos (POST/PUT)
export interface ProductRequest {
  name: string;
  productCode?: string;
  type?: string;
  barcode?: string;
  
  // Price
  price?: number; 
  unitPrice: number;

  // Stock
  stock?: number;
  currentStock: number;
  minStock: number;

  unit: string;
  supplierId?: number;
  active?: boolean;
  description?: string;
  image?: string;
  brand?: string;
  expirationDate?: string;
}