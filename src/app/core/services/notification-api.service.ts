import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppRole } from './notification.service';

export interface NotificationResponseDTO {
  id: number;
  type: string;
  title: string;
  message: string;
  referenceId: number | null;
  // Backend payload may use either "isRead" or "read" depending on serializer/config.
  isRead?: boolean;
  read?: boolean;
  senderName: string | null;
  groupId: string | null;
  createdAt: string;
}

export interface NotificationPageResponse {
  content: NotificationResponseDTO[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/notifications`;

  getMyNotifications(page = 0, size = 50): Observable<NotificationPageResponse> {
    const params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sort', 'createdAt,desc');

    return this.http.get<NotificationPageResponse>(this.baseUrl, { params });
  }

  markAsRead(id: number): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/read`, null);
  }

  markAllAsRead(): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/read-all`, null);
  }

  sendToRole(role: AppRole, title: string, message: string): Observable<void> {
    const params = new HttpParams()
      .set('title', title)
      .set('message', message);

    return this.http.post<void>(`${this.baseUrl}/role/${role}`, null, { params });
  }

  sendToUser(username: string, title: string, message: string): Observable<void> {
    const params = new HttpParams()
      .set('title', title)
      .set('message', message);

    return this.http.post<void>(`${this.baseUrl}/user/${encodeURIComponent(username)}`, null, { params });
  }
}
