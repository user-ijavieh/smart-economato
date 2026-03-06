import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Page } from '../../shared/models/page.model';
import { AlertSeverity, StockAlertDTO, StockPredictionResponseDTO } from '../../shared/models/stock-alert.model';

@Injectable({ providedIn: 'root' })
export class StockAlertService {
    private http = inject(HttpClient);
    private url = `${environment.apiUrl}/api/stock-alerts`;

    getActiveAlerts(severity?: AlertSeverity): Observable<StockAlertDTO[]> {
        let params = new HttpParams();
        if (severity) {
            params = params.set('severity', severity);
        }
        return this.http.get<StockAlertDTO[]>(this.url, { params });
    }

    getProductAlert(productId: number): Observable<StockAlertDTO | null> {
        return this.http.get<StockAlertDTO>(`${this.url}/${productId}`, { observe: 'response' }).pipe(
            map(response => response.status === 204 ? null : response.body),
            catchError(() => of(null))
        );
    }

    getBatchAlerts(productIds: number[]): Observable<StockAlertDTO[]> {
        return this.http.post<StockAlertDTO[]>(`${this.url}/batch`, productIds);
    }

    getPredictions(page: number, size: number): Observable<Page<StockPredictionResponseDTO>> {
        const params = new HttpParams()
            .set('page', page.toString())
            .set('size', size.toString());
        return this.http.get<any>(`${this.url}/predictions`, { params }).pipe(
            map(response => ({
                content: response.content ?? [],
                totalElements: response.totalElements ?? 0,
                totalPages: response.totalPages ?? 1,
                size: response.size ?? size,
                number: response.number ?? page,
                first: response.first ?? true,
                last: response.last ?? true,
                empty: (response.content ?? []).length === 0
            }))
        );
    }
}
