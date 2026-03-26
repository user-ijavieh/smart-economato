import { Component, inject, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MessageService, Toast } from '../../../core/services/message.service';
import { SidebarComponent } from './sidebar/sidebar.component';
import { ToastComponent } from './toast/toast.component';
import { ThemeService } from '../../../core/services/theme.service';
import { slideInAnimation } from '../../animations/route-animations';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, ToastComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
  animations: [slideInAnimation]
})
export class LayoutComponent {
  private authService = inject(AuthService);
  public messageService = inject(MessageService);
  private router = inject(Router);
  private themeService = inject(ThemeService);

  @ViewChild(SidebarComponent) sidebar!: SidebarComponent;

  sidebarOpen = window.innerWidth > 800;
  showLogoutModal = false;

  isAuthenticated$ = this.authService.authStatus$;

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault(); // Evitamos scroll de la página si existiera
      // ArrowUp va "hacia arriba" en el menú (-1), ArrowDown va "hacia abajo" (+1)
      this.navigateWithShortcut(event.key === 'ArrowUp' ? -1 : 1);
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

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  isDarkMode(): boolean {
    return this.themeService.isDark();
  }

  logout(): void {
    this.showLogoutModal = true;
  }

  confirmLogout(): void {
    this.showLogoutModal = false;
    this.authService.logout();
  }

  cancelLogout(): void {
    this.showLogoutModal = false;
  }

  onLogoutOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('logout-modal-overlay')) {
      this.cancelLogout();
    }
  }

  prepareRoute(outlet: RouterOutlet) {
    const animation = outlet && outlet.activatedRouteData && outlet.activatedRouteData['animation'];
    if (!animation) return null;
    
    // Si estamos en móvil, animamos en el eje X (horizontal) en vez de Y (vertical)
    if (window.innerWidth <= 768) {
      return {
        value: animation,
        params: {
          enterTransform: 'translateX(100%)',
          leaveTransform: 'translateX(-10%)',
          enterTransformDec: 'translateX(-100%)',
          leaveTransformDec: 'translateX(10%)'
        }
      };
    }
    
    // Por defecto en desktop (eje Y)
    return {
      value: animation,
      params: {
        enterTransform: 'translateY(100%)',
        leaveTransform: 'translateY(-10%)',
        enterTransformDec: 'translateY(-100%)',
        leaveTransformDec: 'translateY(10%)'
      }
    };
  }
}
