import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RecipeAudit } from '../../shared/models/recipe-audit.model';

@Injectable({ providedIn: 'root' })
export class RecipeAuditService {
    private http = inject(HttpClient);
    private url = `${environment.apiUrl}/api/recipe-audits`;

    getAll(page = 0, size = 20, sort?: string[]): Observable<RecipeAudit[]> {
        let params = new HttpParams()
            .set('page', page.toString())
            .set('size', size.toString());
            
        // Agregar ordenamiento si se proporciona
        if (sort && sort.length > 0) {
            sort.forEach(sortParam => {
                params = params.append('sort', sortParam);
            });
        }
        
        return this.http.get<RecipeAudit[]>(this.url, { params });
    }

    getById(id: number): Observable<RecipeAudit> {
        return this.http.get<RecipeAudit>(`${this.url}/${id}`);
    }

    getByUser(userId: number): Observable<RecipeAudit[]> {
        return this.http.get<RecipeAudit[]>(`${this.url}/by-user/${userId}`);
    }

    getByRecipe(recipeId: number): Observable<RecipeAudit[]> {
        return this.http.get<RecipeAudit[]>(`${this.url}/by-recipe/${recipeId}`);
    }

    getByDateRange(startDate: string, endDate: string, page = 0, size = 20, sort?: string[]): Observable<RecipeAudit[]> {
        let params = new HttpParams()
            .set('start', startDate)
            .set('end', endDate)
            .set('page', page.toString())
            .set('size', size.toString());
            
        // Agregar ordenamiento si se proporciona
        if (sort && sort.length > 0) {
            sort.forEach(sortParam => {
                params = params.append('sort', sortParam);
            });
        }
            
        return this.http.get<RecipeAudit[]>(`${this.url}/by-date-range`, { params });
    }
}
