import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoggerService } from './logger.service';

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
        text: 'Instala SmartEconomato - Sistema de gestión de cocina profesional',
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
      return 'La aplicación ya está instalada en tu dispositivo.';
    }

    if (this.installPrompt) {
      return 'Presiona el botón "Instalar" para agregar SmartEconomato a tu pantalla de inicio.';
    }

    // Fallback instructions for different browsers
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      return 'En iOS: Abre el menú (⋯) y selecciona "Agregar a la pantalla de inicio"';
    }

    if (/Android/.test(navigator.userAgent)) {
      return 'En Android: Abre el menú (⋯) y selecciona "Instalar aplicación"';
    }

    return 'Tu navegador no soporta la instalación de PWAs. Actualiza a una versión más reciente.';
  }
}
