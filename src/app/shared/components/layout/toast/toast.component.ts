import { Component, Input, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { Toast, MessageService } from '../../../../core/services/message.service';
import { ModalStackService } from '../../../../core/services/modal-stack.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.css'
})
export class ToastComponent implements OnInit, OnDestroy {
  @Input() toasts: Toast[] = [];

  private messageService = inject(MessageService);
  private modalStack = inject(ModalStackService);
  private expiredSub?: Subscription;

  private readonly modalStackCount = toSignal(this.modalStack.stackCount$, {
    initialValue: this.modalStack.hasActiveModals() ? 1 : 0
  });

  readonly zIndex = computed(() => (this.modalStackCount() > 0 ? 80020 : 31000));

  /** Signal con el Set de IDs en animación de salida — notifica al scheduler zoneless */
  private exitingIds = signal<ReadonlySet<number>>(new Set());

  /** Devuelve true si el toast con ese id está saliendo */
  isExiting = (id: number) => this.exitingIds().has(id);

  ngOnInit(): void {
    this.expiredSub = this.messageService.toastExpired$.subscribe(id => {
      this.dismiss(id);
    });
  }

  ngOnDestroy(): void {
    this.expiredSub?.unsubscribe();
  }

  dismiss(id: number): void {
    if (this.exitingIds().has(id)) return;

    // Actualizar la signal → Angular detecta el cambio en modo zoneless
    this.exitingIds.update(prev => new Set([...prev, id]));

    setTimeout(() => {
      this.exitingIds.update(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      this.messageService.removeToast(id);
    }, 420);
  }

  getTitle(type: string): string {
    const keys: Record<string, string> = {
      success: 'COMMON.SUCCESS',
      error: 'COMMON.ERROR',
      warning: 'COMMON.WARNING',
      info: 'COMMON.INFO'
    };
    
    return keys[type] || '';
  }

  getToastTitle(toast: Toast): string {
    return toast.title?.trim() || this.getTitle(toast.type);
  }
}
