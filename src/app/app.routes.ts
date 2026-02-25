import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { firstLoginGuard } from './core/guards/first-login.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/general/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'change-password',
    loadComponent: () =>
      import('./features/general/change-password/change-password.component').then(m => m.ChangePasswordComponent),
    canActivate: [authGuard, firstLoginGuard]
  },
  {
    path: 'welcome',
    loadComponent: () =>
      import('./features/general/welcome/welcome.component').then(m => m.WelcomeComponent),
    canActivate: [authGuard, firstLoginGuard]
  },
  {
    path: '',
    loadComponent: () =>
      import('./shared/components/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard, firstLoginGuard],
    children: [
      {
        path: 'admin-panel',
        loadComponent: () =>
          import('./features/admin/admin-panel/admin-panel.component').then(m => m.AdminPanelComponent)
      },
      {
        path: 'admin-panel/users',
        loadComponent: () =>
          import('./features/admin/users-management/users-management.component').then(m => m.UsersManagementComponent)
      },
      {
        path: 'admin-panel/recipes',
        loadComponent: () =>
          import('./features/admin/recipes-management/recipes-management.component').then(m => m.RecipesManagementComponent)
      },
      {
        path: 'inventario',
        loadComponent: () =>
          import('./features/general/inventory/inventory.component').then(m => m.InventoryComponent)
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/general/orders/orders.component').then(m => m.OrdersComponent)
      },
      {
        path: 'reception',
        loadComponent: () =>
          import('./features/general/reception/reception.component').then(m => m.ReceptionComponent)
      },
      {
        path: 'recipes',
        loadComponent: () =>
          import('./features/general/recipes/recipes.component').then(m => m.RecipesComponent)
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/general/profile/profile.component').then(m => m.ProfileComponent)
      },
      {
        path: '',
        redirectTo: '/welcome',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];
