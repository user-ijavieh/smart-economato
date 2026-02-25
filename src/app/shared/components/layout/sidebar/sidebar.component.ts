import { Component, Input, Output, EventEmitter, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { Subscription, filter } from 'rxjs';

interface NavItem {
  label: string;
  route: string;
  icon: string;
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
  private router = inject(Router);
  private routerSub!: Subscription;

  isOpen = false;
  isAdminRoute = false;

  @Output() sidebarToggled = new EventEmitter<boolean>();
  @Output() logoutClicked = new EventEmitter<void>();

  // Items para la vista normal
  private defaultNavItems: NavItem[] = [
    { label: 'Inicio', route: '/welcome', icon: 'home' },
    { label: 'Inventario', route: '/inventario', icon: 'inventory' },
    { label: 'Recetas', route: '/recipes', icon: 'book' },
    { label: 'Recepción', route: '/reception', icon: 'truck' },
    { label: 'Pedidos', route: '/orders', icon: 'cart' },
    { label: 'Perfil', route: '/profile', icon: 'person' }
  ];

  // Items para la vista admin
  private adminNavItems: NavItem[] = [
    { label: 'Vista General', route: '/welcome', icon: 'home' },
    { label: 'Usuarios', route: '/admin-panel/users', icon: 'people' },
    { label: 'Recetas', route: '/admin-panel/recipes', icon: 'menu_book' },
    { label: 'Datos Maestros', route: '/admin-panel/master-data/allergens', icon: 'database' },
  ];

  ngOnInit(): void {
    this.checkRoute(this.router.url);
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
  }

  private checkRoute(url: string): void {
    this.isAdminRoute = url.startsWith('/admin-panel');
  }

  get filteredNavItems(): NavItem[] {
    if (this.isAdminRoute) {
      return this.adminNavItems;
    }

    const userRole = this.getUserRole();
    if (userRole === 'USER') {
      return this.defaultNavItems.filter(item =>
        item.label !== 'Recepción' && item.label !== 'Pedidos'
      );
    }
    return this.defaultNavItems;
  }

  toggleSidebar(): void {
    this.isOpen = !this.isOpen;
    this.sidebarToggled.emit(this.isOpen);
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
