import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PwaInstallService } from '../../../core/services/pwa-install.service';
import { PwaNotificationService } from '../../../core/services/pwa-notification.service';

/**
 * PWA Install Banner Component
 * 
 * Muestra un banner para instalar la PWA.
 * Se oculta automáticamente si ya está instalada.
 * 
 * Uso en app.component:
 * <app-pwa-install-banner></app-pwa-install-banner>
 */
@Component({
  selector: 'app-pwa-install-banner',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div *ngIf="showBanner" class="pwa-banner">
      <div class="pwa-banner-content">
        <div class="pwa-banner-icon">📱</div>
        <div class="pwa-banner-text">
          <h3>{{ 'PWA.TITLE' | translate }}</h3>
          <p>{{ instructions }}</p>
        </div>
        <div class="pwa-banner-actions">
          <button class="btn-install" (click)="onInstall()" *ngIf="showInstallBtn">
            {{ 'PWA.INSTALL' | translate }}
          </button>
          <button class="btn-share" (click)="onShare()" *ngIf="showShareBtn">
            {{ 'PWA.SHARE' | translate }}
          </button>
          <button class="btn-close" (click)="onDismiss()">✕</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pwa-banner {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #B84B44 0%, #a3423c 100%);
      color: white;
      padding: 1rem;
      box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .pwa-banner-content {
      display: flex;
      align-items: center;
      gap: 1rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .pwa-banner-icon {
      font-size: 2rem;
      flex-shrink: 0;
    }

    .pwa-banner-text {
      flex: 1;
    }

    .pwa-banner-text h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
    }

    .pwa-banner-text p {
      margin: 0.25rem 0 0;
      font-size: 0.875rem;
      opacity: 0.95;
    }

    .pwa-banner-actions {
      display: flex;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    button {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .btn-install {
      background: white;
      color: #B84B44;
    }

    .btn-install:hover {
      background: #f0f0f0;
      transform: scale(1.05);
    }

    .btn-share {
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }

    .btn-share:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .btn-close {
      background: transparent;
      color: white;
      padding: 0.5rem 0.75rem;
      font-size: 1.2rem;
      line-height: 1;
    }

    .btn-close:hover {
      background: rgba(0, 0, 0, 0.1);
    }

    @media (max-width: 768px) {
      .pwa-banner-content {
        flex-direction: column;
        align-items: flex-start;
      }

      .pwa-banner-icon {
        font-size: 1.5rem;
      }

      .pwa-banner-actions {
        width: 100%;
        justify-content: flex-end;
      }
    }
  `]
})
export class PwaInstallBannerComponent implements OnInit, OnDestroy {
  showBanner = false;
  showInstallBtn = false;
  showShareBtn = false;
  instructions = '';

  private translate = inject(TranslateService);
  private destroy$ = new Subject<void>();

  constructor(
    private pwaInstall: PwaInstallService,
    private notifications: PwaNotificationService
  ) {}

  ngOnInit() {
    // Only show banner if we can install and it's not already installed
    this.pwaInstall
      .canInstall()
      .pipe(takeUntil(this.destroy$))
      .subscribe((canInstall: boolean) => {
        this.showInstallBtn = canInstall;
        if (canInstall) {
          this.showBanner = true;
          this.instructions = this.pwaInstall.getInstallInstructions();
        }
      });

    // Check if native share is available
    this.showShareBtn = !!navigator.share;

    // Hide banner if already installed
    this.pwaInstall
      .isInstalled()
      .pipe(takeUntil(this.destroy$))
      .subscribe((installed: boolean) => {
        if (installed) {
          this.showBanner = false;
        }
      });
  }

  async onInstall() {
    const success = await this.pwaInstall.installApp();
    if (success) {
      this.notifications.showSuccess(
        this.translate.instant('PWA.MESSAGES.INSTALL_STARTED'), 
        this.translate.instant('PWA.MESSAGES.INSTALL_STARTED_SUB')
      );
      this.showBanner = false;
    }
  }

  async onShare() {
    const success = await this.pwaInstall.shareApp();
    if (success) {
      this.notifications.showSuccess(
        this.translate.instant('PWA.MESSAGES.SHARED'), 
        this.translate.instant('PWA.MESSAGES.SHARED_SUB')
      );
    }
  }

  onDismiss() {
    this.showBanner = false;
    // Remember dismissal in localStorage (24 hours)
    const dismissUntil = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem('pwa-banner-dismiss-until', dismissUntil.toString());
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
