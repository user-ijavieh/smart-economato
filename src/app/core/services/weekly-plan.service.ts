import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ConfirmDayResponse,
  StudentMetricsPage,
  WeeklyPlanPage,
  WeeklyPlanRequest,
  WeeklyPlanResponse,
  WeeklyPlanSlotResponse,
  WeeklyPlanSlotStudentResponse,
  WeeklyPlanStockRequirement
} from '../../shared/models/weekly-plan.model';
import { HttpQueryCacheService } from './http-query-cache.service';

@Injectable({ providedIn: 'root' })
export class WeeklyPlanService {
  private http = inject(HttpClient);
  private cache = inject(HttpQueryCacheService);
  private url = `${environment.apiUrl}/api/weekly-plans`;

  createPlan(request: WeeklyPlanRequest): Observable<WeeklyPlanResponse> {
    return this.http.post<WeeklyPlanResponse>(this.url, request).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan']))
    );
  }

  updatePlan(planId: number, request: WeeklyPlanRequest): Observable<WeeklyPlanResponse> {
    return this.http.put<WeeklyPlanResponse>(`${this.url}/${planId}`, request).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan']))
    );
  }

  activatePlan(planId: number): Observable<WeeklyPlanResponse> {
    return this.http.patch<WeeklyPlanResponse>(`${this.url}/${planId}/activate`, {}).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan']))
    );
  }

  deactivatePlan(planId: number): Observable<WeeklyPlanResponse> {
    return this.http.patch<WeeklyPlanResponse>(`${this.url}/${planId}/deactivate`, {}).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan']))
    );
  }

  confirmSlot(planId: number, slotId: number): Observable<WeeklyPlanSlotResponse> {
    return this.http.patch<WeeklyPlanSlotResponse>(`${this.url}/${planId}/slots/${slotId}/confirm`, {}).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan', 'ledger', 'product', 'stock_alerts']))
    );
  }

  unconfirmSlot(planId: number, slotId: number): Observable<WeeklyPlanSlotResponse> {
    return this.http.patch<WeeklyPlanSlotResponse>(`${this.url}/${planId}/slots/${slotId}/unconfirm`, {}).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan', 'ledger', 'product', 'stock_alerts']))
    );
  }

  confirmDay(planId: number, dayOfWeek: number): Observable<ConfirmDayResponse> {
    return this.http.patch<ConfirmDayResponse>(`${this.url}/${planId}/days/${dayOfWeek}/confirm`, {}).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan', 'ledger', 'product', 'stock_alerts']))
    );
  }

  unconfirmDay(planId: number, dayOfWeek: number): Observable<ConfirmDayResponse> {
    return this.http.patch<ConfirmDayResponse>(`${this.url}/${planId}/days/${dayOfWeek}/unconfirm`, {}).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan', 'ledger', 'product', 'stock_alerts']))
    );
  }

  getPlanById(planId: number): Observable<WeeklyPlanResponse> {
    return this.cache.getOrFetch('weekly_plan', `byId:${planId}`, () => this.http.get<WeeklyPlanResponse>(`${this.url}/${planId}`));
  }

  downloadPlanPdf(planId: number, orientation: 'horizontal' | 'vertical' = 'horizontal'): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.url}/${planId}/pdf`, {
      params: new HttpParams().set('orientation', orientation),
      responseType: 'blob',
      observe: 'response'
    });
  }

  getAllPlans(page = 0, size = 10, sort = 'weekStartDate,desc'): Observable<WeeklyPlanPage> {
    return this.cache.getOrFetch('weekly_plan', `all:${page}:${size}:${sort}`, () => {
      const params = new HttpParams()
        .set('page', page.toString())
        .set('size', size.toString())
        .set('sort', sort);

      return this.http.get<WeeklyPlanPage>(this.url, { params });
    });
  }

  getCurrentWeekPlan(): Observable<WeeklyPlanResponse> {
    return this.cache.getOrFetch('weekly_plan', 'current', () => this.http.get<WeeklyPlanResponse>(`${this.url}/current`));
  }

  getStockRequirements(planId: number): Observable<WeeklyPlanStockRequirement[]> {
    // Date-sensitive endpoint: avoid client cache so expiration-aware values stay fresh.
    return this.http.get<WeeklyPlanStockRequirement[]>(`${this.url}/${planId}/stock-requirements`);
  }

  cancelSlot(planId: number, slotId: number): Observable<WeeklyPlanSlotResponse> {
    return this.http.patch<WeeklyPlanSlotResponse>(`${this.url}/${planId}/slots/${slotId}/cancel`, {}).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan']))
    );
  }

  restoreSlot(planId: number, slotId: number): Observable<WeeklyPlanSlotResponse> {
    return this.http.patch<WeeklyPlanSlotResponse>(`${this.url}/${planId}/slots/${slotId}/restore`, {}).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan']))
    );
  }

  cancelStudentFromSlot(planId: number, slotId: number, studentId: number): Observable<WeeklyPlanSlotStudentResponse> {
    return this.http.patch<WeeklyPlanSlotStudentResponse>(`${this.url}/${planId}/slots/${slotId}/students/${studentId}/cancel`, {}).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan']))
    );
  }

  restoreStudentFromSlot(planId: number, slotId: number, studentId: number): Observable<WeeklyPlanSlotStudentResponse> {
    return this.http.patch<WeeklyPlanSlotStudentResponse>(`${this.url}/${planId}/slots/${slotId}/students/${studentId}/restore`, {}).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan']))
    );
  }

  cancelStudentFromDay(planId: number, dayOfWeek: number, studentId: number): Observable<void> {
    return this.http.patch<void>(`${this.url}/${planId}/days/${dayOfWeek}/students/${studentId}/cancel`, {}).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan']))
    );
  }

  restoreStudentFromDay(planId: number, dayOfWeek: number, studentId: number): Observable<void> {
    return this.http.patch<void>(`${this.url}/${planId}/days/${dayOfWeek}/students/${studentId}/restore`, {}).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan']))
    );
  }

  restoreDay(planId: number, dayOfWeek: number): Observable<void> {
    return this.http.patch<void>(`${this.url}/${planId}/days/${dayOfWeek}/restore`, {}).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan']))
    );
  }

  getStudentMetrics(chefId?: number | null, page = 0, size = 10, sort = 'studentName,asc'): Observable<StudentMetricsPage> {
    return this.cache.getOrFetch('weekly_plan', `studentMetrics:${chefId ?? ''}:${page}:${size}:${sort}`, () => {
      let params = new HttpParams()
        .set('page', page.toString())
        .set('size', size.toString())
        .set('sort', sort);

      if (chefId !== undefined && chefId !== null) {
        params = params.set('chefId', chefId.toString());
      }

      return this.http.get<StudentMetricsPage>(`${this.url}/metrics/students`, { params });
    });
  }
}