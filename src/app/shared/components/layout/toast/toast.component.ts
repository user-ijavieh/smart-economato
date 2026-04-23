import { Component, Input, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { Toast, MessageService } from '../../../../core/services/message.service';
import { ModalStackService } from '../../../../core/services/modal-stack.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
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
    const titles: Record<string, string> = {
      success: 'Éxito',
      error: 'Error',
      warning: 'Advertencia',
      info: 'Información'
    };
    return titles[type] ?? '';
  }

  getToastTitle(toast: Toast): string {
    return toast.title?.trim() || this.getTitle(toast.type);
  }
}
