import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RecipeAudit } from '../../shared/models/recipe-audit.model';

@Injectable({ providedIn: 'root' })
export class RecipeAuditService {
    private http = inject(HttpClient);
    private url = `${environment.apiUrl}/api/recipe-audits`;

    getAll(): Observable<RecipeAudit[]> {
        return this.http.get<RecipeAudit[]>(this.url);
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

    getByDateRange(startDate: string, endDate: string): Observable<RecipeAudit[]> {
        const params = new HttpParams()
            .set('start', startDate)
            .set('end', endDate);
        return this.http.get<RecipeAudit[]>(`${this.url}/by-date-range`, { params });
    }
}
