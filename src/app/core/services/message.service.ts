import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export interface ConfirmDialog {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

@Injectable({ providedIn: 'root' })
export class MessageService {
  private toasts$ = new BehaviorSubject<Toast[]>([]);
  private confirmDialog$ = new BehaviorSubject<ConfirmDialog | null>(null);
  private confirmResolve?: (value: boolean) => void;
  private nextId = 0;

  get toasts(): Observable<Toast[]> {
    return this.toasts$.asObservable();
  }

  get dialog(): Observable<ConfirmDialog | null> {
    return this.confirmDialog$.asObservable();
  }

  showSuccess(message: string, duration?: number): void {
    this.addToast(message, 'success', duration);
  }

  showError(message: string, duration?: number): void {
    this.addToast(message, 'error', duration);
  }

  showWarning(message: string, duration?: number): void {
    this.addToast(message, 'warning', duration);
  }

  showInfo(message: string, duration?: number): void {
    this.addToast(message, 'info', duration);
  }

  confirm(title: string, message: string): Promise<boolean> {
    this.confirmDialog$.next({ title, message });
    return new Promise(resolve => {
      this.confirmResolve = resolve;
    });
  }

  resolveConfirm(result: boolean): void {
    this.confirmDialog$.next(null);
    this.confirmResolve?.(result);
  }

  private addToast(message: string, type: Toast['type'], duration = 4000): void {
    const toast: Toast = { id: this.nextId++, message, type, duration };

    setTimeout(() => {
      this.toasts$.next([...this.toasts$.value, toast]);
      setTimeout(() => this.removeToast(toast.id), duration);
    }, 0);
  }

  removeToast(id: number): void {
    this.toasts$.next(this.toasts$.value.filter(t => t.id !== id));
  }
}
