import { Component, signal, inject, ChangeDetectorRef, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToastComponent } from './shared/components/layout/toast/toast.component';
import { ConfirmDialogComponent } from './shared/components/layout/confirm-dialog/confirm-dialog.component';
import { MessageService, Toast } from './core/services/message.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, ToastComponent, ConfirmDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('smart-economato');
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  toasts: Toast[] = [];

  ngOnInit(): void {
    this.messageService.toasts.subscribe(toasts => {
      this.toasts = toasts;
      this.cdr.markForCheck();
    });
  }
}
