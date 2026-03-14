import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProductBatchResponseDTO } from '../../shared/models/product-batch.model';

@Injectable({ providedIn: 'root' })
export class ProductBatchService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/products/batches`;

  getActiveBatches(productId: number): Observable<ProductBatchResponseDTO[]> {
    return this.http.get<ProductBatchResponseDTO[]>(`${this.url}/product/${productId}`);
  }

  getExpiringBatches(days = 7): Observable<ProductBatchResponseDTO[]> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<ProductBatchResponseDTO[]>(`${this.url}/expiring`, { params });
  }

  getExpiredBatches(): Observable<ProductBatchResponseDTO[]> {
    return this.http.get<ProductBatchResponseDTO[]>(`${this.url}/expired`);
  }

  withdrawBatch(batchId: number): Observable<void> {
    return this.http.post<void>(`${this.url}/${batchId}/withdraw`, {});
  }
}
