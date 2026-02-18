import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../core/services/user.service';
import { MessageService } from '../../../core/services/message.service';
import { User, UserRequest } from '../../../shared/models/user.model';
import { UserFormModalComponent } from './user-form-modal/user-form-modal.component';
import { ConfirmDialogComponent } from '../../../shared/components/layout/confirm-dialog/confirm-dialog.component';
import { ToastComponent } from '../../../shared/components/layout/toast/toast.component';

@Component({
    selector: 'app-users-management',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        UserFormModalComponent,
        ConfirmDialogComponent,
        ToastComponent
    ],
    templateUrl: './users-management.component.html',
    styleUrl: './users-management.component.css'
})
export class UsersManagementComponent implements OnInit {
    private userService = inject(UserService);
    private cdr = inject(ChangeDetectorRef);
    messageService = inject(MessageService);

    users: User[] = [];
    filteredUsers: User[] = [];
    loading = true;
    searchTerm = '';
    roleFilter = '';

    // Modal state
    showFormModal = false;
    selectedUser: User | null = null;

    ngOnInit(): void {
        this.loadUsers();
    }

    loadUsers(): void {
        this.loading = true;
        const source$ = this.roleFilter
            ? this.userService.getByRole(this.roleFilter)
            : this.userService.getAll();

        source$.subscribe({
            next: (users) => {
                this.users = users;
                this.applySearchFilter();
                this.loading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading users:', err);
                this.messageService.showError('Error al cargar los usuarios');
                this.loading = false;
            }
        });
    }

    applySearchFilter(): void {
        if (!this.searchTerm.trim()) {
            this.filteredUsers = [...this.users];
        } else {
            const term = this.searchTerm.toLowerCase();
            this.filteredUsers = this.users.filter(u =>
                u.name.toLowerCase().includes(term) ||
                u.user.toLowerCase().includes(term)
            );
        }
    }

    onSearch(): void {
        this.applySearchFilter();
    }

    onRoleFilterChange(): void {
        this.loadUsers();
    }

    clearFilters(): void {
        this.searchTerm = '';
        this.roleFilter = '';
        this.loadUsers();
    }

    hasActiveFilters(): boolean {
        return this.searchTerm.trim().length > 0 || this.roleFilter.length > 0;
    }

    // ── Modal operations ──

    openCreateModal(): void {
        this.selectedUser = null;
        this.showFormModal = true;
    }

    openEditModal(user: User): void {
        this.selectedUser = { ...user };
        this.showFormModal = true;
    }

    closeFormModal(): void {
        this.showFormModal = false;
        this.selectedUser = null;
    }

    onSaveUser(data: any): void {
        if (this.selectedUser) {
            // Edit mode
            const request: UserRequest = {
                name: data.name,
                user: data.user,
                password: data.password || '',
                role: data.role
            };
            this.userService.update(this.selectedUser.id, request).subscribe({
                next: () => {
                    this.messageService.showSuccess('Usuario actualizado correctamente');
                    this.closeFormModal();
                    this.loadUsers();
                },
                error: (err) => {
                    console.error('Error updating user:', err);
                    this.messageService.showError('Error al actualizar el usuario');
                }
            });
        } else {
            // Create mode
            const request: UserRequest = {
                name: data.name,
                user: data.user,
                password: data.password,
                role: data.role
            };
            this.userService.create(request).subscribe({
                next: () => {
                    this.messageService.showSuccess('Usuario creado correctamente');
                    this.loadUsers();
                },
                error: (err) => {
                    console.error('Error creating user:', err);
                    this.messageService.showError('Error al crear el usuario');
                }
            });
        }
    }

    async deleteUser(user: User): Promise<void> {
        const confirmed = await this.messageService.confirm(
            '¿Eliminar usuario?',
            `¿Estás seguro de que quieres eliminar a "${user.name}"? Esta acción no se puede deshacer.`
        );

        if (!confirmed) return;

        this.userService.delete(user.id).subscribe({
            next: () => {
                this.messageService.showSuccess('Usuario eliminado correctamente');
                this.loadUsers();
            },
            error: (err) => {
                console.error('Error deleting user:', err);
                this.messageService.showError('Error al eliminar el usuario');
            }
        });
    }

    getRoleBadgeClass(role: string): string {
        switch (role) {
            case 'ADMIN': return 'badge-admin';
            case 'CHEF': return 'badge-chef';
            case 'USER': return 'badge-user';
            default: return '';
        }
    }

    countByRole(role: string): number {
        return this.filteredUsers.filter(u => u.role === role).length;
    }

    getExistingUsers(): string[] {
        return this.users.map(u => u.user);
    }
}
