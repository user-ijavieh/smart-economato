import { Component, DestroyRef, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService } from '../../../../core/services/message.service';
import { ModalStackService } from '../../../../core/services/modal-stack.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css'
})
export class ConfirmDialogComponent implements OnDestroy {
  private messageService = inject(MessageService);
  private modalStack = inject(ModalStackService);
  private destroyRef = inject(DestroyRef);
  private readonly dialogId = 'confirm-dialog-overlay';

  dialog$ = this.messageService.dialog;

  constructor() {
    this.dialog$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(dialog => {
        if (dialog) {
          this.modalStack.register(this.dialogId);
          return;
        }

        this.modalStack.unregister(this.dialogId);
      });
  }

  ngOnDestroy(): void {
    this.modalStack.unregister(this.dialogId);
  }

  confirm(): void {
    this.messageService.resolveConfirm(true);
  }

  cancel(): void {
    this.messageService.resolveConfirm(false);
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancel();
    }
  }
}
