import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [RouterModule, BaseModalComponent],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.css'
})
export class WelcomeComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  slides = [
    '/assets/img/carousel/carousel1.jpg',
    '/assets/img/carousel/carousel2.jpg',
    '/assets/img/carousel/carousel3.jpg'
  ];
  currentSlide = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  navCards = [
    { label: 'Inventario', route: '/inventario', icon: '/assets/img/icons/inventory.svg' },
    { label: 'Pedidos', route: '/orders', icon: '/assets/img/icons/order.svg' },
    { label: 'Recepción', route: '/reception', icon: '/assets/img/icons/reception.svg' },
    { label: 'Recetas', route: '/recipes', icon: '/assets/img/icons/recipes.svg' },
  ];

  get filteredNavCards() {
    const userRole = this.authService.getRole();
    if (userRole === 'USER') {
      return this.navCards.filter(card =>
        card.label !== 'Pedidos' && card.label !== 'Recepción'
      );
    }
    return this.navCards;
  }

  get isChefOrAdmin(): boolean {
    const role = this.authService.getRole();
    return role === 'CHEF' || role === 'ADMIN';
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
  }

  showLogoutModal = false;

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
}
