import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Recipe, RecipeRequest } from '../../shared/models/recipe.model';

@Injectable({ providedIn: 'root' })
export class RecipeService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/recipes`;

  getAll(page = 0, size = 20): Observable<Recipe[]> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<Recipe[]>(this.url, { params });
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

  searchByName(name: string): Observable<Recipe[]> {
    return this.http.get<Recipe[]>(`${this.url}/search`, {
      params: new HttpParams().set('name', name)
    });
  }

  findByMaxCost(maxCost: number): Observable<Recipe[]> {
    return this.http.get<Recipe[]>(`${this.url}/by-max-cost`, {
      params: new HttpParams().set('maxCost', maxCost.toString())
    });
  }
}
