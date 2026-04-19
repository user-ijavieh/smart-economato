import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../../shared/models/page.model';
import { Allergen, AllergenRequest } from '../../shared/models/allergen.model';
import { HttpQueryCacheService } from './http-query-cache.service';

@Injectable({ providedIn: 'root' })
export class AllergenService {
  private http = inject(HttpClient);
  private cache = inject(HttpQueryCacheService);
  private url = `${environment.apiUrl}/api/allergens`;

  getAll(page = 0, size = 50, sort?: string): Observable<Page<Allergen>> {
    return this.cache.getOrFetch('product', `allergens:all:${page}:${size}:${sort ?? ''}`, () => {
      let params = new HttpParams()
        .set('page', page.toString())
        .set('size', size.toString());
      if (sort) {
        params = params.set('sort', sort);
      }
      return this.http.get<Page<Allergen>>(this.url, { params });
    });
  }

  getById(id: number): Observable<Allergen> {
    return this.cache.getOrFetch('product', `allergens:byId:${id}`, () => this.http.get<Allergen>(`${this.url}/${id}`));
  }

  create(allergen: AllergenRequest): Observable<Allergen> {
    return this.http.post<Allergen>(this.url, allergen).pipe(
      tap(() => this.cache.invalidateDomains(['product']))
    );
  }

  update(id: number, allergen: AllergenRequest): Observable<Allergen> {
    return this.http.put<Allergen>(`${this.url}/${id}`, allergen).pipe(
      tap(() => this.cache.invalidateDomains(['product']))
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.cache.invalidateDomains(['product']))
    );
  }

  searchByName(name: string): Observable<Allergen[]> {
    return this.cache.getOrFetch('product', `allergens:search:${name}`, () =>
      this.http.get<Allergen[]>(`${this.url}/search`, {
        params: new HttpParams().set('name', name)
      })
    );
  }
}
