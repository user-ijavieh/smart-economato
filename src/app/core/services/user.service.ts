import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, UserRequest } from '../../shared/models/user.model';
import { Page } from '../../shared/models/page.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/users`;

  getAll(page = 0, size = 20): Observable<Page<User>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<any>(this.url, { params }).pipe(
      map(response => {
        const isPage = response && response.hasOwnProperty('content');
        const rawContent = isPage ? response.content : (Array.isArray(response) ? response : []);

        let content = rawContent;
        let totalElements = response.totalElements ?? rawContent.length;
        let totalPages = response.totalPages ?? 1;

        if (!isPage || rawContent.length > size) {
          totalElements = rawContent.length;
          totalPages = Math.ceil(totalElements / size);
          const start = page * size;
          const end = Math.min(start + size, totalElements);
          content = rawContent.slice(start, end);
        }

        return {
          content,
          totalElements,
          totalPages,
          size,
          number: page,
          first: page === 0,
          last: page === totalPages - 1,
          empty: content.length === 0
        };
      })
    );
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

  /** Devuelve todos los usuarios sin paginar (para dropdowns, mapas de nombres, etc.) */
  getAllUnpaged(): Observable<User[]> {
    return this.getAll(0, 10000).pipe(map(page => page.content));
  }

  getByRole(role: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.url}/by-role/${role}`);
  }
}
