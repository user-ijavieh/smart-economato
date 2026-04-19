import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProductBatchResponseDTO } from '../../shared/models/product-batch.model';
import { HttpQueryCacheService } from './http-query-cache.service';

export interface BatchTypeaheadDTO {
  id: number;
  batchCode?: string | null;
  productId: number;
  productName: string;
  expirationDate: string | null;
  remainingQuantity: number;
}

@Injectable({ providedIn: 'root' })
export class ProductBatchService {
  private http = inject(HttpClient);
  private cache = inject(HttpQueryCacheService);
  private url = `${environment.apiUrl}/api/products/batches`;

  getActiveBatches(productId: number): Observable<ProductBatchResponseDTO[]> {
    return this.cache.getOrFetch('batch', `batches:active:${productId}`, () =>
      this.http.get<ProductBatchResponseDTO[]>(`${this.url}/product/${productId}`)
    );
  }

  getAllBatches(page: number = 0, size: number = 10, sort: string = 'expirationDate,asc', search?: string, depleted?: boolean): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    if (search) {
      params = params.set('search', search);
    }
    if (depleted !== undefined && depleted !== null) {
      params = params.set('depleted', depleted.toString());
    }

    return this.http.get<any>(this.url, { params });
  }

  getExpiringBatches(days = 7): Observable<ProductBatchResponseDTO[]> {
    const params = new HttpParams().set('days', days.toString());
    return this.cache.getOrFetch('batch', `batches:expiring:${days}`, () =>
      this.http.get<ProductBatchResponseDTO[]>(`${this.url}/expiring`, { params })
    );
  }

  getExpiredBatches(): Observable<ProductBatchResponseDTO[]> {
    return this.cache.getOrFetch('batch', 'batches:expired', () =>
      this.http.get<ProductBatchResponseDTO[]>(`${this.url}/expired`)
    );
  }

  withdrawBatch(batchId: number): Observable<void> {
    return this.http.post<void>(`${this.url}/${batchId}/withdraw`, {}).pipe(
      tap(() => this.cache.invalidateDomains(['batch']))
    );
  }

  getBatchTypeahead(query: string, productId?: number, limit: number = 10): Observable<BatchTypeaheadDTO[]> {
    let params = new HttpParams().set('query', query).set('limit', limit.toString());
    if (productId !== undefined && productId !== null) {
      params = params.set('productId', productId.toString());
    }
    return this.cache.getOrFetch('batch', `batches:typeahead:${query}:${productId ?? ''}:${limit}`, () =>
      this.http.get<BatchTypeaheadDTO[]>(`${this.url}/typeahead`, { params })
    );
  }

  updateBatchExpiration(batchId: number, data: { expirationDate: string; reason?: string; batchCode?: string }): Observable<void> {
    return this.http.patch<void>(`${this.url}/${batchId}/expiration`, data).pipe(
      tap(() => this.cache.invalidateDomains(['batch']))
    );
  }
}
