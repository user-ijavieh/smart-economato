import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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

@Injectable({ providedIn: 'root' })
export class WeeklyPlanService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/weekly-plans`;

  createPlan(request: WeeklyPlanRequest): Observable<WeeklyPlanResponse> {
    return this.http.post<WeeklyPlanResponse>(this.url, request);
  }

  updatePlan(planId: number, request: WeeklyPlanRequest): Observable<WeeklyPlanResponse> {
    return this.http.put<WeeklyPlanResponse>(`${this.url}/${planId}`, request);
  }

  activatePlan(planId: number): Observable<WeeklyPlanResponse> {
    return this.http.patch<WeeklyPlanResponse>(`${this.url}/${planId}/activate`, {});
  }

  deactivatePlan(planId: number): Observable<WeeklyPlanResponse> {
    return this.http.patch<WeeklyPlanResponse>(`${this.url}/${planId}/deactivate`, {});
  }

  confirmSlot(planId: number, slotId: number): Observable<WeeklyPlanSlotResponse> {
    return this.http.patch<WeeklyPlanSlotResponse>(`${this.url}/${planId}/slots/${slotId}/confirm`, {});
  }

  unconfirmSlot(planId: number, slotId: number): Observable<WeeklyPlanSlotResponse> {
    return this.http.patch<WeeklyPlanSlotResponse>(`${this.url}/${planId}/slots/${slotId}/unconfirm`, {});
  }

  confirmDay(planId: number, dayOfWeek: number): Observable<ConfirmDayResponse> {
    return this.http.patch<ConfirmDayResponse>(`${this.url}/${planId}/days/${dayOfWeek}/confirm`, {});
  }

  unconfirmDay(planId: number, dayOfWeek: number): Observable<ConfirmDayResponse> {
    return this.http.patch<ConfirmDayResponse>(`${this.url}/${planId}/days/${dayOfWeek}/unconfirm`, {});
  }

  getPlanById(planId: number): Observable<WeeklyPlanResponse> {
    return this.http.get<WeeklyPlanResponse>(`${this.url}/${planId}`);
  }

  getAllPlans(page = 0, size = 10, sort = 'weekStartDate,desc'): Observable<WeeklyPlanPage> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    return this.http.get<WeeklyPlanPage>(this.url, { params });
  }

  getCurrentWeekPlan(): Observable<WeeklyPlanResponse> {
    return this.http.get<WeeklyPlanResponse>(`${this.url}/current`);
  }

  getStockRequirements(planId: number): Observable<WeeklyPlanStockRequirement[]> {
    return this.http.get<WeeklyPlanStockRequirement[]>(`${this.url}/${planId}/stock-requirements`);
  }

  cancelSlot(planId: number, slotId: number): Observable<WeeklyPlanSlotResponse> {
    return this.http.patch<WeeklyPlanSlotResponse>(`${this.url}/${planId}/slots/${slotId}/cancel`, {});
  }

  cancelStudentFromSlot(planId: number, slotId: number, studentId: number): Observable<WeeklyPlanSlotStudentResponse> {
    return this.http.patch<WeeklyPlanSlotStudentResponse>(`${this.url}/${planId}/slots/${slotId}/students/${studentId}/cancel`, {});
  }

  cancelStudentFromDay(planId: number, dayOfWeek: number, studentId: number): Observable<void> {
    return this.http.patch<void>(`${this.url}/${planId}/days/${dayOfWeek}/students/${studentId}/cancel`, {});
  }

  getStudentMetrics(chefId?: number | null, page = 0, size = 10, sort = 'studentName,asc'): Observable<StudentMetricsPage> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    if (chefId !== undefined && chefId !== null) {
      params = params.set('chefId', chefId.toString());
    }

    return this.http.get<StudentMetricsPage>(`${this.url}/metrics/students`, { params });
  }
}