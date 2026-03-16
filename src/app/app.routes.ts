import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

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
    canActivate: [authGuard, roleGuard()]
  },
  {
    path: 'welcome',
    loadComponent: () =>
      import('./features/general/welcome/welcome.component').then(m => m.WelcomeComponent),
    canActivate: [authGuard, roleGuard()]
  },
  {
    path: '',
    loadComponent: () =>
      import('./shared/components/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard, roleGuard()],
    children: [
      {
        path: 'admin-panel',
        loadComponent: () =>
          import('./features/admin/admin-panel/admin-panel.component').then(m => m.AdminPanelComponent),
        canActivate: [roleGuard('ADMIN')]
      },
      {
        path: 'admin-panel/users',
        loadComponent: () =>
          import('./features/admin/users-management/users-management.component').then(m => m.UsersManagementComponent),
        canActivate: [roleGuard('ADMIN')]
      },
      {
        path: 'admin-panel/recipes',
        loadComponent: () =>
          import('./features/admin/recipes-management/recipes-management.component').then(m => m.RecipesManagementComponent),
        canActivate: [roleGuard('ADMIN')]
      },
      {
        path: 'admin-panel/products',
        loadComponent: () =>
          import('./features/admin/products-management/products-management.component').then(m => m.ProductsManagementComponent),
        canActivate: [roleGuard('ADMIN')]
      },
      {
        path: 'admin-panel/master-data',
        loadComponent: () =>
          import('./features/admin/allergens-management/allergens-management.component').then(m => m.AllergensManagementComponent),
        canActivate: [roleGuard('ADMIN')]
      },
      {
        path: 'admin-panel/kitchen',
        loadComponent: () =>
          import('./features/admin/kitchen-management/kitchen-management.component').then(m => m.KitchenManagementComponent),
        canActivate: [roleGuard('ADMIN')]
      },
      {
        path: 'admin-panel/stock',
        loadComponent: () =>
          import('./features/admin/stock-management/stock-management.component').then(m => m.StockManagementComponent),
        canActivate: [roleGuard('ADMIN')]
      },
      {
        path: 'admin-panel/orders',
        loadComponent: () =>
          import('./features/admin/orders-management/orders-management.component').then(m => m.OrdersManagementComponent),
        canActivate: [roleGuard('ADMIN')]
      },
      {
        path: 'admin-panel/traceability',
        loadComponent: () =>
          import('./features/admin/traceability-management/traceability-management.component').then(m => m.TraceabilityManagementComponent),
        canActivate: [roleGuard('ADMIN')]
      },
      {
        path: 'admin-panel/batches',
        loadComponent: () =>
          import('./features/admin/batches-management/batches-management.component').then(m => m.BatchesManagementComponent),
        canActivate: [roleGuard('ADMIN')]
      },

      {
        path: 'inventario',
        loadComponent: () =>
          import('./features/general/inventory/inventory.component').then(m => m.InventoryComponent)
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/general/orders/orders.component').then(m => m.OrdersComponent),
        canActivate: [roleGuard('ADMIN', 'CHEF')]
      },
      {
        path: 'reception',
        loadComponent: () =>
          import('./features/general/reception/reception.component').then(m => m.ReceptionComponent),
        canActivate: [roleGuard('ADMIN', 'CHEF')]
      },


      {
        path: 'recipes',
        loadComponent: () =>
          import('./features/general/recipes/recipes.component').then(m => m.RecipesComponent)
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/general/profile/profile.component').then(m => m.ProfileComponent),
        canActivate: [roleGuard('ADMIN', 'CHEF')]
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
