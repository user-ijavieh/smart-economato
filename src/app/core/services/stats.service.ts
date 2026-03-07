import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RecipeStats {
    totalRecipes: number;
    recipesWithAllergens: number;
    recipesWithoutAllergens: number;
    averagePrice: number;
}

@Injectable({ providedIn: 'root' })
export class StatsService {
    private http = inject(HttpClient);
    private url = `${environment.apiUrl}/api/stats`;

    getRecipeStats(): Observable<RecipeStats> {
        return this.http.get<RecipeStats>(`${this.url}/recipes`);
    }

    getRecipesWithAllergensCount(): Observable<{ count: number }> {
        return this.http.get<{ count: number }>(`${this.url}/recipes/with-allergens/count`);
    }

    getRecipesWithoutAllergensCount(): Observable<{ count: number }> {
        return this.http.get<{ count: number }>(`${this.url}/recipes/without-allergens/count`);
    }

    getAverageCost(): Observable<{ averageCost: number }> {
        return this.http.get<{ averageCost: number }>(`${this.url}/recipes/average-cost`);
    }
}
