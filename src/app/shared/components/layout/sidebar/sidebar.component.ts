import { Component, Input, Output, EventEmitter, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { Subscription, filter } from 'rxjs';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  section?: string; // optional section header to render before this item
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private routerSub!: Subscription;
  private roleSub!: Subscription;

  isOpen = window.innerWidth > 800;
  isAdminRoute = false;

  @Output() sidebarToggled = new EventEmitter<boolean>();
  @Output() logoutClicked = new EventEmitter<void>();

  // Items para la vista normal
  private defaultNavItems: NavItem[] = [
    { label: 'Inicio', route: '/welcome', icon: 'home' },
    { label: 'Inventario', route: '/inventario', icon: 'inventory' },
    { label: 'Recetas', route: '/recipes', icon: 'book' },
    { label: 'Plan Semanal', route: '/weekly-plans', icon: 'calendar' },
    { label: 'Pedidos', route: '/orders', icon: 'cart' },
    { label: 'Recepción', route: '/reception', icon: 'truck' },
    { label: 'Incidencias', route: '/incidents', icon: 'alert' },
    { label: 'Chat IA', route: '/ai-chat', icon: 'chat' },
    { label: 'Perfil', route: '/profile', icon: 'person' }
  ];

  // Items para la vista admin
  private adminNavItems: NavItem[] = [
    { label: 'Vista General', route: '/welcome', icon: 'home' },
    { label: 'Dashboard', route: '/admin-panel/dashboard', icon: 'dashboard' },
    { label: 'Órdenes', route: '/admin-panel/orders', icon: 'cart', section: 'OPERACIONES' },
    { label: 'Planes Semanales', route: '/admin-panel/weekly-plans', icon: 'calendar' },
    { label: 'Cocina', route: '/admin-panel/kitchen', icon: 'kitchen' },
    { label: 'Incidencias', route: '/admin-panel/incidents', icon: 'alert' },
    { label: 'Stock', route: '/admin-panel/stock', icon: 'inventory', section: 'INVENTARIO' },
    { label: 'Lotes', route: '/admin-panel/batches', icon: 'batches' },
    { label: 'Productos', route: '/admin-panel/products', icon: 'inventory' },
    { label: 'Recetas', route: '/admin-panel/recipes', icon: 'menu_book' },
    { label: 'Datos Maestros', route: '/admin-panel/master-data', icon: 'database', section: 'GESTIÓN' },
    { label: 'Gestión de alumnos', route: '/admin-panel/users', icon: 'people' },
    { label: 'Notificaciones', route: '/admin-panel/notifications', icon: 'notifications' },
    { label: 'Configuraciones', route: '/admin-panel/settings', icon: 'settings' },
    { label: 'Trazabilidad', route: '/admin-panel/traceability', icon: 'shield', section: 'TRAZABILIDAD' }
  ];

  ngOnInit(): void {
    this.authService.syncSessionProfile().subscribe({
      next: () => this.cdr.markForCheck(),
      error: () => this.cdr.markForCheck()
    });

    this.checkRoute(this.router.url);
    this.roleSub = this.authService.roleChanges$.subscribe(() => {
      this.cdr.markForCheck();
    });

    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.checkRoute((event as NavigationEnd).urlAfterRedirects);
      });
  }

  ngOnDestroy(): void {
    if (this.routerSub) {
      this.routerSub.unsubscribe();
    }
    if (this.roleSub) {
      this.roleSub.unsubscribe();
    }
  }

  private checkRoute(url: string): void {
    this.isAdminRoute = url.startsWith('/admin-panel');
  }

  get filteredNavItems(): NavItem[] {
    if (this.isAdminRoute) {
      return this.adminNavItems;
    }

    const userRole = this.getUserRole();
    if (userRole === 'ADMIN') {
      return this.defaultNavItems.filter(item => item.label !== 'Plan Semanal' && item.label !== 'Perfil');
    }
    if (userRole === 'USER') {
      return this.defaultNavItems.filter(item =>
        item.label !== 'Recepción' &&
        item.label !== 'Pedidos' &&
        item.label !== 'Perfil' &&
        item.label !== 'Incidencias' &&
        item.label !== 'Chat IA' &&
        item.label !== 'Plan Semanal'
      );
    }
    if (userRole === 'CHEF' || userRole === 'ELEVATED') {
      return this.defaultNavItems;
    }
    return this.defaultNavItems;
  }

  toggleSidebar(): void {
    this.isOpen = !this.isOpen;
    this.sidebarToggled.emit(this.isOpen);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  isDarkMode(): boolean {
    return this.themeService.isDark();
  }

  onLogout(): void {
    this.logoutClicked.emit();
  }

  getUserRole(): string | null {
    return this.authService.getRole();
  }

  getUserToken(): string | null {
    return this.authService.getToken();
  }

  getUserName(): string | null {
    const name = this.authService.getName();
    return name || 'Admin';
  }

  getUserInitials(): string {
    const role = this.getUserRole();
    if (!role) return 'U';
    return role.charAt(0).toUpperCase();
  }

  isAdmin(): boolean {
    return this.getUserRole() === 'ADMIN';
  }
}
