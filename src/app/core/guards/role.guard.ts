import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Role } from '../../shared/models/role-permissions';

/**
 * Guard general que combina:
 * 1. Verificación de primer login → redirige a /change-password
 * 2. Control de acceso por rol → redirige a /welcome si no tiene permiso
 *
 * Uso en rutas:
 *   canActivate: [roleGuard()]               → solo verifica firstLogin (cualquier rol)
 *   canActivate: [roleGuard('ADMIN')]         → solo ADMIN
 *   canActivate: [roleGuard('ADMIN', 'CHEF')] → ADMIN y CHEF
 */
export function roleGuard(...allowedRoles: Role[]): CanActivateFn {
    return (route, state) => {
        const authService = inject(AuthService);
        const router = inject(Router);

        if (authService.isFirstLogin()) {
            if (state.url === '/change-password') return true;
            return router.createUrlTree(['/change-password']);
        }

        if (state.url === '/change-password') {
            const role = authService.getRole();
            return router.createUrlTree([role === 'ADMIN' ? '/admin-panel' : '/welcome']);
        }

        if (allowedRoles.length > 0) {
            const userRole = authService.getRole() as Role;
            if (!userRole || !allowedRoles.includes(userRole)) {
                return router.createUrlTree(['/welcome']);
            }
        }

        return true;
    };
}
