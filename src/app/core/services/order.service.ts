import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Order,
  OrderRequest,
  OrderReceptionRequest,
  OrderDetail,
  OrdersByProductsRequest,
  OrdersByProductsResponse,
} from '../../shared/models/order.model';
import { HttpQueryCacheService } from './http-query-cache.service';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);
  private cache = inject(HttpQueryCacheService);
  private url = `${environment.apiUrl}/api/orders`;

  getAll(page = 0, size = 20, sort: string[] = ['orderDate,desc']): Observable<any> {
    return this.cache.getOrFetch('order', `all:${page}:${size}:${sort.join('|')}`, () => {
      let params = new HttpParams()
        .set('page', page.toString())
        .set('size', size.toString());
      sort.forEach(s => { params = params.append('sort', s); });
      return this.http.get<any>(this.url, { params });
    });
  }

  getById(id: number): Observable<Order> {
    return this.cache.getOrFetch('order', `byId:${id}`, () => this.http.get<Order>(`${this.url}/${id}`));
  }

  create(order: OrderRequest): Observable<Order> {
    return this.http.post<Order>(this.url, order).pipe(
      tap(() => this.cache.invalidateDomains(['order']))
    );
  }

  update(id: number, order: OrderRequest): Observable<Order> {
    return this.http.put<Order>(`${this.url}/${id}`, order).pipe(
      tap(() => this.cache.invalidateDomains(['order']))
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.cache.invalidateDomains(['order']))
    );
  }

  getByUser(userId: number): Observable<Order[]> {
    return this.cache.getOrFetch('order', `byUser:${userId}`, () => this.http.get<Order[]>(`${this.url}/user/${userId}`));
  }

  getByStatus(status: string, page: number = 0, size: number = 20): Observable<any> {
    const params = { page: page.toString(), size: size.toString(), sort: 'orderDate,desc' };
    return this.cache.getOrFetch('order', `byStatus:${status}:${page}:${size}`, () => 
      this.http.get<any>(`${this.url}/status/${status}`, { params }));
  }

  getPendingReception(): Observable<Order[]> {
    return this.cache.getOrFetch('order', 'pendingReception', () => this.http.get<Order[]>(`${this.url}/reception/pending`));
  }

  processReception(receptionData: OrderReceptionRequest): Observable<Order> {
    return this.http.post<Order>(`${this.url}/reception`, receptionData).pipe(
      tap(() => this.cache.invalidateDomains(['order', 'ledger', 'product', 'weekly_plan', 'stock_alerts']))
    );
  }

  updateStatus(id: number, status: string): Observable<Order> {
    return this.http.patch<Order>(
      `${this.url}/${id}/status`,
      { status: status }
    ).pipe(
      tap(() => this.cache.invalidateDomains(['order']))
    );
  }

  getByDateRange(start: string, end: string): Observable<Order[]> {
    return this.cache.getOrFetch('order', `dateRange:${start}:${end}`, () => {
      const params = new HttpParams().set('start', start).set('end', end);
      return this.http.get<Order[]>(`${this.url}/daterange`, { params });
    });
  }

  search(filters: {
    startDate?: string;
    endDate?: string;
    userId?: number;
    supplierId?: number;
    orderId?: number;
    page?: number;
    size?: number;
  }): Observable<any> {
    return this.cache.getOrFetch(
      'order',
      `search:${filters.startDate ?? ''}:${filters.endDate ?? ''}:${filters.userId ?? ''}:${filters.supplierId ?? ''}:${filters.orderId ?? ''}:${filters.page ?? ''}:${filters.size ?? ''}`,
      () => {
        let params = new HttpParams();
        if (filters.startDate)  params = params.set('startDate',  filters.startDate);
        if (filters.endDate)    params = params.set('endDate',    filters.endDate);
        if (filters.userId)     params = params.set('userId',     filters.userId.toString());
        if (filters.supplierId) params = params.set('supplierId', filters.supplierId.toString());
        if (filters.orderId)    params = params.set('orderId',    filters.orderId.toString());
        if (filters.page !== undefined) params = params.set('page', filters.page.toString());
        if (filters.size !== undefined) params = params.set('size', filters.size.toString());
        return this.http.get<any>(`${this.url}/search`, { params });
      }
    );
  }

  getMissingItems(orderId: number): Observable<OrderDetail[]> {
    return this.cache.getOrFetch('order', `missing:${orderId}`, () => this.http.get<OrderDetail[]>(`${this.url}/${orderId}/missing-items`));
  }

  downloadPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/pdf`, {
      responseType: 'blob'
    });
  }

  searchByProducts(request: OrdersByProductsRequest): Observable<OrdersByProductsResponse> {
    return this.http.post<OrdersByProductsResponse>(`${this.url}/search-by-products`, request).pipe(
      tap(() => this.cache.invalidateDomains(['order']))
    );
  }


}
