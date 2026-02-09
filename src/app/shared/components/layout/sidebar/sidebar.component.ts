import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

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
}
