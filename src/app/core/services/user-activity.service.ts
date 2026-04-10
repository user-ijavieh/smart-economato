import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserActivityPage } from '../../shared/models/user-activity.model';

@Injectable({ providedIn: 'root' })
export class UserActivityService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/user-activity`;

  getAllActivity(page = 0, size = 20, sort = 'timestamp,desc'): Observable<UserActivityPage> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    return this.http.get<UserActivityPage>(this.url, { params });
  }

  getActivityByUserId(userId: number, page = 0, size = 20, sort = 'timestamp,desc'): Observable<UserActivityPage> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    return this.http.get<UserActivityPage>(`${this.url}/user/${userId}`, { params });
  }

  getMyStudentsActivity(page = 0, size = 20, sort = 'timestamp,desc'): Observable<UserActivityPage> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    return this.http.get<UserActivityPage>(`${this.url}/my-students`, { params });
  }
}
