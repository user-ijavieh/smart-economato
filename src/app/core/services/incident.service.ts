import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AttachAuditRequest,
  CloseIncidentRequest,
  CreateIncidentRequest,
  IncidentChatMessage,
  IncidentDetail,
  IncidentFilters,
  IncidentListItem,
  IncidentType,
  IncidentTypeRequest,
  OpenIncidentRequest,
  RecipeCookingAudit,
  RevertAuditFromIncidentRequest
} from '../../shared/models/incident.model';
import { Page } from '../../shared/models/page.model';

@Injectable({ providedIn: 'root' })
export class IncidentService {
  private readonly http = inject(HttpClient);
  private readonly incidentsUrl = `${environment.apiUrl}/api/incidents`;
  private readonly incidentTypesUrl = `${environment.apiUrl}/api/incident-types`;

  getIncidents(filters: IncidentFilters = {}): Observable<Page<IncidentListItem>> {
    let params = new HttpParams();

    if (filters.status) params = params.set('status', filters.status);
    if (filters.severity) params = params.set('severity', filters.severity);
    if (filters.incidentTypeId !== undefined && filters.incidentTypeId !== '') params = params.set('incidentTypeId', String(filters.incidentTypeId));
    if (filters.createdById !== undefined && filters.createdById !== '') params = params.set('createdById', String(filters.createdById));
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    if (filters.page !== undefined) params = params.set('page', String(filters.page));
    if (filters.size !== undefined) params = params.set('size', String(filters.size));
    (filters.sort || ['createdAt,desc']).forEach(sort => {
      params = params.append('sort', sort);
    });

    return this.http.get<Page<IncidentListItem>>(this.incidentsUrl, { params });
  }

  getIncident(id: number): Observable<IncidentDetail> {
    return this.http.get<IncidentDetail>(`${this.incidentsUrl}/${id}`);
  }

  createIncident(request: CreateIncidentRequest): Observable<IncidentDetail> {
    return this.http.post<IncidentDetail>(this.incidentsUrl, request);
  }

  openIncident(id: number, request: OpenIncidentRequest): Observable<IncidentDetail> {
    return this.http.patch<IncidentDetail>(`${this.incidentsUrl}/${id}/open`, request);
  }

  closeIncident(id: number, request: CloseIncidentRequest): Observable<IncidentDetail> {
    return this.http.patch<IncidentDetail>(`${this.incidentsUrl}/${id}/close`, request);
  }

  getAttachableAudits(id: number): Observable<RecipeCookingAudit[]> {
    return this.http.get<RecipeCookingAudit[]>(`${this.incidentsUrl}/${id}/attachable-audits`);
  }

  attachAudits(id: number, request: AttachAuditRequest): Observable<any> {
    return this.http.post(`${this.incidentsUrl}/${id}/audits`, request);
  }

  revertAudit(id: number, attachmentId: number, request: RevertAuditFromIncidentRequest): Observable<any> {
    return this.http.post(`${this.incidentsUrl}/${id}/audits/${attachmentId}/revert`, request);
  }

  getChatHistory(id: number, page = 0, size = 50): Observable<Page<IncidentChatMessage>> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('size', String(size))
      .set('sort', 'createdAt,asc');

    return this.http.get<Page<IncidentChatMessage>>(`${this.incidentsUrl}/${id}/chat`, { params });
  }

  markChatAsRead(id: number): Observable<void> {
    return this.http.post<void>(`${this.incidentsUrl}/${id}/chat/mark-read`, {});
  }

  sendChatMessage(id: number, content: string, file?: File | null): Observable<IncidentChatMessage> {
    const formData = new FormData();
    const normalizedContent = content?.trim();

    if (normalizedContent) {
      formData.append('content', normalizedContent);
    }

    if (file) {
      formData.append('file', file, file.name);
    }

    return this.http.post<IncidentChatMessage>(`${this.incidentsUrl}/${id}/chat`, formData);
  }

  downloadChatAttachment(id: number, messageId: number): Observable<Blob> {
    return this.http.get(`${this.incidentsUrl}/${id}/chat/attachments/${messageId}`, { responseType: 'blob' });
  }

  exportPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.incidentsUrl}/${id}/export/pdf`, { responseType: 'blob' });
  }

  getIncidentTypes(): Observable<IncidentType[]> {
    return this.http.get<IncidentType[]>(this.incidentTypesUrl);
  }

  getAllIncidentTypes(): Observable<IncidentType[]> {
    return this.http.get<IncidentType[]>(`${this.incidentTypesUrl}/all`);
  }

  getIncidentType(id: number): Observable<IncidentType> {
    return this.http.get<IncidentType>(`${this.incidentTypesUrl}/${id}`);
  }

  createIncidentType(request: IncidentTypeRequest): Observable<IncidentType> {
    return this.http.post<IncidentType>(this.incidentTypesUrl, request);
  }

  updateIncidentType(id: number, request: IncidentTypeRequest): Observable<IncidentType> {
    return this.http.put<IncidentType>(`${this.incidentTypesUrl}/${id}`, request);
  }

  toggleIncidentType(id: number): Observable<IncidentType> {
    return this.http.patch<IncidentType>(`${this.incidentTypesUrl}/${id}/toggle-active`, {});
  }
}