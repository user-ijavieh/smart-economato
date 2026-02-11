import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../../shared/models/page.model';
import { Product, ProductRequest } from '../../shared/models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/products`;

  getAll(page = 0, size = 10, sort = 'name,asc'): Observable<Page<Product>> {
    // Manually construct query string to ensure exact format and avoid encoding issues
    const queryString = `page=${page}&size=${size}&sort=${sort}`;
    const fullUrl = `${this.url}?${queryString}`;

    return this.http.get<any>(fullUrl).pipe(
      // tap(response => console.log('📦 Raw API Response (Inventory):', response)),
      map(response => {
        // 1. Extract content array reliably
        const rawContent = response.content || (Array.isArray(response) ? response : []);
        
          // 2. Map items to ensure valid Product models
        const mappedContent: Product[] = rawContent.map((item: any) => ({
          ...item,
          id: item.id,
          // Fallback strategies for English/Spanish properties
          name: item.name || item.nombre || 'Sin nombre',
          productCode: item.productCode || item.codigo || '',
          type: item.type || item.tipo || '',
          unitPrice: Number(item.unitPrice ?? item.price ?? item.precio ?? 0),
          currentStock: Number(item.currentStock ?? item.stock ?? 0),
          minStock: item.minStock !== undefined ? Number(item.minStock) : undefined,
          unit: item.unit || item.unidad || 'Ud',
          supplier: item.supplier ? {
            id: item.supplier.id,
            name: item.supplier.name || item.supplier.nombre,
            contactPerson: item.supplier.contact || item.supplier.contacto,
            phone: item.supplier.phone || item.supplier.telefono
          } : undefined
        }));

        // 3. Return valid Page object
        return {
          content: mappedContent,
          totalElements: response.totalElements ?? mappedContent.length,
          totalPages: response.totalPages ?? 1,
          size: response.size ?? size,
          number: response.number ?? page,
          first: response.first ?? true,
          last: response.last ?? true,
          empty: mappedContent.length === 0
        };
      })
    );
  }

  getById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.url}/${id}`);
  }

  getByBarcode(barcode: string): Observable<Product> {
    return this.http.get<Product>(`${this.url}/barcode/${barcode}`);
  }

  searchByName(name: string, page = 0, size = 10, sort = 'name,asc'): Observable<Page<Product>> {
    const queryString = `name=${encodeURIComponent(name)}&page=${page}&size=${size}&sort=${sort}`;
    const fullUrl = `${this.url}/search?${queryString}`;

    return this.http.get<any>(fullUrl).pipe(
      map(response => {
        const rawContent = response.content || (Array.isArray(response) ? response : []);
        
        const mappedContent: Product[] = rawContent.map((item: any) => ({
          ...item,
          id: item.id,
          name: item.name || item.nombre || 'Sin nombre',
          productCode: item.productCode || item.codigo || '',
          type: item.type || item.tipo || '',
          unitPrice: Number(item.unitPrice ?? item.price ?? item.precio ?? 0),
          currentStock: Number(item.currentStock ?? item.stock ?? 0),
          minStock: item.minStock !== undefined ? Number(item.minStock) : undefined,
          unit: item.unit || item.unidad || 'Ud',
          supplier: item.supplier ? {
            id: item.supplier.id,
            name: item.supplier.name || item.supplier.nombre,
            contactPerson: item.supplier.contact || item.supplier.contacto,
            phone: item.supplier.phone || item.supplier.telefono
          } : undefined
        }));

        return {
          content: mappedContent,
          totalElements: response.totalElements ?? mappedContent.length,
          totalPages: response.totalPages ?? 1,
          size: response.size ?? size,
          number: response.number ?? page,
          first: response.first ?? true,
          last: response.last ?? true,
          empty: mappedContent.length === 0
        };
      })
    );
  }

  create(product: ProductRequest): Observable<Product> {
    return this.http.post<Product>(this.url, product);
  }

  update(id: number, product: ProductRequest): Observable<Product> {
    return this.http.put<any>(`${this.url}/${id}`, product).pipe(
      map(response => ({
        ...response,
        id: response.id,
        name: response.name || response.nombre || 'Sin nombre',
        productCode: response.productCode || response.codigo || '',
        type: response.type || response.tipo || '',
        unitPrice: Number(response.unitPrice ?? response.price ?? response.precio ?? 0),
        currentStock: Number(response.currentStock ?? response.stock ?? 0),
        minStock: response.minStock !== undefined ? Number(response.minStock) : undefined,
        unit: response.unit || response.unidad || 'Ud',
        supplier: response.supplier ? {
          id: response.supplier.id,
          name: response.supplier.name || response.supplier.nombre,
          contactPerson: response.supplier.contact || response.supplier.contacto,
          phone: response.supplier.phone || response.supplier.telefono
        } : undefined
      }))
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  updateStockManually(id: number, product: ProductRequest): Observable<Product> {
    return this.http.put<Product>(`${this.url}/${id}/stock-manual`, product);
  }
}
