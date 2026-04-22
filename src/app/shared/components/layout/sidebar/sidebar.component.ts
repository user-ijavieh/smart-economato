import { Component, Input, Output, EventEmitter, inject, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { Subscription, filter } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  section?: string; // optional section header to render before this item
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
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

  public isOpen: boolean = window.innerWidth > 800;
  public isMobile: boolean = window.innerWidth <= 800;
  public isAdminRoute: boolean = false;

  @Input() public mobileOpen: boolean = false;
  @Output() sidebarToggled = new EventEmitter<boolean>();
  @Output() logoutClicked = new EventEmitter<void>();
  @Output() mobileMenuClosed = new EventEmitter<void>();

  // Items para la vista normal
  private defaultNavItems: NavItem[] = [
    { label: 'SIDEBAR.GENERAL_VIEW', route: '/welcome', icon: 'home' },
    { label: 'SIDEBAR.INVENTORY', route: '/inventario', icon: 'inventory' },
    { label: 'SIDEBAR.RECIPES', route: '/recipes', icon: 'book' },
    { label: 'SIDEBAR.WEEKLY_PLANS', route: '/weekly-plans', icon: 'calendar' },
    { label: 'SIDEBAR.ORDERS', route: '/orders', icon: 'cart' },
    { label: 'SIDEBAR.RECEPTION', route: '/reception', icon: 'truck' },
    { label: 'SIDEBAR.INCIDENTS', route: '/incidents', icon: 'alert' },
    { label: 'SIDEBAR.AI_CHAT', route: '/ai-chat', icon: 'chat' },
    { label: 'SIDEBAR.PROFILE', route: '/profile', icon: 'person' }
  ];

  // Items para la vista admin
  private adminNavItems: NavItem[] = [
    { label: 'SIDEBAR.DASHBOARD', route: '/admin-panel/dashboard', icon: 'dashboard' },
    { label: 'SIDEBAR.GENERAL_VIEW', route: '/welcome', icon: 'home' },
    { label: 'SIDEBAR.ORDERS', route: '/admin-panel/orders', icon: 'cart', section: 'SIDEBAR.SECTIONS.OPERATIONS' },
    { label: 'SIDEBAR.RECEPTION', route: '/reception', icon: 'truck' },
    { label: 'SIDEBAR.WEEKLY_PLANS', route: '/admin-panel/weekly-plans', icon: 'calendar' },
    { label: 'SIDEBAR.KITCHEN', route: '/admin-panel/kitchen', icon: 'kitchen' },
    { label: 'SIDEBAR.INCIDENTS', route: '/admin-panel/incidents', icon: 'alert' },
    { label: 'SIDEBAR.INVENTORY', route: '/admin-panel/stock', icon: 'inventory', section: 'SIDEBAR.SECTIONS.INVENTORY' },
    { label: 'SIDEBAR.BATCHES', route: '/admin-panel/batches', icon: 'batches' },
    { label: 'SIDEBAR.PRODUCTS', route: '/admin-panel/products', icon: 'products' },
    { label: 'SIDEBAR.RECIPES', route: '/admin-panel/recipes', icon: 'menu_book' },
    { label: 'SIDEBAR.MASTER_DATA', route: '/admin-panel/master-data', icon: 'database', section: 'SIDEBAR.SECTIONS.MANAGEMENT' },
    { label: 'SIDEBAR.USERS', route: '/admin-panel/users', icon: 'people' },
    { label: 'SIDEBAR.NOTIFICATIONS', route: '/admin-panel/notifications', icon: 'notifications' },
    { label: 'SIDEBAR.SETTINGS', route: '/admin-panel/settings', icon: 'settings' },
    { label: 'SIDEBAR.TRACEABILITY', route: '/admin-panel/traceability', icon: 'shield', section: 'SIDEBAR.SECTIONS.TRACEABILITY' }
  ];

  ngOnInit(): void {
    if (this.isMobile) {
      this.isOpen = false;
    }

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
      return this.defaultNavItems.filter(item => 
        item.label !== 'SIDEBAR.WEEKLY_PLANS' && 
        item.label !== 'SIDEBAR.INCIDENTS' && 
        item.label !== 'SIDEBAR.PROFILE'
      );
    }
    if (userRole === 'USER') {
      return this.defaultNavItems.filter(item =>
        item.label !== 'SIDEBAR.RECEPTION' &&
        item.label !== 'SIDEBAR.ORDERS' &&
        item.label !== 'SIDEBAR.PROFILE' &&
        item.label !== 'SIDEBAR.INCIDENTS' &&
        item.label !== 'SIDEBAR.AI_CHAT' &&
        item.label !== 'SIDEBAR.WEEKLY_PLANS'
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

  @HostListener('window:resize')
  onWindowResize(): void {
    this.isMobile = window.innerWidth <= 800;
    if (this.isMobile) {
      this.isOpen = false;
    }
  }

  closeMobileMenu(): void {
    if (this.isMobile) {
      this.mobileMenuClosed.emit();
    }
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
