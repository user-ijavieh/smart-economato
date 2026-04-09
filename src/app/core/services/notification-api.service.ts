import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppRole } from './notification.service';

@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/notifications`;

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
