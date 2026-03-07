import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  StockLedgerResponseDTO,
  IntegrityCheckResponseDTO,
  StockSnapshotResponseDTO,
  BatchStockMovementRequestDTO,
  BatchStockMovementResponseDTO
} from '../../shared/models/stock-ledger.model';

@Injectable({ providedIn: 'root' })
export class StockLedgerService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/stock-ledger`;

  getHistory(productId: number, page = 0, size = 15, sort = 'transactionTimestamp,desc'): Observable<any> {
    return this.http.get<any>(`${this.url}/history/${productId}`, {
      params: { page: page.toString(), size: size.toString(), sort }
    });
  }

  verifyIntegrity(productId: number): Observable<IntegrityCheckResponseDTO> {
    return this.http.get<IntegrityCheckResponseDTO>(`${this.url}/verify/${productId}`);
  }

  verifyAll(): Observable<IntegrityCheckResponseDTO[]> {
    return this.http.get<IntegrityCheckResponseDTO[]>(`${this.url}/verify-all`);
  }

  getSnapshot(productId: number): Observable<StockSnapshotResponseDTO> {
    return this.http.get<StockSnapshotResponseDTO>(`${this.url}/snapshot/${productId}`);
  }

  resetHistory(productId: number): Observable<string> {
    return this.http.delete<string>(`${this.url}/reset/${productId}`, { responseType: 'text' as 'json' });
  }

  getProductsWithLedger(name = '', page = 0, size = 15, sort = 'name,asc'): Observable<any> {
    const params: any = { page: page.toString(), size: size.toString(), sort };
    if (name) params.name = name;
    return this.http.get<any>(`${environment.apiUrl}/api/products/with-ledger`, { params });
  }

  getGlobalLedgerIntegrity(): Observable<IntegrityCheckResponseDTO[]> {
    return this.http.get<IntegrityCheckResponseDTO[]>(`${environment.apiUrl}/api/products/ledger-integrity`);
  }

  downloadLedgerPdf(productId: number): Observable<any> {
    return this.http.get(`${environment.apiUrl}/api/products/${productId}/ledger/pdf`, {
      responseType: 'blob',
      observe: 'response'
    });
  }

  processBatch(request: BatchStockMovementRequestDTO): Observable<BatchStockMovementResponseDTO> {
    return this.http.post<BatchStockMovementResponseDTO>(this.url, request);
  }
}
