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
      handleError(error, messageService);
      return throwError(() => error);
    })
  );
};

function handleError(error: HttpErrorResponse, messageService: MessageService): void {
  const status = error.status;
  let message = 'Error desconocido';

  // Intenta parsear la respuesta del backend
  const errorResponse: ErrorResponse | null = parseErrorResponse(error);

  // Si hay mensaje personalizado del backend, usarlo; sino, usar mensaje por defecto
  if (errorResponse?.message) {
    message = errorResponse.message;
  } else {
    message = getDefaultErrorMessage(status);
  }

  // Mostrar el error según su severidad
  displayError(status, message, messageService);
}

function parseErrorResponse(error: HttpErrorResponse): ErrorResponse | null {
  try {
    if (error.error && typeof error.error === 'object') {
      return error.error as ErrorResponse;
    }
  } catch (e) {
    // Si no se puede parsear, continuará con el manejo por defecto
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
