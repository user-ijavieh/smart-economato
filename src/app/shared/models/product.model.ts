// src/app/shared/models/product.model.ts
import { Supplier } from './supplier.model';

// Interfaz para mostrar datos (GET)
export interface Product {
  id: number;
  name: string;
  type?: string;
  unit: string;
  price: number;
  productCode?: string;
  stock: number;
  minStock: number;
  active?: boolean;
  supplier?: Supplier;
}

// Interfaz para enviar datos (POST/PUT)
export interface ProductRequest {
  name: string;
  productCode?: string; // New field
  type?: string;        // New field
  barcode?: string;
  price: number;
  unitPrice?: number;   // New field (preferred over price)
  stock: number;
  currentStock?: number; // New field (preferred over stock)
  minStock: number;
  unit: string;
  brand?: string;
  expirationDate?: string;
  description?: string;
  image?: string;
  active?: boolean;
  supplierId?: number;
}