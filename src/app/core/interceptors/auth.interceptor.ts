import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { Role, hasPermission, getUrlPattern } from '../../shared/models/role-permissions';
import { environment } from '../../../environments/environment';
import { StorageService } from '../services/storage.service';
import { LoggerService } from '../services/logger.service';

const SESSION_KEYS_TO_CLEAR = [
  'auth_token',
  'user_role',
  'user_name',
  'user_username',
  'user_id',
  'first_login',
  'ai_last_chat_id'
];

function resetSessionAndRedirectToLogin(storageService: StorageService): void {
  SESSION_KEYS_TO_CLEAR.forEach(key => storageService.remove(key));

  const currentPath = window.location.pathname;
  if (currentPath !== '/login') {
    window.location.assign('/login');
  }
}

function isAllowedUserScopedRequest(method: string, apiPath: string, userRole: Role, storageService: StorageService): boolean {
  const userIdRaw = storageService.get('user_id');
  const currentUserId = userIdRaw ? Number(userIdRaw) : NaN;

  const userByIdMatch = apiPath.match(/^\/api\/users\/(\d+)$/);
  if (method === 'GET' && userByIdMatch) {
    const requestedId = Number(userByIdMatch[1]);
    return userRole === 'ADMIN' || (!Number.isNaN(currentUserId) && requestedId === currentUserId);
  }

  return false;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storageService = inject(StorageService);
  const logger = inject(LoggerService);
  const token = storageService.get('auth_token');
  const userRole = storageService.get('user_role') as Role;
  const requestUrl = req.url;
  const isRelativeApiRequest = requestUrl.startsWith('/api/');
  const isAbsoluteApiRequest = requestUrl.includes(environment.apiUrl + '/api/');

  // Verificar si es una petición a la API que necesita verificación de permisos
  const isApiRequest = isRelativeApiRequest || isAbsoluteApiRequest;
  const isAuthRequest = requestUrl.includes('/api/auth/');

  // Añadir token a todas las requests (excepto login/register)
  if (token && !req.url.includes('/api/auth/login') && !req.url.includes('/api/auth/register')) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // El interceptor ya no bloquea peticiones basándose en roles del lado del cliente.
  // Solo se encarga de inyectar el token y manejar errores 401/403 del backend.

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // 401: Token inválido/expirado - logout automático
        resetSessionAndRedirectToLogin(storageService);
      } else if (error.status === 403) {
        logger.error('Acceso denegado:', error.error?.message);
      }
      return throwError(() => error);
    })
  );
};
