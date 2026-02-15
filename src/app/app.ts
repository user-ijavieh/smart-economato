import { Component, signal, inject, ChangeDetectorRef, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToastComponent } from './shared/components/layout/toast/toast.component';
import { ConfirmDialogComponent } from './shared/components/layout/confirm-dialog/confirm-dialog.component';
import { MessageService, Toast } from './core/services/message.service';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, ToastComponent, ConfirmDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('smart-economato');
  private messageService = inject(MessageService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  toasts: Toast[] = [];

  ngOnInit(): void {
    this.messageService.toasts.subscribe(toasts => {
      this.toasts = toasts;
      this.cdr.markForCheck();
    });

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
          background: rgba(30, 40, 80, 0.05);
        }
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, rgba(30, 40, 80, 0.7), rgba(50, 60, 120, 0.7));
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, rgba(30, 40, 80, 0.9), rgba(50, 60, 120, 0.9));
        }
      `;
      document.head.appendChild(style);
    }
  }
}
