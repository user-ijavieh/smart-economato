import { Component, signal, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToastComponent } from './shared/components/layout/toast/toast.component';
import { ConfirmDialogComponent } from './shared/components/layout/confirm-dialog/confirm-dialog.component';
import { AlertNotificationComponent } from './shared/components/layout/alert-notification/alert-notification.component';
import { MessageService } from './core/services/message.service';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, ToastComponent, ConfirmDialogComponent, AlertNotificationComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('smart-economato');
  private messageService = inject(MessageService);
  private router = inject(Router);
  readonly toasts$ = this.messageService.toasts;

  ngOnInit(): void {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.updateScrollbarStyle(event.urlAfterRedirects);
      });

    // Comprueba el estado inicial de la ruta
    this.updateScrollbarStyle(this.router.url);
  }

  private updateScrollbarStyle(url: string): void {
    const isAdminRoute = url.startsWith('/admin-panel');

    // Elimina el estilo de la barra de desplazamiento existente si está presente
    const existingStyle = document.getElementById('admin-scrollbar-style');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Si es una ruta de administrador, agrega el estilo de la barra de desplazamiento
    if (isAdminRoute) {
      const style = document.createElement('style');
      style.id = 'admin-scrollbar-style';
      style.textContent = `
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: var(--admin-scrollbar-track);
        }
        ::-webkit-scrollbar-thumb {
          background: var(--admin-gradient));
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: var(--admin-gradient));
        }
      `;
      document.head.appendChild(style);
    }
  }
}
