import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoggerService } from './logger.service';
import { TranslateService } from '@ngx-translate/core';


declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({
  providedIn: 'root',
})
export class PwaInstallService {
  private readonly logger = inject(LoggerService);
  private translate = inject(TranslateService);
  private canInstall$ = new BehaviorSubject<boolean>(false);
  private isInstalled$ = new BehaviorSubject<boolean>(this.checkIfInstalled());
  private installPrompt: BeforeInstallPromptEvent | null = null;

  constructor() {
    this.setupInstallPrompt();
    this.setupDisplayModeListener();
  }

  /**
   * Setup the beforeinstallprompt event listener
   */
  private setupInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (event: any) => {
      event.preventDefault();
      this.installPrompt = event;
      this.canInstall$.next(true);
    });

    // Handle app installed
    window.addEventListener('appinstalled', () => {
      this.canInstall$.next(false);
      this.isInstalled$.next(true);
      this.installPrompt = null;
    });
  }

  /**
   * Setup display mode listener
   */
  private setupDisplayModeListener(): void {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled$.next(true);
    }

    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
      this.isInstalled$.next(e.matches);
    });
  }

  /**
   * Check if the app is already installed
   */
  private checkIfInstalled(): boolean {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }

    if ((window.navigator as any).standalone === true) {
      return true;
    }

    return false;
  }

  /**
   * Get canInstall observable
   */
  canInstall(): Observable<boolean> {
    return this.canInstall$.asObservable();
  }

  /**
   * Get isInstalled observable
   */
  isInstalled(): Observable<boolean> {
    return this.isInstalled$.asObservable();
  }

  /**
   * Trigger the install prompt
   */
  async installApp(): Promise<boolean> {
    if (!this.installPrompt) {
      this.logger.warn('[PWA Install] Install prompt not available');
      return false;
    }

    try {
      this.installPrompt.prompt();
      const { outcome } = await this.installPrompt.userChoice;
      
      if (outcome === 'accepted') {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      this.logger.error('[PWA Install] Error during install:', error);
      return false;
    }
  }

  /**
   * Open the app share menu (for sharing the PWA)
   */
  async shareApp(): Promise<boolean> {
    if (!navigator.share) {
      this.logger.warn('[PWA Install] Share API not supported');
      return false;
    }

    try {
      await navigator.share({
        title: 'SmartEconomato',
        text: this.translate.instant('PWA.SHARE_TEXT'),
        url: window.location.href,
      });
      return true;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        this.logger.error('[PWA Install] Error sharing:', error);
      }
      return false;
    }
  }

  /**
   * Check if the device is in fullscreen mode (standalone)
   */
  isFullscreen(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  }

  /**
   * Get install methods availability
   */
  getInstallMethodsAvailability(): {
    webInstall: boolean;
    nativeShare: boolean;
    isInstalled: boolean;
  } {
    return {
      webInstall: !!this.installPrompt,
      nativeShare: !!navigator.share,
      isInstalled: this.isInstalled$.value,
    };
  }

  /**
   * Get app installation instructions
   */
  getInstallInstructions(): string {
    if (this.isInstalled$.value) {
      return this.translate.instant('PWA.INSTRUCTIONS.ALREADY_INSTALLED');
    }

    if (this.installPrompt) {
      return this.translate.instant('PWA.INSTRUCTIONS.INSTALL_BTN');
    }

    // Fallback instructions for different browsers
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      return this.translate.instant('PWA.INSTRUCTIONS.IOS');
    }

    if (/Android/.test(navigator.userAgent)) {
      return this.translate.instant('PWA.INSTRUCTIONS.ANDROID');
    }

    return this.translate.instant('PWA.INSTRUCTIONS.NOT_SUPPORTED');
  }
}
