import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MessageService,Toast } from '../../../core/services/message.service';
import { SidebarComponent } from './sidebar/sidebar.component';
import { ToastComponent } from './toast/toast.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, ToastComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent {
  private authService = inject(AuthService);
  public messageService = inject(MessageService);

  sidebarOpen = false;

  isAuthenticated$ = this.authService.authStatus$;

  onSidebarToggled(isOpen: boolean): void {
    this.sidebarOpen = isOpen;
  }

  logout(): void {
    this.authService.logout();
  }
}
