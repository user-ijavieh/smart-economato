import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrderAudit } from '../../shared/models/order-audit.model';

@Injectable({ providedIn: 'root' })
export class OrderAuditService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/order-audits`;

  getAll(page = 0, size = 20, sort: string[] = ['auditDate,desc']): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    sort.forEach(s => { params = params.append('sort', s); });
    return this.http.get<any>(this.url, { params });
  }

  getByDateRange(start: string, end: string, page = 0, size = 20, sort: string[] = ['auditDate,desc']): Observable<any> {
    let params = new HttpParams()
      .set('start', start)
      .set('end', end)
      .set('page', page.toString())
      .set('size', size.toString());
    sort.forEach(s => { params = params.append('sort', s); });
    return this.http.get<any>(`${this.url}/by-date-range`, { params });
  }

  getByOrderId(orderId: number): Observable<OrderAudit[]> {
    return this.http.get<OrderAudit[]>(`${this.url}/by-order/${orderId}`);
  }
}
