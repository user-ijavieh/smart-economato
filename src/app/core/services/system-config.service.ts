import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

@Injectable({ providedIn: 'root' })
export class SystemConfigService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/config`;

  getCurrent(): Observable<SystemConfigSnapshotResponseDTO> {
    return this.http.get<SystemConfigSnapshotResponseDTO>(`${this.baseUrl}/current`);
  }

  getPresence(): Observable<PresenceConfigResponseDTO> {
    return this.http.get<PresenceConfigResponseDTO>(`${this.baseUrl}/presence/`);
  }

  updatePresence(request: PresenceConfigRequestDTO): Observable<PresenceConfigResponseDTO> {
    return this.http.put<PresenceConfigResponseDTO>(`${this.baseUrl}/presence/`, request);
  }

  purgePresenceLogs(from?: string, to?: string): Observable<PurgeResultResponseDTO> {
    return this.http.request<PurgeResultResponseDTO>('DELETE', `${this.baseUrl}/presence/logs`, {
      body: from || to ? { from, to } : null
    });
  }

  getAlerts(): Observable<AlertsConfigResponseDTO> {
    return this.http.get<AlertsConfigResponseDTO>(`${this.baseUrl}/alerts/`);
  }

  updateAlerts(request: AlertsConfigRequestDTO): Observable<AlertsConfigResponseDTO> {
    return this.http.put<AlertsConfigResponseDTO>(`${this.baseUrl}/alerts/`, request);
  }

  getPredictions(): Observable<PredictionsConfigResponseDTO> {
    return this.http.get<PredictionsConfigResponseDTO>(`${this.baseUrl}/predictions/`);
  }

  updatePredictions(request: PredictionsConfigRequestDTO): Observable<PredictionsConfigResponseDTO> {
    return this.http.put<PredictionsConfigResponseDTO>(`${this.baseUrl}/predictions/`, request);
  }

  getSessions(): Observable<SessionsConfigResponseDTO> {
    return this.http.get<SessionsConfigResponseDTO>(`${this.baseUrl}/sessions/`);
  }

  updateSessions(request: SessionsConfigRequestDTO): Observable<SessionsConfigResponseDTO> {
    return this.http.put<SessionsConfigResponseDTO>(`${this.baseUrl}/sessions/`, request);
  }

  getSecurity(): Observable<SecurityConfigResponseDTO> {
    return this.http.get<SecurityConfigResponseDTO>(`${this.baseUrl}/security/`);
  }

  updateSecurity(request: SecurityConfigRequestDTO): Observable<SecurityConfigResponseDTO> {
    return this.http.put<SecurityConfigResponseDTO>(`${this.baseUrl}/security/`, request);
  }

  getIncidents(): Observable<IncidentsConfigResponseDTO> {
    return this.http.get<IncidentsConfigResponseDTO>(`${this.baseUrl}/incidents/`);
  }

  updateIncidents(request: IncidentsConfigRequestDTO): Observable<IncidentsConfigResponseDTO> {
    return this.http.put<IncidentsConfigResponseDTO>(`${this.baseUrl}/incidents/`, request);
  }

  getNotifications(): Observable<NotificationsConfigResponseDTO> {
    return this.http.get<NotificationsConfigResponseDTO>(`${this.baseUrl}/notifications/`);
  }

  updateNotifications(request: NotificationsConfigRequestDTO): Observable<NotificationsConfigResponseDTO> {
    return this.http.put<NotificationsConfigResponseDTO>(`${this.baseUrl}/notifications/`, request);
  }

  purgeNotificationLogs(from?: string, to?: string): Observable<PurgeResultResponseDTO> {
    return this.http.request<PurgeResultResponseDTO>('DELETE', `${this.baseUrl}/notifications/logs`, {
      body: from || to ? { from, to } : null
    });
  }

  getAdvanced(): Observable<AdvancedConfigResponseDTO> {
    return this.http.get<AdvancedConfigResponseDTO>(`${this.baseUrl}/advanced/`);
  }

  updateAdvanced(request: AdvancedConfigRequestDTO): Observable<AdvancedConfigResponseDTO> {
    return this.http.put<AdvancedConfigResponseDTO>(`${this.baseUrl}/advanced/`, request);
  }

  getGlobalAudit(page = 0, size = 20, sort = 'changedAt,desc'): Observable<PagedResponse<ConfigAuditLogResponseDTO>> {
    return this.http.get<PagedResponse<ConfigAuditLogResponseDTO>>(`${this.baseUrl}/audit-log/`, {
      params: {
        page: page.toString(),
        size: size.toString(),
        sort
      }
    });
  }
}
