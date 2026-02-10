import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Order, OrderRequest, OrderReceptionRequest } from '../../shared/models/order.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/orders`;

  getAll(page = 0, size = 20): Observable<Order[]> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<Order[]>(this.url, { params });
  }

  getById(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.url}/${id}`);
  }

  create(order: OrderRequest): Observable<Order> {
    return this.http.post<Order>(this.url, order);
  }

  update(id: number, order: OrderRequest): Observable<Order> {
    return this.http.put<Order>(`${this.url}/${id}`, order);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  getByUser(userId: number): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.url}/user/${userId}`);
  }

  getByStatus(status: string): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.url}/status/${status}`);
  }

  getPendingReception(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.url}/reception/pending`);
  }

  processReception(receptionData: OrderReceptionRequest): Observable<Order> {
    return this.http.post<Order>(`${this.url}/reception`, receptionData);
  }

  updateStatus(id: number, status: string): Observable<Order> {
    return this.http.patch<Order>(
      `${this.url}/${id}/status`,
      { status: status }
    );
  }

  getByDateRange(start: string, end: string): Observable<Order[]> {
    const params = new HttpParams().set('start', start).set('end', end);
    return this.http.get<Order[]>(`${this.url}/by-date-range`, { params });
  }

  downloadPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/pdf`, {
      responseType: 'blob'
    });
  }
}
