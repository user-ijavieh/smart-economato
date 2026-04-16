import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  AiConfigurationDto,
  AiKeySaveRequest,
  AiKeyMetadata,
  AiProvider
} from '../../shared/models/ai-config.model';

interface BackendGlobalApiKey {
  provider: string;
  keyHint: string;
  active: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AiConfigurationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/config/ai-keys`;

  getConfiguration(): Observable<AiConfigurationDto> {
    return this.getApiKeys().pipe(
      map(apiKeys => ({
        apiKeys,
        modelConfigs: [],
        operationalLimits: {
          messagesPerMinute: 0,
          maxChatsPerUser: 0,
          maxMessagesPerChat: 0,
          maxApiKeysPerUser: 0,
          circuitBreakerThreshold: 0
        }
      }))
    );
  }

  getApiKeys(): Observable<AiKeyMetadata[]> {
    return this.http
      .get<any[]>(`${this.baseUrl}/`)
      .pipe(
        map(keys => keys.map(key => this.toUiModel(key))),
        catchError(error => this.handleError(error))
      );
  }

  saveApiKey(request: AiKeySaveRequest): Observable<AiKeyMetadata> {
    return this.http
      .put<any>(`${this.baseUrl}/`, request)
      .pipe(
        catchError(() => this.http.post<any>(`${this.baseUrl}/`, request)),
        map(key => this.toUiModel(key)),
        catchError(error => this.handleError(error))
      );
  }

  deleteApiKey(provider: AiProvider): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${provider}`).pipe(
      catchError(error => this.handleError(error))
    );
  }

  private toUiModel(payload: any): AiKeyMetadata {
    return {
      provider: payload.provider as AiProvider,
      keyPreview: payload.keyHint || '••••••••••',
      enabled: Boolean(payload.active),
      lastUpdatedAt: this.toIsoString(payload.createdAt),
      lastUpdatedBy: undefined
    };
  }

  private toIsoString(dateValue: any): string {
    if (!dateValue) {
      return new Date().toISOString();
    }
    // Si es un array (Java LocalDateTime: [año, mes, día, hora, min, seg, nanos])
    if (Array.isArray(dateValue)) {
      const [year, month, day, hour, min, sec] = dateValue;
      return new Date(year, month - 1, day, hour, min, sec).toISOString();
    }
    // Si es un string ISO ya
    if (typeof dateValue === 'string') {
      return dateValue;
    }
    // Si es un objeto Date
    if (dateValue instanceof Date) {
      return dateValue.toISOString();
    }
    // Fallback
    return new Date(dateValue).toISOString();
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'Error en configuración de IA';

    if (error?.status === 200) {
      errorMessage = 'Respuesta inválida del backend (HTTP 200). Revisa el formato JSON devuelto por el servicio.';
    } else if (error?.status === 400) {
      errorMessage = 'Solicitud inválida al guardar la clave de IA.';
    } else if (error?.status === 401) {
      errorMessage = 'No autorizado. Inicia sesión nuevamente.';
    } else if (error?.status === 404) {
      errorMessage = 'No se encontró la configuración de IA.';
    } else if (error?.status === 422) {
      errorMessage = 'La configuración de IA no es válida.';
    } else if (error?.name === 'TimeoutError') {
      errorMessage = 'Tiempo de espera agotado. Reintenta.';
    }

    return new Observable(observer => {
      observer.error(new Error(errorMessage));
    });
  }
}
