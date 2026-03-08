import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProductAudit } from '../../shared/models/product-audit.model';

export interface AuditFilters {
  productName?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductAuditService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/inventory-audits`;

  /**
   * Obtener auditorías con filtros opcionales combinados
   * @param filters - Filtros opcionales: productName, type, startDate, endDate
   * @param page - Número de página (default: 0)
   * @param size - Elementos por página (default: 20)
   * @param sort - Array de parámetros de ordenamiento (ej: ['movementDate,desc'])
   */
  getAll(filters?: AuditFilters, page = 0, size = 20, sort?: string[]): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    // Aplicar filtros opcionales
    if (filters) {
      if (filters.productName && filters.productName.trim()) {
        params = params.set('productName', filters.productName.trim());
      }
      if (filters.type && filters.type.trim()) {
        params = params.set('type', filters.type.trim());
      }
      if (filters.startDate && filters.startDate.trim()) {
        params = params.set('startDate', filters.startDate.trim());
      }
      if (filters.endDate && filters.endDate.trim()) {
        params = params.set('endDate', filters.endDate.trim());
      }
    }
    
    // Aplicar ordenamiento
    if (sort && sort.length > 0) {
      sort.forEach(sortParam => {
        params = params.append('sort', sortParam);
      });
    }
    
    return this.http.get<any>(this.url, { params });
  }

  getById(id: number): Observable<ProductAudit> {
    return this.http.get<ProductAudit>(`${this.url}/${id}`);
  }
}
