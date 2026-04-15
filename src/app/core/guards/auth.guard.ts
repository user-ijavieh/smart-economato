import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Verificar si hay token y si está autenticado
  if (authService.isAuthenticated()) {
    // El token existe, pero podría estar expirado
    // Los interceptores manejarán los 401 cuando haga peticiones
    return true;
  }

  // No hay token o no está autenticado - ir al login
  router.navigate(['/login'], {
    queryParams: { returnUrl: state.url }
  });
  return false;
};
