import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../../shared/models/page.model';
import { Recipe, RecipeRequest, CookRequest, CookableRecipe } from '../../shared/models/recipe.model';
import { WeeklyPlanStockRequirement } from '../../shared/models/weekly-plan.model';
import { map } from 'rxjs';
import { HttpQueryCacheService } from './http-query-cache.service';

@Injectable({ providedIn: 'root' })
export class RecipeService {
  private http = inject(HttpClient);
  private cache = inject(HttpQueryCacheService);
  private url = `${environment.apiUrl}/api/recipes`;

  getAll(page = 0, size = 12, sort = 'name,asc'): Observable<Page<Recipe>> {
    return this.cache.getOrFetch('recipe', `all:${page}:${size}:${sort}`, () => {
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
    });
  }

  getById(id: number): Observable<Recipe> {
    return this.cache.getOrFetch('recipe', `byId:${id}`, () => this.http.get<Recipe>(`${this.url}/${id}`));
  }

  getCookableRecipes(): Observable<CookableRecipe[]> {
    return this.cache.getOrFetch('recipe', 'cookable', () => this.http.get<CookableRecipe[]>(`${this.url}/cookable`));
  }

  create(recipe: RecipeRequest): Observable<Recipe> {
    return this.http.post<Recipe>(this.url, recipe).pipe(
      tap(() => this.cache.invalidateDomains(['recipe', 'weekly_plan']))
    );
  }

  update(id: number, recipe: RecipeRequest): Observable<Recipe> {
    return this.http.put<Recipe>(`${this.url}/${id}`, recipe).pipe(
      tap(() => this.cache.invalidateDomains(['recipe', 'weekly_plan']))
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.cache.invalidateDomains(['recipe', 'weekly_plan']))
    );
  }

  getHidden(page = 0, size = 12, sort = 'name,asc'): Observable<Page<Recipe>> {
    return this.cache.getOrFetch('recipe', `hidden:${page}:${size}:${sort}`, () => {
      const queryString = `page=${page}&size=${size}&sort=${sort}`;
      const fullUrl = `${this.url}/hidden?${queryString}`;

      return this.http.get<any>(fullUrl).pipe(
        map(response => {
          const isPage = response.hasOwnProperty('content');
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
    });
  }

  toggleHidden(id: number, hidden: boolean): Observable<void> {
    const params = new HttpParams().set('hidden', hidden.toString());
    return this.http.patch<void>(`${this.url}/${id}/toggle-hidden`, {}, { params }).pipe(
      tap(() => this.cache.invalidateDomains(['recipe', 'weekly_plan']))
    );
  }


  searchByName(name: string, page = 0, size = 12, sort = 'name,asc'): Observable<Page<Recipe>> {
    return this.cache.getOrFetch('recipe', `search:${name}:${page}:${size}:${sort}`, () => {
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
    });
  }

  findByMaxCost(maxCost: number): Observable<Recipe[]> {
    return this.cache.getOrFetch('recipe', `maxCost:${maxCost}`, () =>
      this.http.get<Recipe[]>(`${this.url}/maxcost`, {
        params: new HttpParams().set('maxCost', maxCost.toString())
      })
    );
  }

  cook(request: CookRequest): Observable<Recipe> {
    return this.http.post<Recipe>(`${this.url}/cook`, request).pipe(
      tap(() => this.cache.invalidateDomains(['recipe', 'ledger', 'product', 'weekly_plan', 'stock_alerts']))
    );
  }

  revertCooking(auditId: number, reason: string = 'Reversión manual'): Observable<void> {
    const params = new HttpParams().set('reason', reason);
    return this.http.post<void>(`${this.url}/cook/${auditId}/revert`, {}, { params }).pipe(
      tap(() => this.cache.invalidateDomains(['recipe', 'ledger', 'product', 'weekly_plan', 'stock_alerts']))
    );
  }

  getPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/pdf`, {
      responseType: 'blob'
    });
  }

  calculateRequirements(recipes: { recipeId: number; quantity: number }[]): Observable<WeeklyPlanStockRequirement[]> {
    return this.http.post<WeeklyPlanStockRequirement[]>(`${this.url}/requirements`, { recipes });
  }
}
