import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../../shared/models/page.model';
import { Supplier, SupplierRequest } from '../../shared/models/supplier.model';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/suppliers`;

  getAll(page = 0, size = 50): Observable<Page<Supplier>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<any>(this.url, { params }).pipe(
      tap(response => console.log('📦 Raw API Response (Suppliers):', response)),
      map(response => {
        const rawContent = response.content || (Array.isArray(response) ? response : []);
        
        const mappedContent: Supplier[] = rawContent.map((item: any) => ({
          ...item,
          id: item.id,
          name: item.name || item.nombre || 'Sin nombre',
          contactPerson: item.contactPerson || item.contacto || item.contact || '',
          phone: item.phone || item.telefono || '',
          email: item.email || item.correo || '',
          address: item.address || item.direccion || ''
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

  getById(id: number): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.url}/${id}`);
  }

  create(supplier: SupplierRequest): Observable<Supplier> {
    return this.http.post<Supplier>(this.url, supplier);
  }

  update(id: number, supplier: SupplierRequest): Observable<Supplier> {
    return this.http.put<Supplier>(`${this.url}/${id}`, supplier);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  searchByName(name: string): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.url}/search`, {
      params: new HttpParams().set('name', name)
    });
  }
}
