import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BatchStockMovementRequest,
  BatchStockMovementResponse,
  KitchenReport,
  RecipeCookingAudit,
  RecipeCookingAuditPage,
  ReportRange
} from '../../shared/models/kitchen.model';

@Injectable({ providedIn: 'root' })
export class KitchenService {
  private http = inject(HttpClient);
  private auditsUrl = `${environment.apiUrl}/api/recipe-cooking-audit`;
  private legacyAuditsUrl = `${environment.apiUrl}/api/recipe-cooking-audits`;
  private ledgerUrl = `${environment.apiUrl}/api/stock-ledger`;
  private reportsUrl = `${environment.apiUrl}/api/kitchen-reports`;

  getCookingAudits(page = 0, size = 20, sort = 'cookingDate,desc'): Observable<RecipeCookingAuditPage> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    return this.http.get<any>(this.auditsUrl, { params }).pipe(
      catchError((error) => {
        if (error?.status === 404) {
          return this.http.get<any>(this.legacyAuditsUrl, { params });
        }
        return throwError(() => error);
      }),
      map(response => this.normalizeAuditPage(response, page, size))
    );
  }

  getCookingAuditsByRecipe(recipeId: number): Observable<RecipeCookingAudit[]> {
    return this.http.get<any[]>(`${this.auditsUrl}/recipe/${recipeId}`).pipe(
      catchError((error) => {
        if (error?.status === 404) {
          return this.http.get<any[]>(`${this.legacyAuditsUrl}/recipe/${recipeId}`);
        }
        return throwError(() => error);
      }),
      map(audits => audits.map(audit => this.normalizeAudit(audit)))
    );
  }

  getCookingAuditsByUser(userId: number): Observable<RecipeCookingAudit[]> {
    return this.http.get<any[]>(`${this.auditsUrl}/user/${userId}`).pipe(
      catchError((error) => {
        if (error?.status === 404) {
          return this.http.get<any[]>(`${this.legacyAuditsUrl}/user/${userId}`);
        }
        return throwError(() => error);
      }),
      map(audits => audits.map(audit => this.normalizeAudit(audit)))
    );
  }

  getCookingAuditsByDateRange(startDate: string, endDate: string): Observable<RecipeCookingAudit[]> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    return this.http.get<any[]>(`${this.auditsUrl}/date-range`, { params }).pipe(
      catchError((error) => {
        if (error?.status === 404) {
          return this.http.get<any[]>(`${this.legacyAuditsUrl}/date-range`, { params });
        }
        return throwError(() => error);
      }),
      map(audits => audits.map(audit => this.normalizeAudit(audit)))
    );
  }

  searchCookingAuditsByName(name: string): Observable<RecipeCookingAudit[]> {
    const params = new HttpParams().set('name', name);

    return this.http.get<any[]>(`${this.auditsUrl}/search`, { params }).pipe(
      catchError((error) => {
        if (error?.status === 404) {
          return this.http.get<any[]>(`${this.legacyAuditsUrl}/search`, { params });
        }
        return throwError(() => error);
      }),
      map(audits => audits.map(audit => this.normalizeAudit(audit)))
    );
  }

  revertCookingBatch(request: BatchStockMovementRequest): Observable<BatchStockMovementResponse> {
    return this.http.post<BatchStockMovementResponse>(`${this.ledgerUrl}/batch`, request);
  }

  getKitchenReport(range: ReportRange, startDate?: string, endDate?: string): Observable<KitchenReport> {
    let params = new HttpParams().set('range', range);

    if (range === 'CUSTOM' && startDate && endDate) {
      params = params.set('startDate', startDate).set('endDate', endDate);
    }

    return this.http.get<KitchenReport>(this.reportsUrl, { params });
  }

  downloadKitchenReportPdf(range: ReportRange, startDate?: string, endDate?: string): Observable<Blob> {
    let params = new HttpParams().set('range', range);

    if (range === 'CUSTOM' && startDate && endDate) {
      params = params.set('startDate', startDate).set('endDate', endDate);
    }

    return this.http.get(`${this.reportsUrl}/export/pdf`, {
      params,
      responseType: 'blob'
    });
  }

  private normalizeAuditPage(response: any, page: number, size: number): RecipeCookingAuditPage {
    const isPage = response && typeof response === 'object' && Object.prototype.hasOwnProperty.call(response, 'content');
    const rawContent = isPage
      ? (Array.isArray(response.content) ? response.content : [])
      : (Array.isArray(response) ? response : []);

    const normalizedContent = rawContent.map((audit: any) => this.normalizeAudit(audit));
    const totalElements = isPage
      ? (response.totalElements ?? normalizedContent.length)
      : normalizedContent.length;
    const totalPages = isPage
      ? (response.totalPages ?? Math.max(1, Math.ceil(totalElements / size)))
      : Math.max(1, Math.ceil(totalElements / size));

    return {
      content: normalizedContent,
      totalElements,
      totalPages,
      size: response?.size ?? size,
      number: response?.number ?? page,
      first: response?.first ?? page === 0,
      last: response?.last ?? page >= totalPages - 1,
      empty: normalizedContent.length === 0
    };
  }

  private normalizeAudit(audit: any): RecipeCookingAudit {
    return {
      id: Number(audit?.id ?? 0),
      recipeId: Number(audit?.recipeId ?? audit?.recipe_id ?? 0),
      recipeName: audit?.recipeName ?? audit?.recipe_name ?? 'Receta',
      userId: Number(audit?.userId ?? audit?.user_id ?? 0),
      userName: audit?.userName ?? audit?.user_name ?? 'Usuario',
      quantityCooked: Number(audit?.quantityCooked ?? audit?.quantity_cooked ?? 0),
      details: audit?.details ?? '',
      componentsState: audit?.componentsState ?? audit?.components_state ?? null,
      cookingDate: audit?.cookingDate ?? audit?.cooking_date ?? ''
    };
  }
}