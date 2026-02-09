import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { Role, hasPermission, getUrlPattern } from '../../shared/models/role-permissions';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('auth_token');
  const userRole = localStorage.getItem('user_role') as Role;

  // Verificar si es una petición a la API que necesita verificación de permisos
  const isApiRequest = req.url.includes(environment.apiUrl + '/api/');
  const isAuthRequest = req.url.includes('/api/auth/');

  // Añadir token a todas las requests (excepto login/register)
  if (token && !req.url.includes('/api/auth/login') && !req.url.includes('/api/auth/register')) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // Verificar permisos solo para peticiones API (excluyendo auth)
  if (isApiRequest && !isAuthRequest && userRole) {
    const method = req.method;
    const apiPath = req.url.replace(environment.apiUrl, '');
    const urlPattern = getUrlPattern(apiPath);

    if (!hasPermission(userRole, method, urlPattern)) {
      // Si no tiene permisos, devolver error 403
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
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_role');
        router.navigate(['/login']);
      } else if (error.status === 403) {
        console.error('Acceso denegado:', error.error?.message);
        // Opcional: mostrar un mensaje al usuario o redirigir
      }
      return throwError(() => error);
    })
  );
};
