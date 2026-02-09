import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.css'
})
export class WelcomeComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);

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
    { label: 'Perfil', route: '/profile', icon: '/assets/img/icons/profile.svg' },
  ];

  ngOnInit(): void {
    this.intervalId = setInterval(() => {
      this.currentSlide = (this.currentSlide + 1) % this.slides.length;
    }, 3000);
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
