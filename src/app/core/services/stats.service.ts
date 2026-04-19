import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { HttpQueryCacheService } from './http-query-cache.service';

export interface RecipeStats {
    totalRecipes: number;
    recipesWithAllergens: number;
    recipesWithoutAllergens: number;
    averagePrice: number;
}

export interface ProductStats {
    totalProducts: number;
    totalInventoryValue: number;
    averagePrice: number;
}

@Injectable({ providedIn: 'root' })
export class StatsService {
    private http = inject(HttpClient);
    private cache = inject(HttpQueryCacheService);
    private url = `${environment.apiUrl}/api/stats`;

    getRecipeStats(): Observable<RecipeStats> {
        return this.cache.getOrFetch('recipe', 'stats:recipes', () => this.http.get<RecipeStats>(`${this.url}/recipes`));
    }

    getProductStats(): Observable<ProductStats> {
        return this.cache.getOrFetch('product', 'stats:products', () => this.http.get<ProductStats>(`${this.url}/products`));
    }

    getRecipesWithAllergensCount(): Observable<{ count: number }> {
        return this.cache.getOrFetch(
            'recipe',
            'stats:recipesWithAllergensCount',
            () => this.http.get<{ count: number }>(`${this.url}/recipes/with-allergens/count`)
        );
    }

    getRecipesWithoutAllergensCount(): Observable<{ count: number }> {
        return this.cache.getOrFetch(
            'recipe',
            'stats:recipesWithoutAllergensCount',
            () => this.http.get<{ count: number }>(`${this.url}/recipes/without-allergens/count`)
        );
    }

    getAverageCost(): Observable<{ averageCost: number }> {
        return this.cache.getOrFetch(
            'recipe',
            'stats:averageCost',
            () => this.http.get<{ averageCost: number }>(`${this.url}/recipes/average-cost`)
        );
    }
}
