import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../../shared/models/page.model';
import { RecipeDraft, RecipeDraftRequest, RecipeDraftRejectRequest, RecipeDraftStatus } from '../../shared/models/recipe-draft.model';

@Injectable({ providedIn: 'root' })
export class RecipeDraftService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/recipe-drafts`;

  getAll(page = 0, size = 12, status?: RecipeDraftStatus): Observable<Page<RecipeDraft>> {
    let params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<Page<RecipeDraft>>(this.url, { params });
  }

  getMine(page = 0, size = 12): Observable<Page<RecipeDraft>> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    return this.http.get<Page<RecipeDraft>>(`${this.url}/mine`, { params });
  }

  getById(id: number): Observable<RecipeDraft> {
    return this.http.get<RecipeDraft>(`${this.url}/${id}`);
  }

  create(request: RecipeDraftRequest): Observable<RecipeDraft> {
    return this.http.post<RecipeDraft>(this.url, request);
  }

  update(id: number, request: RecipeDraftRequest): Observable<RecipeDraft> {
    return this.http.put<RecipeDraft>(`${this.url}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  approve(id: number): Observable<RecipeDraft> {
    return this.http.patch<RecipeDraft>(`${this.url}/${id}/approve`, {});
  }

  reject(id: number, reason: string): Observable<RecipeDraft> {
    const body: RecipeDraftRejectRequest = { reason };
    return this.http.patch<RecipeDraft>(`${this.url}/${id}/reject`, body);
  }
}