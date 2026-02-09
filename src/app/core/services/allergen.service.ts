import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../../shared/models/page.model';
import { Allergen, AllergenRequest } from '../../shared/models/allergen.model';

@Injectable({ providedIn: 'root' })
export class AllergenService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/allergens`;

  getAll(page = 0, size = 50): Observable<Page<Allergen>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<Page<Allergen>>(this.url, { params });
  }

  getById(id: number): Observable<Allergen> {
    return this.http.get<Allergen>(`${this.url}/${id}`);
  }

  create(allergen: AllergenRequest): Observable<Allergen> {
    return this.http.post<Allergen>(this.url, allergen);
  }

  update(id: number, allergen: AllergenRequest): Observable<Allergen> {
    return this.http.put<Allergen>(`${this.url}/${id}`, allergen);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  searchByName(name: string): Observable<Allergen> {
    return this.http.get<Allergen>(`${this.url}/search`, {
      params: new HttpParams().set('name', name)
    });
  }
}
