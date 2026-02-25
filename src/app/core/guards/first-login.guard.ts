import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Guard that checks if the user is logging in for the first time.
 * If firstLogin is true, it redirects to the change-password page.
 * If firstLogin is false, it allows access to the requested route.
 */
export const firstLoginGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // If not authenticated at all, authGuard will handle it
    if (!authService.isAuthenticated()) {
        return true;
    }

    if (authService.isFirstLogin()) {
        // If they are trying to access change-password, allow them
        if (state.url === '/change-password') {
            return true;
        }
        // Otherwise redirect to change-password
        return router.createUrlTree(['/change-password']);
    }

    // If it's NOT their first login but they try to access change-password,
    // redirect them away to their respective home page
    if (state.url === '/change-password') {
        const role = authService.getRole();
        if (role === 'ADMIN') {
            return router.createUrlTree(['/admin-panel']);
        } else {
            return router.createUrlTree(['/welcome']);
        }
    }

    return true;
};
