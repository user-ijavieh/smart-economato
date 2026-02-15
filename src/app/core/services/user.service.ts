import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, UserRequest } from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/users`;

  getAll(page = 0, size = 100): Observable<User[]> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<User[]>(this.url, { params });
  }

  getById(id: number): Observable<User> {
    return this.http.get<User>(`${this.url}/${id}`);
  }

  create(user: UserRequest): Observable<User> {
    return this.http.post<User>(this.url, user);
  }

  update(id: number, user: UserRequest): Observable<User> {
    return this.http.put<User>(`${this.url}/${id}`, user);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  getByRole(role: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.url}/by-role/${role}`);
  }
}
