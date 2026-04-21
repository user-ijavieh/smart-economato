import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, UserRequest, BatchAssignResponse } from '../../shared/models/user.model';
import { Page } from '../../shared/models/page.model';
import { HttpQueryCacheService } from './http-query-cache.service';

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private cache = inject(HttpQueryCacheService);
  private url = `${environment.apiUrl}/api/users`;

  getAll(page = 0, size = 20, sort?: string): Observable<Page<User>> {
    return this.cache.getOrFetch('weekly_plan', `users:all:${page}:${size}:${sort ?? ''}`, () => {
      let params = new HttpParams()
        .set('page', page.toString())
        .set('size', size.toString());

      if (sort) {
        params = params.set('sort', sort);
      }

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
    });
  }

  getById(id: number): Observable<User> {
    return this.cache.getOrFetch('weekly_plan', `users:byId:${id}`, () => this.http.get<User>(`${this.url}/${id}`));
  }

  create(user: UserRequest): Observable<User> {
    return this.http.post<User>(this.url, user).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan']))
    );
  }

  update(id: number, user: UserRequest): Observable<User> {
    return this.http.put<User>(`${this.url}/${id}`, user).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan']))
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan']))
    );
  }

  getHidden(page = 0, size = 20, sort?: string): Observable<Page<User>> {
    return this.cache.getOrFetch('weekly_plan', `users:hidden:${page}:${size}:${sort ?? ''}`, () => {
      let params = new HttpParams()
        .set('page', page.toString())
        .set('size', size.toString());

      if (sort) {
        params = params.set('sort', sort);
      }

      return this.http.get<any>(`${this.url}/hidden`, { params }).pipe(
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
    });
  }

  toggleHidden(id: number, hidden: boolean): Observable<User> {
    return this.http.patch<User>(`${this.url}/${id}/hidden`, hidden).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan']))
    );
  }

  search(term: string, page = 0, size = 20, sort?: string): Observable<Page<User>> {
    return this.cache.getOrFetch('weekly_plan', `users:search:${term}:${page}:${size}:${sort ?? ''}`, () => {
      const role = (localStorage.getItem('user_role') || '').toUpperCase();
      let params = new HttpParams()
        .set('term', term)
        .set('page', page.toString())
        .set('size', size.toString());

      if (sort) {
        params = params.set('sort', sort);
      } else {
        params = params.set('sort', 'name,asc');
      }

      const endpoint = role === 'CHEF' ? `${this.url}/teachers/search` : `${this.url}/search`;
      return this.http.get<Page<User>>(endpoint, { params });
    });
  }

  checkUsernameExists(username: string): Observable<boolean> {
    const params = new HttpParams()
      .set('term', username)
      .set('page', '0')
      .set('size', '1')
      .set('sort', 'name,asc');

    const role = (localStorage.getItem('user_role') || '').toUpperCase();
    const endpoint = role === 'CHEF' ? `${this.url}/teachers/search` : `${this.url}/search`;

    return this.http.get<Page<User>>(endpoint, { params }).pipe(
      map(page => page.content.some(u => u.user === username))
    );
  }

  getMyStudents(): Observable<User[]> {
    return this.cache.getOrFetch('weekly_plan', 'users:myStudents', () => this.http.get<User[]>(`${this.url}/students`));
  }

  getStudentsByTeacherId(teacherId: number): Observable<User[]> {
    return this.cache.getOrFetch('weekly_plan', `users:teacherStudents:${teacherId}`, () =>
      this.http.get<User[]>(`${this.url}/teachers/${teacherId}/students`)
    );
  }

  getMyStudentsPage(page = 0, size = 50): Observable<Page<User>> {
    return this.getMyStudents().pipe(
      map(students => {
        const totalElements = students.length;
        const totalPages = Math.max(1, Math.ceil(totalElements / size));
        const safePage = Math.min(Math.max(page, 0), totalPages - 1);
        const start = safePage * size;
        const end = Math.min(start + size, totalElements);
        const content = students.slice(start, end);

        return {
          content,
          totalElements,
          totalPages,
          size,
          number: safePage,
          first: safePage === 0,
          last: safePage >= totalPages - 1,
          empty: content.length === 0
        } as Page<User>;
      })
    );
  }

  escalateRoles(id: number, durationMinutes: number): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/escalate`, { durationMinutes }).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan']))
    );
  }

  deescalateRoles(id: number): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/de-escalate`, {}).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan']))
    );
  }

  getByRole(role: string, sort?: string): Observable<User[]> {
    return this.cache.getOrFetch('weekly_plan', `users:byRole:${role}:${sort ?? ''}`, () => {
      let params = new HttpParams();
      if (sort) {
        params = params.set('sort', sort);
      }
      return this.http.get<User[]>(`${this.url}/by-role/${role}`, { params });
    });
  }

  getUnassignedStudents(): Observable<User[]> {
    return this.cache.getOrFetch('weekly_plan', 'users:unassignedStudents', () => this.http.get<User[]>(`${this.url}/students/unassigned`));
  }

  getTeachers(): Observable<User[]> {
    return this.cache.getOrFetch('weekly_plan', 'users:teachers', () => this.http.get<User[]>(`${this.url}/teachers`));
  }

  searchTeachers(term: string, page = 0, size = 8): Observable<Page<User>> {
    return this.cache.getOrFetch('weekly_plan', `users:searchTeachers:${term}:${page}:${size}`, () => {
      const params = new HttpParams()
        .set('term', term)
        .set('page', page.toString())
        .set('size', size.toString())
        .set('sort', 'name,asc');

      return this.http.get<Page<User>>(`${this.url}/teachers/search`, { params });
    });
  }

  assignTeacher(studentId: number, teacherId: number | null): Observable<void> {
    return this.http.patch<void>(`${this.url}/${studentId}/teacher`, { teacherId }).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan']))
    );
  }

  assignTeacherBatch(teacherId: number | null, studentIds: number[]): Observable<BatchAssignResponse> {
    return this.http.patch<BatchAssignResponse>(`${this.url}/batch/teacher`, { teacherId, studentIds }).pipe(
      tap(() => this.cache.invalidateDomains(['weekly_plan']))
    );
  }

  getStudentsByTeacher(teacherId: number): Observable<User[]> {
    return this.cache.getOrFetch('weekly_plan', `users:studentsByTeacher:${teacherId}`, () => 
      this.http.get<User[]>(`${this.url}/teachers/${teacherId}/students`)
    );
  }

}

