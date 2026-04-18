import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { NotificationApiService } from '../../../core/services/notification-api.service';
import { MessageService } from '../../../core/services/message.service';
import { UserService } from '../../../core/services/user.service';
import { AppRole } from '../../../core/services/notification.service';
import { User } from '../../../shared/models/user.model';
import { SEARCH_DEBOUNCE_MS } from '../../../core/constants/search.constants';

type NotificationTargetRole = Exclude<AppRole, 'ELEVATED'>;

@Component({
  selector: 'app-notifications-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './notifications-management.component.html',
  styleUrl: './notifications-management.component.css'
})
export class NotificationsManagementComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly notificationApiService = inject(NotificationApiService);
  private readonly userService = inject(UserService);
  private readonly messageService = inject(MessageService);

  readonly roles: Array<{ value: NotificationTargetRole; label: string }> = [
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'CHEF', label: 'Profesor' },
    { value: 'USER', label: 'Alumno' }
  ];

  activeTab: 'role' | 'user' = 'role';
  sendingRole = false;
  sendingUser = false;

  filteredUsers: User[] = [];
  showUserSuggestions = false;
  private usernameSearchRequestId = 0;
  private usernameSearchSubject = new Subject<string>();

  readonly roleForm = this.fb.group({
    role: this.fb.nonNullable.control<NotificationTargetRole>('CHEF'),
    title: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(100)]),
    message: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(500)])
  });

  readonly userForm = this.fb.group({
    username: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    title: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(100)]),
    message: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(500)])
  });

  constructor() {
    this.usernameSearchSubject.pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged()
    ).subscribe((username) => {
      this.searchUsers(username);
    });
  }

  ngOnDestroy(): void {
    this.usernameSearchSubject.complete();
  }

  setActiveTab(tab: 'role' | 'user'): void {
    this.activeTab = tab;
  }

  onUsernameInput(): void {
    const username = this.userForm.controls.username.value.trim();
    if (username.length < 2) {
      this.filteredUsers = [];
      this.showUserSuggestions = false;
      return;
    }

    this.usernameSearchSubject.next(username);
  }

  selectUser(user: User): void {
    this.userForm.controls.username.setValue(user.name);
    this.showUserSuggestions = false;
  }

  hideSuggestions(): void {
    setTimeout(() => {
      this.showUserSuggestions = false;
    }, 120);
  }

  submitByRole(): void {
    if (this.roleForm.invalid || this.sendingRole) {
      this.roleForm.markAllAsTouched();
      return;
    }

    const { role, title, message } = this.roleForm.getRawValue();
    this.sendingRole = true;

    this.notificationApiService.sendToRole(role, title.trim(), message.trim())
      .pipe(finalize(() => (this.sendingRole = false)))
      .subscribe({
        next: () => {
          this.messageService.showSuccess(`Notificación enviada a ${this.getRoleLabel(role)}.`, 4000, {
            title: 'Envío completado'
          });
          this.roleForm.reset({ role: this.roleForm.controls.role.value, title: '', message: '' });
        },
        error: (error: { error?: { message?: string } }) => {
          this.messageService.showError(error?.error?.message || 'No se pudo enviar la notificación.', 6000, {
            title: 'Error al enviar'
          });
        }
      });
  }

  submitByUser(): void {
    if (this.userForm.invalid || this.sendingUser) {
      this.userForm.markAllAsTouched();
      return;
    }

    const { username, title, message } = this.userForm.getRawValue();
    this.sendingUser = true;

    this.notificationApiService.sendToUser(username.trim(), title.trim(), message.trim())
      .pipe(finalize(() => (this.sendingUser = false)))
      .subscribe({
        next: () => {
          this.messageService.showSuccess(`Notificación enviada a ${username}.`, 4000, {
            title: 'Envío completado'
          });
          this.userForm.reset({ username: '', title: '', message: '' });
          this.filteredUsers = [];
        },
        error: (error: { error?: { message?: string } }) => {
          this.messageService.showError(error?.error?.message || 'No se pudo enviar la notificación.', 6000, {
            title: 'Error al enviar'
          });
        }
      });
  }

  rolePreview(): string {
    const role = this.roleForm.controls.role.value;
    const title = this.roleForm.controls.title.value.trim() || 'Sin título';
    return `Vas a enviar al grupo ${this.getRoleLabel(role)}: “${title}”.`;
  }

  userPreview(): string {
    const username = this.userForm.controls.username.value.trim() || 'usuario';
    const title = this.userForm.controls.title.value.trim() || 'Sin título';
    return `Vas a enviar a ${username}: “${title}”.`;
  }

  private searchUsers(term: string): void {
    const requestId = ++this.usernameSearchRequestId;

    this.userService.search(term, 0, 8).subscribe({
      next: page => {
        if (requestId !== this.usernameSearchRequestId) {
          return;
        }

        this.filteredUsers = page.content;
        this.showUserSuggestions = this.filteredUsers.length > 0;
      },
      error: () => {
        if (requestId !== this.usernameSearchRequestId) {
          return;
        }

        this.filteredUsers = [];
        this.showUserSuggestions = false;
      }
    });
  }

  private getRoleLabel(role: NotificationTargetRole): string {
    return this.roles.find(item => item.value === role)?.label ?? role;
  }
}
