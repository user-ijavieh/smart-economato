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
        canActivate: [roleGuard('ADMIN')],
        data: { animation: 2 }
      },
      {
        path: 'admin-panel/recipes',
        loadComponent: () =>
          import('./features/admin/recipes-management/recipes-management.component').then(m => m.RecipesManagementComponent),
        canActivate: [roleGuard('ADMIN')],
        data: { animation: 3 }
      },
      {
        path: 'admin-panel/products',
        loadComponent: () =>
          import('./features/admin/products-management/products-management.component').then(m => m.ProductsManagementComponent),
        canActivate: [roleGuard('ADMIN')],
        data: { animation: 4 }
      },
      {
        path: 'admin-panel/master-data',
        loadComponent: () =>
          import('./features/admin/allergens-management/allergens-management.component').then(m => m.AllergensManagementComponent),
        canActivate: [roleGuard('ADMIN')],
        data: { animation: 6 }
      },
      {
        path: 'admin-panel/kitchen',
        loadComponent: () =>
          import('./features/admin/kitchen-management/kitchen-management.component').then(m => m.KitchenManagementComponent),
        canActivate: [roleGuard('ADMIN')],
        data: { animation: 7 }
      },
      {
        path: 'admin-panel/stock',
        loadComponent: () =>
          import('./features/admin/stock-management/stock-management.component').then(m => m.StockManagementComponent),
        canActivate: [roleGuard('ADMIN')],
        data: { animation: 8 }
      },
      {
        path: 'admin-panel/orders',
        loadComponent: () =>
          import('./features/admin/orders-management/orders-management.component').then(m => m.OrdersManagementComponent),
        canActivate: [roleGuard('ADMIN')],
        data: { animation: 9 }
      },
      {
        path: 'admin-panel/notifications',
        loadComponent: () =>
          import('./features/admin/notifications-management/notifications-management.component').then(m => m.NotificationsManagementComponent),
        canActivate: [roleGuard('ADMIN')],
        data: { animation: 11 }
      },
      {
        path: 'admin-panel/incidents',
        loadComponent: () =>
          import('./features/admin/incidents/incidents.component').then(m => m.IncidentsComponent),
        canActivate: [roleGuard('ADMIN')],
        data: { animation: 12 }
      },
      {
        path: 'admin-panel/traceability',
        loadComponent: () =>
          import('./features/admin/traceability-management/traceability-management.component').then(m => m.TraceabilityManagementComponent),
        canActivate: [roleGuard('ADMIN')],
        data: { animation: 10 }
      },
      {
        path: 'admin-panel/settings',
        loadComponent: () =>
          import('./features/admin/settings-management/settings-management.component').then(m => m.SettingsManagementComponent),
        canActivate: [roleGuard('ADMIN')],
        data: { animation: 13 }
      },
      {
        path: 'admin-panel/batches',
        loadComponent: () =>
          import('./features/admin/batches-management/batches-management.component').then(m => m.BatchesManagementComponent),
        canActivate: [roleGuard('ADMIN')],
        data: { animation: 5 }
      },

      {
        path: 'inventario',
        loadComponent: () =>
          import('./features/general/inventory/inventory.component').then(m => m.InventoryComponent),
        data: { animation: 21 }
      },
      {
        path: 'recipes',
        loadComponent: () =>
          import('./features/general/recipes/recipes.component').then(m => m.RecipesComponent),
        data: { animation: 22 }
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/general/orders/orders.component').then(m => m.OrdersComponent),
        canActivate: [roleGuard('ADMIN', 'CHEF')],
        data: { animation: 23 }
      },
      {
        path: 'reception',
        loadComponent: () =>
          import('./features/general/reception/reception.component').then(m => m.ReceptionComponent),
        canActivate: [roleGuard('ADMIN', 'CHEF')],
        data: { animation: 24 }
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/general/profile/profile.component').then(m => m.ProfileComponent),
        canActivate: [roleGuard('ADMIN', 'CHEF', 'ELEVATED')],
        data: { animation: 25 }
      },
      {
        path: 'incidents',
        loadComponent: () =>
          import('./features/admin/incidents/incidents.component').then(m => m.IncidentsComponent),
        canActivate: [roleGuard('ADMIN')],
        data: { animation: 26 }
      },
      {
        path: 'ai-chat',
        loadComponent: () =>
          import('./features/general/ai-chat/ai-chat.component').then(m => m.AiChatComponent),
        canActivate: [roleGuard('ADMIN', 'CHEF', 'ELEVATED')],
        data: { animation: 27 }
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
