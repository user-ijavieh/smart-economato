import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output, inject } from '@angular/core';

@Component({
  selector: 'app-base-modal',
  standalone: true,
  templateUrl: './base-modal.component.html',
  styleUrl: './base-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscapeKey()'
  }
})
export class BaseModalComponent {
  @Input() title = '';
  @Input() headerClass = '';
  @Input() size: 'sm' | 'md' | 'lg' | 'fullscreen' = 'md';
  @Input() closeOnBackdrop = true;
  @Input() showCloseButton = true;
  @Input() showHeader = true;
  @Input() beforeClose?: () => Promise<boolean> | boolean;
  @Output() closed = new EventEmitter<void>();

  private cdr = inject(ChangeDetectorRef);
  isClosing = false;

  onOverlayClick(event: MouseEvent): void {
    if (!this.closeOnBackdrop || this.isClosing) {
      return;
    }

    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  onEscapeKey(): void {
    if (!this.isClosing) {
      this.close();
    }
  }

  async close(): Promise<void> {
    if (this.isClosing) {
      return;
    }

    if (this.beforeClose) {
      const canClose = await this.beforeClose();
      if (!canClose) {
        return;
      }
    }

    this.isClosing = true;
    this.cdr.markForCheck();

    window.setTimeout(() => {
      this.closed.emit();
    }, 300);
  }
}
