import { ApplicationRef, Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

export interface Toast {
  id: number;
  title?: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  persistent?: boolean;
}

export interface ToastOptions {
  duration?: number;
  title?: string;
  persistent?: boolean;
}

export interface ConfirmDialog {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

@Injectable({ providedIn: 'root' })
export class MessageService {
  private appRef = inject(ApplicationRef);
  private toasts$ = new BehaviorSubject<Toast[]>([]);
  private confirmDialog$ = new BehaviorSubject<ConfirmDialog | null>(null);
  private confirmResolve?: (value: boolean) => void;
  private nextId = 0;

  /** Emite el id del toast cuya duración ha expirado */
  readonly toastExpired$ = new Subject<number>();

  get toasts(): Observable<Toast[]> {
    return this.toasts$.asObservable();
  }

  get dialog(): Observable<ConfirmDialog | null> {
    return this.confirmDialog$.asObservable();
  }

  showSuccess(message: string, duration?: number, options?: Omit<ToastOptions, 'duration'>): void {
    this.addToast(message, 'success', { duration, ...options });
  }

  showError(message: string, duration?: number, options?: Omit<ToastOptions, 'duration'>): void {
    this.addToast(message, 'error', { duration, ...options });
  }

  showWarning(message: string, duration?: number, options?: Omit<ToastOptions, 'duration'>): void {
    this.addToast(message, 'warning', { duration, ...options });
  }

  showInfo(message: string, duration?: number, options?: Omit<ToastOptions, 'duration'>): void {
    this.addToast(message, 'info', { duration, ...options });
  }

  confirm(title: string, message: string, confirmText?: string, cancelText?: string): Promise<boolean> {
    this.confirmDialog$.next({ title, message, confirmText, cancelText });
    return new Promise(resolve => {
      this.confirmResolve = resolve;
    });
  }

  resolveConfirm(result: boolean): void {
    this.confirmDialog$.next(null);
    this.confirmResolve?.(result);
  }

  private addToast(message: string, type: Toast['type'], options?: ToastOptions): void {
    if (this.toasts$.value.some(t => t.message === message && t.type === type)) {
      return;
    }
    const toast: Toast = {
      id: this.nextId++,
      title: options?.title,
      message,
      type,
      duration: options?.duration ?? 3000,
      persistent: options?.persistent ?? false
    };

    setTimeout(() => {
      this.toasts$.next([...this.toasts$.value, toast]);
      this.appRef.tick();
      if (!toast.persistent) {
        setTimeout(() => this.toastExpired$.next(toast.id), toast.duration);
      }
    }, 0);
  }

  removeToast(id: number): void {
    this.toasts$.next(this.toasts$.value.filter(t => t.id !== id));
    this.appRef.tick();
  }
}
