import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Toast } from '../../../../core/services/message.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.css'
})
export class ToastComponent {
  @Input() toasts: Toast[] = [];

  getIconClass(type: string): string {
    const icons: Record<string, string> = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ⓘ'
    };
    return icons[type] || 'ⓘ';
  }

  getTypeClass(type: string): string {
    const classes: Record<string, string> = {
      success: 'toast-success',
      error: 'toast-error',
      warning: 'toast-warning',
      info: 'toast-info'
    };
    return classes[type] || 'toast-info';
  }
}
