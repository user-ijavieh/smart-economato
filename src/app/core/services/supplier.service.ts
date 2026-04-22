import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, tap, of, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../../shared/models/page.model';
import { Supplier, SupplierRequest } from '../../shared/models/supplier.model';
import { HttpQueryCacheService } from './http-query-cache.service';

const SUPPLIERS_LOCAL_KEY = 'se-suppliers-data';
const SUPPLIERS_TIMESTAMP_KEY = 'se-suppliers-updated';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private http = inject(HttpClient);
  private cache = inject(HttpQueryCacheService);
  private url = `${environment.apiUrl}/api/suppliers`;

  /**
   * Obtiene todos los proveedores. 
   * Intenta cargar desde localStorage primero si no hay una búsqueda activa.
   */
  getAll(page = 0, size = 50, sort?: string): Observable<Page<Supplier>> {
    // Si es la primera página y no hay parámetros raros, intentamos caché local persistente
    if (page === 0 && !sort) {
      const cached = this.getLocalCache();
      if (cached) {
        return of(this.wrapInPage(cached, page, size));
      }
    }

    return this.fetchAndStore(page, size, sort);
  }

  /**
   * Fuerza la actualización de la caché local desde el servidor
   */
  refreshCache(): Observable<Page<Supplier>> {
    return this.fetchAndStore(0, 1000); // Traemos una lista grande para la caché
  }

  private fetchAndStore(page: number, size: number, sort?: string): Observable<Page<Supplier>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (sort) {
      params = params.set('sort', sort);
    }

    return this.http.get<any>(this.url, { params }).pipe(
      map(response => {
        const rawContent = response.content || (Array.isArray(response) ? response : []);

        const content: Supplier[] = rawContent.map((item: any) => ({
          id: item.id,
          name: item.name || item.nombre || 'Sin nombre',
          email: item.email,
          phone: item.phone
        }));

        const pageData = {
          content,
          totalElements: response.totalElements ?? content.length,
          totalPages: response.totalPages ?? 1,
          size: response.size ?? size,
          number: response.number ?? page,
          first: response.first ?? true,
          last: response.last ?? true,
          empty: content.length === 0
        };

        // Si es una carga masiva o la primera página, guardamos en local
        if (page === 0 && content.length > 0) {
          this.setLocalCache(content);
        }

        return pageData;
      })
    );
  }

  getById(id: number): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.url}/${id}`);
  }

  create(supplier: SupplierRequest): Observable<Supplier> {
    return this.http.post<Supplier>(this.url, supplier).pipe(
      tap(() => this.clearLocalCache())
    );
  }

  update(id: number, supplier: SupplierRequest): Observable<Supplier> {
    return this.http.put<Supplier>(`${this.url}/${id}`, supplier).pipe(
      tap(() => this.clearLocalCache())
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.clearLocalCache())
    );
  }

  search(term: string, page = 0, size = 20, sort = 'name,asc'): Observable<Page<Supplier>> {
    const params = new HttpParams()
      .set('term', term)
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    return this.http.get<Page<Supplier>>(`${this.url}/search`, { params });
  }

  getLastUpdated(): string | null {
    return localStorage.getItem(SUPPLIERS_TIMESTAMP_KEY);
  }

  private getLocalCache(): Supplier[] | null {
    const data = localStorage.getItem(SUPPLIERS_LOCAL_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private setLocalCache(data: Supplier[]): void {
    localStorage.setItem(SUPPLIERS_LOCAL_KEY, JSON.stringify(data));
    localStorage.setItem(SUPPLIERS_TIMESTAMP_KEY, new Date().toISOString());
  }

  private clearLocalCache(): void {
    localStorage.removeItem(SUPPLIERS_LOCAL_KEY);
    localStorage.removeItem(SUPPLIERS_TIMESTAMP_KEY);
    this.cache.invalidateDomains(['supplier']);
  }

  private wrapInPage(content: Supplier[], page: number, size: number): Page<Supplier> {
    return {
      content,
      totalElements: content.length,
      totalPages: 1,
      size: size,
      number: page,
      first: true,
      last: true,
      empty: content.length === 0
    };
  }
}
