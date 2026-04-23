import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { Role, hasPermission, getUrlPattern } from '../../shared/models/role-permissions';
import { environment } from '../../../environments/environment';
import { StorageService } from '../services/storage.service';

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

  // Verificar permisos solo para peticiones API (excluyendo auth y /api/users/me)
  if (isApiRequest && !isAuthRequest && !requestUrl.includes('/api/users/me') && userRole) {
    const method = req.method;
    const apiPath = isRelativeApiRequest
      ? requestUrl.split('?')[0]
      : requestUrl.replace(environment.apiUrl, '').split('?')[0];

    if (isAllowedUserScopedRequest(method, apiPath, userRole, storageService)) {
      return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) {
            resetSessionAndRedirectToLogin(storageService);
          } else if (error.status === 403) {
            console.error('Acceso denegado:', error.error?.message);
          }
          return throwError(() => error);
        })
      );
    }

    const urlPattern = getUrlPattern(apiPath);

    if (!hasPermission(userRole, method, urlPattern)) {
      console.error('[AUTH INTERCEPTOR] FORBIDDEN:', { method, url: req.url, pattern: urlPattern, role: userRole });
      return throwError(() => new HttpErrorResponse({
        error: { message: `No tienes permisos para realizar esta acción. Rol: ${userRole}` },
        status: 403,
        statusText: 'Forbidden'
      }));
    }
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // 401: Token inválido/expirado - logout automático
        resetSessionAndRedirectToLogin(storageService);
      } else if (error.status === 403) {
        console.error('Acceso denegado:', error.error?.message);
      }
      return throwError(() => error);
    })
  );
};
