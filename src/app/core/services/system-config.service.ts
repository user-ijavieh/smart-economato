import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdvancedConfigRequestDTO,
  AdvancedConfigResponseDTO,
  AlertsConfigRequestDTO,
  AlertsConfigResponseDTO,
  ConfigAuditLogResponseDTO,
  IncidentsConfigRequestDTO,
  IncidentsConfigResponseDTO,
  NotificationsConfigRequestDTO,
  NotificationsConfigResponseDTO,
  PagedResponse,
  PredictionsConfigRequestDTO,
  PredictionsConfigResponseDTO,
  PresenceConfigRequestDTO,
  PresenceConfigResponseDTO,
  PurgeResultResponseDTO,
  SecurityConfigRequestDTO,
  SecurityConfigResponseDTO,
  SessionsConfigRequestDTO,
  SessionsConfigResponseDTO,
  SystemConfigSnapshotResponseDTO
} from '../../shared/models/system-config.model';
import { HttpQueryCacheService } from './http-query-cache.service';

@Injectable({ providedIn: 'root' })
export class SystemConfigService {
  private http = inject(HttpClient);
  private cache = inject(HttpQueryCacheService);
  private baseUrl = `${environment.apiUrl}/api/config`;

  getCurrent(): Observable<SystemConfigSnapshotResponseDTO> {
    return this.cache.getOrFetch('product', 'config:current', () =>
      this.http.get<SystemConfigSnapshotResponseDTO>(`${this.baseUrl}/current`)
    );
  }

  getPresence(): Observable<PresenceConfigResponseDTO> {
    return this.cache.getOrFetch('product', 'config:presence', () =>
      this.http.get<PresenceConfigResponseDTO>(`${this.baseUrl}/presence/`)
    );
  }

  updatePresence(request: PresenceConfigRequestDTO): Observable<PresenceConfigResponseDTO> {
    return this.http.put<PresenceConfigResponseDTO>(`${this.baseUrl}/presence/`, request).pipe(
      tap(() => this.cache.invalidateDomains(['product']))
    );
  }

  purgePresenceLogs(from?: string, to?: string): Observable<PurgeResultResponseDTO> {
    return this.http.request<PurgeResultResponseDTO>('DELETE', `${this.baseUrl}/presence/logs`, {
      body: from || to ? { from, to } : null
    }).pipe(
      tap(() => this.cache.invalidateDomains(['product']))
    );
  }

  getAlerts(): Observable<AlertsConfigResponseDTO> {
    return this.cache.getOrFetch('stock_alerts', 'config:alerts', () =>
      this.http.get<AlertsConfigResponseDTO>(`${this.baseUrl}/alerts/`)
    );
  }

  updateAlerts(request: AlertsConfigRequestDTO): Observable<AlertsConfigResponseDTO> {
    return this.http.put<AlertsConfigResponseDTO>(`${this.baseUrl}/alerts/`, request).pipe(
      tap(() => this.cache.invalidateDomains(['stock_alerts', 'product']))
    );
  }

  getPredictions(): Observable<PredictionsConfigResponseDTO> {
    return this.cache.getOrFetch('stock_alerts', 'config:predictions', () =>
      this.http.get<PredictionsConfigResponseDTO>(`${this.baseUrl}/predictions/`)
    );
  }

  updatePredictions(request: PredictionsConfigRequestDTO): Observable<PredictionsConfigResponseDTO> {
    return this.http.put<PredictionsConfigResponseDTO>(`${this.baseUrl}/predictions/`, request).pipe(
      tap(() => this.cache.invalidateDomains(['stock_alerts', 'product']))
    );
  }

  getSessions(): Observable<SessionsConfigResponseDTO> {
    return this.cache.getOrFetch('product', 'config:sessions', () =>
      this.http.get<SessionsConfigResponseDTO>(`${this.baseUrl}/sessions/`)
    );
  }

  updateSessions(request: SessionsConfigRequestDTO): Observable<SessionsConfigResponseDTO> {
    return this.http.put<SessionsConfigResponseDTO>(`${this.baseUrl}/sessions/`, request).pipe(
      tap(() => this.cache.invalidateDomains(['product']))
    );
  }

  getSecurity(): Observable<SecurityConfigResponseDTO> {
    return this.cache.getOrFetch('product', 'config:security', () =>
      this.http.get<SecurityConfigResponseDTO>(`${this.baseUrl}/security/`)
    );
  }

  updateSecurity(request: SecurityConfigRequestDTO): Observable<SecurityConfigResponseDTO> {
    return this.http.put<SecurityConfigResponseDTO>(`${this.baseUrl}/security/`, request).pipe(
      tap(() => this.cache.invalidateDomains(['product']))
    );
  }

  getIncidents(): Observable<IncidentsConfigResponseDTO> {
    return this.cache.getOrFetch('product', 'config:incidents', () =>
      this.http.get<IncidentsConfigResponseDTO>(`${this.baseUrl}/incidents/`)
    );
  }

  updateIncidents(request: IncidentsConfigRequestDTO): Observable<IncidentsConfigResponseDTO> {
    return this.http.put<IncidentsConfigResponseDTO>(`${this.baseUrl}/incidents/`, request).pipe(
      tap(() => this.cache.invalidateDomains(['product']))
    );
  }

  getNotifications(): Observable<NotificationsConfigResponseDTO> {
    return this.cache.getOrFetch('product', 'config:notifications', () =>
      this.http.get<NotificationsConfigResponseDTO>(`${this.baseUrl}/notifications/`)
    );
  }

  updateNotifications(request: NotificationsConfigRequestDTO): Observable<NotificationsConfigResponseDTO> {
    return this.http.put<NotificationsConfigResponseDTO>(`${this.baseUrl}/notifications/`, request).pipe(
      tap(() => this.cache.invalidateDomains(['product']))
    );
  }

  purgeNotificationLogs(from?: string, to?: string): Observable<PurgeResultResponseDTO> {
    return this.http.request<PurgeResultResponseDTO>('DELETE', `${this.baseUrl}/notifications/logs`, {
      body: from || to ? { from, to } : null
    }).pipe(
      tap(() => this.cache.invalidateDomains(['product']))
    );
  }

  getAdvanced(): Observable<AdvancedConfigResponseDTO> {
    return this.cache.getOrFetch('product', 'config:advanced', () =>
      this.http.get<AdvancedConfigResponseDTO>(`${this.baseUrl}/advanced/`)
    );
  }

  updateAdvanced(request: AdvancedConfigRequestDTO): Observable<AdvancedConfigResponseDTO> {
    return this.http.put<AdvancedConfigResponseDTO>(`${this.baseUrl}/advanced/`, request).pipe(
      tap(() => this.cache.invalidateDomains(['product']))
    );
  }

  getGlobalAudit(page = 0, size = 20, sort = 'changedAt,desc'): Observable<PagedResponse<ConfigAuditLogResponseDTO>> {
    return this.cache.getOrFetch('product', `config:audit:${page}:${size}:${sort}`, () =>
      this.http.get<PagedResponse<ConfigAuditLogResponseDTO>>(`${this.baseUrl}/audit-log/`, {
        params: {
          page: page.toString(),
          size: size.toString(),
          sort
        }
      })
    );
  }

  refreshSuppliersCache(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/cache/refresh/suppliers`, {}).pipe(
      tap(() => this.cache.invalidateDomains(['product']))
    );
  }

}
