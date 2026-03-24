import { Supplier } from './supplier.model';

// Interfaz para mostrar datos (GET)
export interface Product {
  id: number;
  name: string;
  unit: string;
  unitPrice: number;
  productCode?: string;
  
  // Stock property - favoring currentStock as per recent changes but keeping stock for compatibility if backend sends it
  stock?: number; 
  currentStock: number;
  availabilityPercentage?: number;
  hidden?: boolean;
  
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
  barcode?: string;
  
  // Price
  price?: number; 
  unitPrice: number;

  // Stock
  stock?: number;
  currentStock: number;
  availabilityPercentage?: number;
  hidden?: boolean;

  unit: string;
  supplierId?: number;
  active?: boolean;
  description?: string;
  image?: string;
  brand?: string;
  expirationDate?: string; // Format: YYYY-MM-DD
}