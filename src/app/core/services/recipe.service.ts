import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../../shared/models/page.model';
import { Recipe, RecipeRequest, CookRequest } from '../../shared/models/recipe.model';
import { map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RecipeService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/recipes`;

  getAll(page = 0, size = 12, sort = 'name,asc'): Observable<Page<Recipe>> {
    const queryString = `page=${page}&size=${size}&sort=${sort}`;
    const fullUrl = `${this.url}?${queryString}`;

    return this.http.get<any>(fullUrl).pipe(
      map(response => {
        // Check if response is a Page object (has content property) or raw array
        const isPage = response.hasOwnProperty('content');
        const rawContent = isPage ? response.content : (Array.isArray(response) ? response : []);

        // If it's a raw array (backend ignored pagination), we must slice it manually
        // to simulate server-side pagination
        let content = rawContent;
        let totalElements = response.totalElements ?? rawContent.length;
        let totalPages = response.totalPages ?? 1;

        // If it's a raw array (backend ignored pagination) OR if the content size exceeds the requested size
        // (backend wrapper but ignored pagination), we must slice it manually.
        if (!isPage || rawContent.length > size) {
          // Backend returned all items, slice them here
          totalElements = rawContent.length;
          totalPages = Math.ceil(totalElements / size);
          const start = page * size;
          const end = Math.min(start + size, totalElements);
          content = rawContent.slice(start, end);
        }

        return {
          content: content,
          totalElements: totalElements,
          totalPages: totalPages,
          size: size,
          number: page,
          first: page === 0,
          last: page === totalPages - 1,
          empty: content.length === 0
        };
      })
    );
  }

  getById(id: number): Observable<Recipe> {
    return this.http.get<Recipe>(`${this.url}/${id}`);
  }

  create(recipe: RecipeRequest): Observable<Recipe> {
    return this.http.post<Recipe>(this.url, recipe);
  }

  update(id: number, recipe: RecipeRequest): Observable<Recipe> {
    return this.http.put<Recipe>(`${this.url}/${id}`, recipe);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }


  searchByName(name: string, page = 0, size = 12, sort = 'name,asc'): Observable<Page<Recipe>> {
    const queryString = `name=${encodeURIComponent(name)}&page=${page}&size=${size}&sort=${sort}`;
    return this.http.get<any>(`${this.url}/search?${queryString}`).pipe(
      map(response => {
        const isPage = response.hasOwnProperty('content');
        const rawContent = isPage ? response.content : (Array.isArray(response) ? response : []);

        let content = rawContent;
        let totalElements = response.totalElements ?? rawContent.length;
        let totalPages = response.totalPages ?? 1;

        // If it's a raw array (backend ignored pagination) OR if the content size exceeds the requested size
        if (!isPage || rawContent.length > size) {
          totalElements = rawContent.length;
          totalPages = Math.ceil(totalElements / size);
          const start = page * size;
          const end = Math.min(start + size, totalElements);
          content = rawContent.slice(start, end);
        }

        return {
          content: content,
          totalElements: totalElements,
          totalPages: totalPages,
          size: size,
          number: page,
          first: page === 0,
          last: page === totalPages - 1,
          empty: content.length === 0
        };
      })
    );
  }

  findByMaxCost(maxCost: number): Observable<Recipe[]> {
    return this.http.get<Recipe[]>(`${this.url}/by-max-cost`, {
      params: new HttpParams().set('maxCost', maxCost.toString())
    });
  }

  cook(request: CookRequest): Observable<Recipe> {
    return this.http.post<Recipe>(`${this.url}/cook`, request);
  }

  getPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/pdf`, {
      responseType: 'blob'
    });
  }
}
