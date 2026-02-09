import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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
    return this.http.get<Page<Supplier>>(this.url, { params });
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
