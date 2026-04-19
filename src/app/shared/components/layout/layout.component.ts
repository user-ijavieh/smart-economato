import { Component, inject, HostListener, ViewChild, ChangeDetectionStrategy, signal, DestroyRef } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule, RouterOutlet, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MessageService, Toast } from '../../../core/services/message.service';
import { SidebarComponent } from './sidebar/sidebar.component';
import { ThemeService } from '../../../core/services/theme.service';
import { BaseModalComponent } from '../base-modal/base-modal.component';
import { slideInAnimation } from '../../animations/route-animations';
import { NotificationService, SessionNotification } from '../../../core/services/notification.service';
import { PresenceTrackingService } from '../../../core/services/presence-tracking.service';
import { HttpQueryCacheService } from '../../../core/services/http-query-cache.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [AsyncPipe, RouterModule, SidebarComponent, BaseModalComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
  animations: [slideInAnimation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LayoutComponent {
  private authService = inject(AuthService);
  public messageService = inject(MessageService);
  private router = inject(Router);
  private themeService = inject(ThemeService);
  private notificationService = inject(NotificationService);
  private presenceTrackingService = inject(PresenceTrackingService);
  private httpQueryCacheService = inject(HttpQueryCacheService);
  private destroyRef = inject(DestroyRef);

  @ViewChild(SidebarComponent) sidebar!: SidebarComponent;

  sidebarOpen = window.innerWidth > 800;
  mobileMenuOpen = false;
  isMobile = window.innerWidth <= 800;
  showLogoutModal = false;
  showClearCacheModal = false;

  readonly notifications$ = this.notificationService.notifications$;
  readonly unreadCount$ = this.notificationService.unreadCount$;
  readonly isNotificationPanelOpen = signal(false);
  readonly isNotificationPanelRendered = signal(false);
  readonly isNotificationPanelClosing = signal(false);
  readonly notificationPulse = signal(false);
  readonly showUtilities = signal<boolean>(localStorage.getItem('layout_utilities_visible') !== 'false');

  private notificationCloseTimer?: ReturnType<typeof setTimeout>;

  isAuthenticated$ = this.authService.authStatus$;

  constructor() {
    this.presenceTrackingService.initialize();

    this.notificationService.incoming$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.notificationPulse.set(true);
        setTimeout(() => this.notificationPulse.set(false), 700);
      });
  }

  // Cache para evitar crear nuevos objetos en cada detección de cambios
  private isMobileAnimation = window.innerWidth <= 768;
  private mobileAnimParams = {
    enterTransform: 'translateX(100%)',
    leaveTransform: 'translateX(-10%)',
    enterTransformDec: 'translateX(-100%)',
    leaveTransformDec: 'translateX(10%)'
  };
  private desktopAnimParams = {
    enterTransform: 'translateY(100%)',
    leaveTransform: 'translateY(-10%)',
    enterTransformDec: 'translateY(-100%)',
    leaveTransformDec: 'translateY(10%)'
  };

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault(); // Evitamos scroll de la página si existiera
      // ArrowUp va "hacia arriba" en el menú (-1), ArrowDown va "hacia abajo" (+1)
      this.navigateWithShortcut(event.key === 'ArrowUp' ? -1 : 1);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    if (this.showUtilities() && !target.closest('.utilities-container')) {
      this.closeUtilities();
    }

    if ((this.isNotificationPanelOpen() || this.isNotificationPanelRendered())
      && !target.closest('.notifications-panel')
      && !target.closest('.notifications-bell')) {
      this.closeNotificationPanel();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.isMobile = window.innerWidth <= 800;
    this.isMobileAnimation = window.innerWidth <= 768;

    if (!this.isMobile) {
      this.mobileMenuOpen = false;
    }
  }

  private navigateWithShortcut(direction: number) {
    if (!this.sidebar) return;

    // Obtenemos los ítems visibles según nuestro rol y contexto actual
    const items = this.sidebar.filteredNavItems;
    const currentUrl = this.router.url.split('?')[0];

    // Buscamos cuál de los ítems del sidebar corresponde a nuestra página actual
    const currentIndex = items.findIndex(item => currentUrl.startsWith(item.route));
    if (currentIndex === -1) return;

    // Calculamos el índice siguiente
    let nextIndex = currentIndex + direction;
    // Evitamos salirnos de los límites y forzamos el ciclo continuo (opcional)
    if (nextIndex < 0) nextIndex = items.length - 1; // Hacer un loop
    if (nextIndex >= items.length) nextIndex = 0; // Hacer un loop

    this.router.navigate([items[nextIndex].route]);
  }

  onSidebarToggled(isOpen: boolean): void {
    this.sidebarOpen = isOpen;
  }

  openMobileMenu(): void {
    if (this.isMobile) {
      this.mobileMenuOpen = true;
    }
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  onMobileOverlayClick(): void {
    this.closeMobileMenu();
  }

  toggleTheme(): void {
    if (this.isNotificationPanelOpen()) {
      this.closeNotificationPanel();
    }
    this.themeService.toggleTheme();
  }

  isDarkMode(): boolean {
    return this.themeService.isDark();
  }

  get isAiChat(): boolean {
    return this.router.url.includes('/ai-chat');
  }

  logout(): void {
    if (this.isNotificationPanelOpen()) {
      this.closeNotificationPanel();
    }
    this.showLogoutModal = true;
  }

  confirmLogout(): void {
    this.showLogoutModal = false;
    this.authService.logout();
  }

  cancelLogout(): void {
    this.showLogoutModal = false;
  }

  openClearCacheModal(): void {
    if (this.isNotificationPanelOpen()) {
      this.closeNotificationPanel();
    }
    this.showClearCacheModal = true;
  }

  cancelClearCache(): void {
    this.showClearCacheModal = false;
  }

  confirmClearCache(): void {
    this.httpQueryCacheService.clearAll();
    this.showClearCacheModal = false;
    this.messageService.showSuccess('Cache limpiada. Si habias datos antiguos, se recargaran en la siguiente consulta.');
  }

  toggleUtilities(): void {
    const newValue = !this.showUtilities();
    this.showUtilities.set(newValue);
    localStorage.setItem('layout_utilities_visible', String(newValue));
  }

  closeUtilities(): void {
    this.showUtilities.set(false);
    localStorage.setItem('layout_utilities_visible', 'false');
  }

  toggleNotificationPanel(event: MouseEvent): void {
    event.stopPropagation();

    if (this.isNotificationPanelOpen()) {
      this.closeNotificationPanel();
      return;
    }

    if (this.notificationCloseTimer) {
      clearTimeout(this.notificationCloseTimer);
      this.notificationCloseTimer = undefined;
    }

    this.isNotificationPanelRendered.set(true);
    this.isNotificationPanelClosing.set(false);
    this.isNotificationPanelOpen.set(true);
    this.notificationService.refreshNotifications();
  }

  stopPanelPropagation(event: MouseEvent): void {
    event.stopPropagation();
  }

  closeNotificationPanel(event?: MouseEvent): void {
    event?.stopPropagation();

    if (!this.isNotificationPanelRendered()) {
      return;
    }

    this.isNotificationPanelOpen.set(false);
    this.isNotificationPanelClosing.set(true);

    if (this.notificationCloseTimer) {
      clearTimeout(this.notificationCloseTimer);
    }

    this.notificationCloseTimer = setTimeout(() => {
      this.isNotificationPanelClosing.set(false);
      this.isNotificationPanelRendered.set(false);
      this.notificationCloseTimer = undefined;
    }, 220);
  }

  onNotificationClick(notification: SessionNotification): void {
    this.notificationService.markAsRead(notification.id);
    this.notificationService.toggleExpanded(notification.id);
  }

  markAllNotificationsAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  notificationIcon(notification: SessionNotification): string {
    if (notification.code === 'FOOD_CRISIS_ACTIVATED') {
      return 'crisis';
    }

    if (notification.code === 'FOOD_CRISIS_LIFTED') {
      return 'success';
    }

    return 'info';
  }

  formatNotificationTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) {
      return 'Ahora';
    }

    if (diffMinutes < 60) {
      return `Hace ${diffMinutes} min`;
    }

    if (diffMinutes < 24 * 60) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  }

  prepareRoute(outlet: RouterOutlet) {
    const animation = outlet?.activatedRouteData?.['animation'];
    if (!animation) return null;

    // Retorna el mismo objeto cached porque los parámetros son siempre los mismos
    return {
      value: animation,
      params: this.isMobileAnimation ? this.mobileAnimParams : this.desktopAnimParams
    };
  }
}
