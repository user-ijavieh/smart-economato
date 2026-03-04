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

    // Pagination state
    currentPage = 0;
    pageSize = 20;
    totalPages = 0;
    totalElements = 0;

    // Modal state
    showFormModal = false;
    selectedUser: User | null = null;

    // View state
    showingHidden = false;

    ngOnInit(): void {
        this.loadUsers();
    }

    loadUsers(page: number = 0): void {
        this.loading = true;
        this.currentPage = page;

        if (this.showingHidden) {
            // Load hidden users
            this.userService.getHidden(this.currentPage, this.pageSize).subscribe({
                next: (pageData) => {
                    this.users = pageData.content;
                    this.totalElements = pageData.totalElements;
                    this.totalPages = pageData.totalPages;
                    this.applySearchFilter(true);
                    this.loading = false;
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Error loading hidden users:', err);
                    this.messageService.showError('Error al cargar los usuarios ocultos');
                    this.loading = false;
                }
            });
        } else if (this.roleFilter) {
            // Role endpoint returns User[], we must do frontend pagination
            this.userService.getByRole(this.roleFilter).subscribe({
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
        } else {
            // Normal getAll returns Page<User>
            this.userService.getAll(this.currentPage, this.pageSize).subscribe({
                next: (pageData) => {
                    this.users = pageData.content;
                    this.totalElements = pageData.totalElements;
                    this.totalPages = pageData.totalPages;
                    this.applySearchFilter(true); // Is pre-paginated
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
    }

    applySearchFilter(isPrePaginated: boolean = false): void {
        let result = this.users;

        // Apply search if present
        if (this.searchTerm.trim()) {
            const term = this.searchTerm.toLowerCase();
            result = result.filter(u =>
                u.name.toLowerCase().includes(term) ||
                u.user.toLowerCase().includes(term)
            );
        }

        // Apply frontend pagination only if we have all records (roleFilter active)
        if (!isPrePaginated && this.roleFilter) {
            this.totalElements = result.length;
            this.totalPages = Math.ceil(this.totalElements / this.pageSize);

            const start = this.currentPage * this.pageSize;
            const end = Math.min(start + this.pageSize, this.totalElements);
            this.filteredUsers = result.slice(start, end);
        } else {
            this.filteredUsers = result;
            // If we are searching pre-paginated list, elements might be less
            if (this.searchTerm.trim()) {
                this.totalElements = result.length;
                this.totalPages = Math.ceil(this.totalElements / this.pageSize);
            }
        }
    }

    onSearch(): void {
        this.currentPage = 0;
        this.loadUsers();
    }

    onRoleFilterChange(): void {
        this.currentPage = 0;
        this.loadUsers();
    }

    clearFilters(): void {
        this.searchTerm = '';
        this.roleFilter = '';
        this.currentPage = 0;
        this.loadUsers();
    }

    hasActiveFilters(): boolean {
        return this.searchTerm.trim().length > 0 || this.roleFilter.length > 0;
    }

    changePage(delta: number): void {
        const newPage = this.currentPage + delta;
        if (newPage >= 0 && newPage < this.totalPages) {
            this.loadUsers(newPage);
        }
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

    toggleView(): void {
        this.showingHidden = !this.showingHidden;
        this.clearFilters(); // This will reset page to 0 and call loadUsers()
    }

    async toggleUserVisibility(user: User): Promise<void> {
        const actionText = this.showingHidden ? 'mostrar' : 'ocultar';
        const confirmed = await this.messageService.confirm(
            this.showingHidden ? '¿Mostrar usuario?' : '¿Ocultar usuario?',
            `¿Estás seguro de que quieres ${actionText} a "${user.name}"?`
        );

        if (!confirmed) return;

        this.userService.toggleHidden(user.id, !this.showingHidden).subscribe({
            next: () => {
                this.messageService.showSuccess(`Usuario ${this.showingHidden ? 'mostrado' : 'ocultado'} correctamente`);
                this.loadUsers(this.currentPage);
            },
            error: (err) => {
                console.error(`Error ${actionText} usuario:`, err);
                const errorMessage = err.error?.message || `Error al ${actionText} el usuario`;
                this.messageService.showError(errorMessage);
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
