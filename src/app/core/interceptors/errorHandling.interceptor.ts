import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { MessageService } from '../services/message.service';

export interface ErrorResponse {
  status: number;
  message: string;
  timestamp: string;
}

export const errorHandlingInterceptor: HttpInterceptorFn = (req, next) => {
  const messageService = inject(MessageService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // No mostrar errores 403 en peticiones GET, ya que pueden deberse a configuración del backend
      // y los componentes manejan estos errores individualmente
      const isGetRequest = req.method === 'GET';
      const isForbidden = error.status === 403;
      
      // No mostrar 401 aquí: el authInterceptor se encarga del logout
      const isUnauthorized = error.status === 401;
      
      // No mostrar 404 en el endpoint de plan actual, ya que es esperado si no hay plan activo
      const isCurrentPlanRequest = req.url.includes('/api/weekly-plans/current');
      const isNotFound = error.status === 404;

      if (!(isGetRequest && isForbidden) && !isUnauthorized && !(isCurrentPlanRequest && isNotFound)) {
        handleError(error, messageService);
      }
      return throwError(() => error);
    })
  );
};

function handleError(error: HttpErrorResponse, messageService: MessageService): void {
  const status = error.status;
  let message = 'Error desconocido';

  const errorResponse: any = parseErrorResponse(error);

  if (Array.isArray(errorResponse)) {
    message = errorResponse.map((e: any) => typeof e === 'string' ? e : (e.message || 'Error desconocido')).join(' • ');
  } else if (errorResponse?.message) {
    message = errorResponse.message;
  } else if (errorResponse?.errors) {
    if (Array.isArray(errorResponse.errors)) {
      message = errorResponse.errors.join(' • ');
    } else {
      message = errorResponse.errors;
    }
  } else if (typeof errorResponse === 'string') {
    message = errorResponse;
  } else {
    message = getDefaultErrorMessage(status);
  }

  if (typeof message === 'string' && message.includes('\n')) {
    message = message.split('\n').filter(m => m.trim().length > 0).join(' • ');
  }

  displayError(status, message, messageService);
}

function parseErrorResponse(error: HttpErrorResponse): any {
  try {
    if (error.error) {
      return error.error;
    }
  } catch (e) {
  }
  return null;
}

function getDefaultErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Solicitud inválida. Verifica los datos ingresados.';
    case 401:
      return 'Credenciales incorrectas o token JWT inválido. Por favor, inicia sesión nuevamente.';
    case 403:
      return 'No tienes permiso para acceder a este recurso.';
    case 404:
      return 'Recurso no encontrado.';
    case 409:
      return 'Conflicto: el registro ha sido modificado por otra operación.';
    case 423:
      return 'Recurso bloqueado. Intenta de nuevo más tarde.';
    case 500:
      return 'Error interno del servidor. Por favor, intenta más tarde.';
    case 502:
      return 'Puerta de enlace defectuosa. El servidor no está disponible.';
    case 503:
      return 'Servicio no disponible. Intenta más tarde.';
    case 0:
      return 'Error de conexión. Verifica tu conexión a internet.';
    default:
      return `Error HTTP ${status}. Por favor, intenta de nuevo.`;
  }
}

function displayError(status: number, message: string, messageService: MessageService): void {
  // Errores de validación y negocio (4xx)
  if (status >= 400 && status < 500) {
    messageService.showError(message);
  }
  // Errores del servidor (5xx)
  else if (status >= 500) {
    messageService.showError(`Error del servidor: ${message}`);
  }
  // Otros errores
  else {
    messageService.showError(message);
  }
}
