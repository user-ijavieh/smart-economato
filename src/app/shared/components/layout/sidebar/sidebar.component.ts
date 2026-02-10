import { Component, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

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
export class SidebarComponent {
  private authService = inject(AuthService);
  
  isOpen = false;

  @Output() sidebarToggled = new EventEmitter<boolean>();
  @Output() logoutClicked = new EventEmitter<void>();

  navItems: NavItem[] = [
    { label: 'Inicio', route: '/welcome', icon: 'home' },
    { label: 'Inventario', route: '/inventario', icon: 'inventory' },
    { label: 'Recetas', route: '/recipes', icon: 'book' },
    { label: 'Recepción', route: '/reception', icon: 'truck' },
    { label: 'Pedidos', route: '/orders', icon: 'cart' },
    { label: 'Perfil', route: '/profile', icon: 'person' }
  ];

  toggleSidebar(): void {
    this.isOpen = !this.isOpen;
    this.sidebarToggled.emit(this.isOpen);
  }

  onLogout(): void {
    this.logoutClicked.emit();
  }

  // Métodos para obtener información del usuario
  getUserRole(): string | null {
    return this.authService.getRole();
  }

  getUserToken(): string | null {
    return this.authService.getToken();
  }

  // Si tienes el nombre del usuario en localStorage
  getUserName(): string | null {
    const name = this.authService.getName();
    return name || 'Admin'; // Por defecto "Admin" si no hay nombre
  }

  // Método para obtener la primera letra del rol
  getUserInitials(): string {
    const role = this.getUserRole();
    if (!role) return 'U';
    return role.charAt(0).toUpperCase();
  }
}
