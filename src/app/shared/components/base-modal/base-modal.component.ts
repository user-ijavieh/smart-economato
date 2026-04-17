import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy, Renderer2 } from '@angular/core';

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
export class BaseModalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('modalOverlay') modalOverlay!: ElementRef;
  @Input() title = '';
  @Input() headerClass = '';
  @Input() size: 'sm' | 'md' | 'lg' | 'fullscreen' = 'md';
  @Input() closeOnBackdrop = true;
  @Input() showCloseButton = true;
  @Input() showHeader = true;
  @Input() beforeClose?: () => Promise<boolean> | boolean;
  @Output() closed = new EventEmitter<void>();

  private renderer = inject(Renderer2);
  private cdr = inject(ChangeDetectorRef);
  isClosing = false;

  ngAfterViewInit() {
    // Teleport to body to escape local stacking contexts and transforms
    this.renderer.appendChild(document.body, this.modalOverlay.nativeElement);
  }

  ngOnDestroy() {
    // Cleanup: remove from body if it was moved there
    const overlay = this.modalOverlay?.nativeElement;
    if (overlay && overlay.parentNode === document.body) {
      this.renderer.removeChild(document.body, overlay);
    }
  }

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
