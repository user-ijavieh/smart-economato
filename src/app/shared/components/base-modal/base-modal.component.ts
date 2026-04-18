import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  Renderer2,
  inject
} from '@angular/core';
import { ModalStackService } from '../../../core/services/modal-stack.service';

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

export class BaseModalComponent implements OnInit, OnDestroy {
  @Input() title = '';
  @Input() headerClass = '';
  @Input() size: 'sm' | 'md' | 'lg' | 'fullscreen' = 'md';
  @Input() zIndex: number | null = null;
  @Input() backdropVariant: 'default' | 'soft' = 'default';
  @Input() closeOnBackdrop = true;
  @Input() showCloseButton = true;
  @Input() showHeader = true;
  @Input() beforeClose?: () => Promise<boolean> | boolean;
  @Output() closed = new EventEmitter<void>();

  private renderer = inject(Renderer2);
  private cdr = inject(ChangeDetectorRef);
  private modalStack = inject(ModalStackService);
  private readonly modalId = `modal-${Math.random().toString(36).slice(2)}-${Date.now()}`;

  isClosing = false;

  ngOnInit(): void {
    this.modalStack.register(this.modalId);
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.modalStack.unregister(this.modalId);
  }

  private canHandleCloseEvents(): boolean {
    return this.modalStack.isTop(this.modalId);
  }

  get overlayZIndex(): number {
    if (this.zIndex !== null) {
      return this.zIndex;
    }

    return this.modalStack.getZIndex(this.modalId);
  }

  onOverlayClick(event: MouseEvent): void {
    if (!this.closeOnBackdrop || this.isClosing || !this.canHandleCloseEvents()) {
      return;
    }

    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  onEscapeKey(): void {
    if (!this.isClosing && this.canHandleCloseEvents()) {
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
