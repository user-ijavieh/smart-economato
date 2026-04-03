import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

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
  @Output() closed = new EventEmitter<void>();

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

  close(): void {
    if (this.isClosing) {
      return;
    }

    this.isClosing = true;

    window.setTimeout(() => {
      this.closed.emit();
    }, 300);
  }
}
