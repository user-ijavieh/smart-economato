import { Component } from '@angular/core';

@Component({
  selector: 'app-profile',
  standalone: true,
  template: `
    <div class="page-header">
      <h1>Perfil</h1>
    </div>
    <div class="page-content">
      <p class="empty-message">Módulo de perfil en desarrollo...</p>
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 20px 40px;
      background: linear-gradient(135deg, rgba(184, 75, 68, 0.95) 0%, rgba(160, 61, 55, 0.95) 100%);
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    }
    .page-header h1 {
      font-size: 1.8rem;
      color: white;
      letter-spacing: 2px;
      flex: 1;
      text-align: center;
    }
    .page-content {
      padding: 40px;
      text-align: center;
    }
    .empty-message {
      color: #4b5563;
      font-size: 1.1rem;
      font-family: 'Deserta', sans-serif;
    }
  `]
})
export class ProfileComponent {}
