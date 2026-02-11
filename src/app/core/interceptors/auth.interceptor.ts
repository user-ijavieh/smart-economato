import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('auth_token');

  // Añadir token a todas las requests (excepto login/register)
  if (token && !req.url.includes('/api/auth/login') && !req.url.includes('/api/auth/register')) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Solo eliminar token y redirigir si es un error de autenticación en endpoints críticos
      // o si el mensaje del error indica que el token es inválido
      if (error.status === 401) {
        const isAuthEndpoint = req.url.includes('/api/auth/');
        const errorMessage = error.error?.message || '';
        const isTokenInvalid = errorMessage.toLowerCase().includes('token') || 
                               errorMessage.toLowerCase().includes('expired') ||
                               errorMessage.toLowerCase().includes('invalid');
        
        // Solo limpiar sesión si es realmente un problema de token inválido
        if (isAuthEndpoint || isTokenInvalid) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_role');
          localStorage.removeItem('user_name');
          router.navigate(['/login']);
        }
      }
      return throwError(() => error);
    })
  );
};
