import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CrisisActivationRequest,
  CrisisLiftRequest,
  CrisisResponseDTO
} from '../../shared/models/crisis.model';
import { RecipeCookingAudit } from '../../shared/models/kitchen.model';

@Injectable({ providedIn: 'root' })
export class TraceabilityService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/traceability`;

  activateCrisis(request: CrisisActivationRequest): Observable<CrisisResponseDTO> {
    return this.http.post<CrisisResponseDTO>(`${this.url}/crisis/activate`, request);
  }

  getCrises(): Observable<CrisisResponseDTO[]> {
    return this.http.get<CrisisResponseDTO[]>(`${this.url}/crisis`);
  }

  getCrisisById(crisisId: number): Observable<CrisisResponseDTO> {
    return this.http.get<CrisisResponseDTO>(`${this.url}/crisis/${crisisId}`);
  }

  getCrisisHistory(page: number, size: number, search?: string): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<any>(`${this.url}/crisis/history`, { params });
  }

  liftCrisis(request: CrisisLiftRequest): Observable<void> {
    return this.http.post<void>(`${this.url}/crisis/lift`, request);
  }

  downloadCrisisReport(crisisId: number): Observable<Blob> {
    return this.http.get(`${this.url}/crisis/${crisisId}/report/download`, {
      responseType: 'blob'
    });
  }

  getForwardTraceability(
    supplierId: number,
    productIds: number[],
    from: string,
    to: string
  ): Observable<unknown> {
    const params = new HttpParams()
      .set('supplierId', supplierId.toString())
      .set('productIds', productIds.join(','))
      .set('from', from)
      .set('to', to);

    return this.http.get<unknown>(`${this.url}/forward`, { params });
  }

  getReverseTraceability(cookingAuditId: number): Observable<unknown> {
    return this.http.get<unknown>(`${this.url}/reverse/${cookingAuditId}`);
  }

  getBatchCookings(batchId: number): Observable<RecipeCookingAudit[]> {
    return this.http.get<RecipeCookingAudit[]>(`${this.url}/batch/${batchId}/cookings`);
  }
}
