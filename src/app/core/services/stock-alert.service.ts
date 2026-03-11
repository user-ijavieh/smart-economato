import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Page } from '../../shared/models/page.model';
import {
    AlertSeverity,
    DailyForecastResponse,
    PageResponse,
    StockAlertDTO,
    StockPredictionResponseDTO,
    WeeklyConsumptionResponse
} from '../../shared/models/stock-alert.model';

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

    getPredictions(page: number, size: number, sort?: string): Observable<Page<StockPredictionResponseDTO>> {
        let params = new HttpParams()
            .set('page', page.toString())
            .set('size', size.toString());
        
        if (sort) {
            params = params.set('sort', sort);
        }
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

    getWeeklyHistory(page = 0, size = 50, sort = 'productId,asc'): Observable<PageResponse<WeeklyConsumptionResponse>> {
        const params = new HttpParams()
            .set('page', page.toString())
            .set('size', size.toString())
            .set('sort', sort);

        return this.http.get<PageResponse<WeeklyConsumptionResponse>>(`${this.url}/history`, { params });
    }

    getWeeklyHistoryByProduct(productId: number): Observable<WeeklyConsumptionResponse> {
        return this.http.get<WeeklyConsumptionResponse>(`${this.url}/history/${productId}`);
    }

    getDailyForecast(page = 0, size = 50, sort = 'productId,asc'): Observable<PageResponse<DailyForecastResponse>> {
        const params = new HttpParams()
            .set('page', page.toString())
            .set('size', size.toString())
            .set('sort', sort);

        return this.http.get<PageResponse<DailyForecastResponse>>(`${this.url}/forecast`, { params });
    }

    getDailyForecastByProduct(productId: number): Observable<DailyForecastResponse> {
        return this.http.get<DailyForecastResponse>(`${this.url}/forecast/${productId}`);
    }
}
