import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';
import { ThemeService } from '../../../core/services/theme.service';
import { NotificationService, SessionNotification } from '../../../core/services/notification.service';
import { HttpQueryCacheService } from '../../../core/services/http-query-cache.service';
import { MessageService } from '../../../core/services/message.service';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [RouterModule, BaseModalComponent, TranslateModule],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.css'
})
export class WelcomeComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private themeService = inject(ThemeService);
  private notificationService = inject(NotificationService);
  private httpQueryCacheService = inject(HttpQueryCacheService);
  private messageService = inject(MessageService);
  private translate = inject(TranslateService);

  slides = [
    '/assets/img/carousel/carousel1.jpg',
    '/assets/img/carousel/carousel2.jpg',
    '/assets/img/carousel/carousel3.jpg'
  ];
  currentSlide = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private notificationCloseTimer?: ReturnType<typeof setTimeout>;

  navCards = [
    { label: 'Inventario', route: '/inventario', icon: '/assets/img/icons/inventory.svg', key: 'SIDEBAR.INVENTORY' },
    { label: 'Pedidos', route: '/orders', icon: '/assets/img/icons/order.svg', key: 'SIDEBAR.ORDERS' },
    { label: 'Recepción', route: '/reception', icon: '/assets/img/icons/reception-v2.svg', key: 'SIDEBAR.RECEPTION' },
    { label: 'Recetas', route: '/recipes', icon: '/assets/img/icons/recipes.svg', key: 'SIDEBAR.RECIPES' },
  ];

  get filteredNavCards() {
    const userRole = this.authService.getRole();
    if (userRole === 'USER') {
      return this.navCards.filter(card =>
        card.key !== 'SIDEBAR.ORDERS' && card.key !== 'SIDEBAR.RECEPTION'
      );
    }
    return this.navCards;
  }

  get isChef(): boolean {
    return this.authService.getRole() === 'CHEF';
  }

  get isTeacher(): boolean {
    const role = this.authService.getRole();
    return role === 'CHEF' || role === 'ELEVATED';
  }

  get isAdmin(): boolean {
    return this.authService.getRole() === 'ADMIN';
  }

  ngOnInit(): void {
    this.intervalId = setInterval(() => {
      this.currentSlide = (this.currentSlide + 1) % this.slides.length;
      this.cdr.markForCheck();
    }, 3000);
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    if (this.notificationCloseTimer) {
      clearTimeout(this.notificationCloseTimer);
      this.notificationCloseTimer = undefined;
    }
  }

  showLogoutModal = false;
  showClearCacheModal = false;

  readonly notifications = toSignal(this.notificationService.notifications$, { initialValue: [] as SessionNotification[] });
  readonly unreadCount = toSignal(this.notificationService.unreadCount$, { initialValue: 0 });
  readonly isNotificationPanelOpen = signal(false);
  readonly isNotificationPanelRendered = signal(false);
  readonly isNotificationPanelClosing = signal(false);
  readonly showUtilities = signal<boolean>(localStorage.getItem('welcome_utilities_visible') !== 'false');

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

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  isDarkMode(): boolean {
    return this.themeService.isDark();
  }

  toggleUtilities(): void {
    const newValue = !this.showUtilities();
    this.showUtilities.set(newValue);
    localStorage.setItem('welcome_utilities_visible', String(newValue));
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
      return this.translate.instant('COMMON.NOW') || 'Ahora';
    }

    if (diffMinutes < 60) {
      return this.translate.instant('COMMON.AGO_MINS', { count: diffMinutes }) || `Hace ${diffMinutes} min`;
    }

    if (diffMinutes < 24 * 60) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
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
    this.messageService.showSuccess(this.translate.instant('WELCOME.CACHE_CLEARED_SUCCESS'));
  }
}
