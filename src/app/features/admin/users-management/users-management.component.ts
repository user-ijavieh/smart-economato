import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, switchMap } from 'rxjs';
import { UserService } from '../../../core/services/user.service';
import { MessageService } from '../../../core/services/message.service';
import { User, UserRequest, BatchAssignResponse } from '../../../shared/models/user.model';
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

    serverCurrentPage = 0;
    serverTotalPages = 0;
    serverTotalElements = 0;

    // Modal state
    showFormModal = false;
    selectedUser: User | null = null;

    // Mobile detail modal state
    showMobileModal = false;
    selectedUserForMobile: User | null = null;

    // View state
    showingHidden = false;

    // Sorting state
    sortColumn = 'name';
    sortDir: 'asc' | 'desc' = 'asc';
    sortInteracted = false;

    // ── Tab state ──
    activeTab: 'users' | 'assignments' = 'users';

    // ── Assignments state ──
    unassignedStudents: User[] = [];
    teachers: User[] = [];
    teachersLoaded = false;
    pendingAssignments: Map<number, User[]> = new Map(); // teacherId → students pendientes
    loadingAssignments = false;
    assignmentsLoaded = false;
    assigningInProgress = false;
    dragOverTeacherId: number | null = null;
    dragOverUnassigned = false;
    draggedStudent: User | null = null;

    ngOnInit(): void {
        this.loadUsers();
        this.loadTeachers();
    }

    loadTeachers(force = false): void {
        if (this.teachersLoaded && !force) return;

        this.userService.getTeachers().subscribe({
            next: (teachers) => {
                this.teachers = teachers;
                this.teachersLoaded = true;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading teachers:', err);
                this.messageService.showError('Error al cargar los profesores');
            }
        });
    }

    loadUsers(page: number = 0): void {
        this.loading = true;
        this.currentPage = page;
        this.serverCurrentPage = page;
        
        // Removed array clear to prevent layout shift during pagination/sorting
        this.cdr.detectChanges();

        const sortParam = `${this.sortColumn},${this.sortDir}`;

        if (this.showingHidden) {
            // Load hidden users
            this.userService.getHidden(this.currentPage, this.pageSize, sortParam).subscribe({
                next: (pageData) => {
                    this.users = pageData.content;
                    this.serverTotalElements = pageData.totalElements;
                    this.serverTotalPages = pageData.totalPages;
                    this.applySearchFilter(true);
                    this.loading = false;
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Error loading hidden users:', err);
                    this.messageService.showError('Error al cargar los usuarios desactivados');
                    this.loading = false;
                }
            });
        } else if (this.roleFilter) {
            // Role endpoint returns User[], we must do frontend pagination
            this.userService.getByRole(this.roleFilter, sortParam).subscribe({
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
            this.userService.getAll(this.currentPage, this.pageSize, sortParam).subscribe({
                next: (pageData) => {
                    this.users = pageData.content;
                    this.serverTotalElements = pageData.totalElements;
                    this.serverTotalPages = pageData.totalPages;
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

    onSortChange(column: string): void {
        this.sortInteracted = true;
        if (this.sortColumn === column) {
            this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDir = 'asc';
        }
        this.currentPage = 0;
        this.loadUsers(0);
    }

    getSortDir(column: string): string {
        if (!this.sortInteracted && this.sortColumn !== column) return 'none';
        return this.sortColumn === column ? this.sortDir : 'none';
    }

    applySearchFilter(isPrePaginated: boolean = false): void {
        let result = [...this.users];

        // Apply search if present
        if (this.searchTerm.trim()) {
            const term = this.searchTerm.toLowerCase();
            result = result.filter(u =>
                u.name.toLowerCase().includes(term) ||
                u.user.toLowerCase().includes(term)
            );
        }

        // Apply frontend sorting for role filter as it returns User[] unpaged
        if (this.roleFilter) {
            const factor = this.sortDir === 'asc' ? 1 : -1;
            result.sort((a, b) => {
                let valA = (a as any)[this.sortColumn];
                let valB = (b as any)[this.sortColumn];
                
                if (typeof valA === 'string') {
                    return valA.localeCompare(valB) * factor;
                }
                return (valA - valB) * factor;
            });
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
                this.totalPages = 1;
                this.currentPage = 0;
            } else {
                this.totalPages = this.serverTotalPages;
                this.currentPage = this.serverCurrentPage;
                this.totalElements = this.serverTotalElements;
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
            this.scrollToTop();
            this.loadUsers(newPage);
        }
    }

    private scrollToTop(): void {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const container = document.querySelector('.contenedor-principal');
        if (container) {
            container.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    // ── Tab switching ──

    switchTab(tab: 'users' | 'assignments'): void {
        if (this.activeTab === tab) return;
        this.activeTab = tab;
        this.scrollToTop();
        if (tab === 'assignments' && !this.assignmentsLoaded) {
            this.loadAssignmentData();
        }
    }

    // ── Assignments data loading ──

    loadAssignmentData(): void {
        this.loadingAssignments = true;
        this.cdr.detectChanges();

        const teachers$ = this.teachersLoaded
            ? of(this.teachers)
            : this.userService.getTeachers();

        forkJoin({
            students: this.userService.getUnassignedStudents(),
            teachers: teachers$
        }).subscribe({
            next: ({ students, teachers }) => {
                this.unassignedStudents = students;
                this.teachers = teachers;
                this.teachersLoaded = true;
                this.pendingAssignments = new Map();
                this.loadingAssignments = false;
                this.assignmentsLoaded = true;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading assignment data:', err);
                this.messageService.showError('Error al cargar los datos de asignacion');
                this.loadingAssignments = false;
                this.cdr.detectChanges();
            }
        });
    }

    // ── Drag and Drop (HTML5 nativo) ──

    onDragStart(event: DragEvent, student: User): void {
        this.draggedStudent = student;
        event.dataTransfer?.setData('text/plain', student.id.toString());
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
        }
    }

    onDragOverTeacher(event: DragEvent, teacherId: number): void {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
        this.dragOverTeacherId = teacherId;
    }

    onDragOverUnassigned(event: DragEvent): void {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
        this.dragOverUnassigned = true;
    }

    onDragLeave(): void {
        this.dragOverTeacherId = null;
        this.dragOverUnassigned = false;
    }

    onDragEnd(): void {
        this.draggedStudent = null;
        this.dragOverTeacherId = null;
        this.dragOverUnassigned = false;
    }

    onDrop(event: DragEvent, teacherId: number): void {
        event.preventDefault();
        this.dragOverTeacherId = null;

        const studentId = Number(event.dataTransfer?.getData('text/plain'));
        if (!studentId) return;

        let studentIndex = this.unassignedStudents.findIndex(s => s.id === studentId);
        let student: User | undefined;

        if (studentIndex !== -1) {
            student = this.unassignedStudents[studentIndex];
            this.unassignedStudents.splice(studentIndex, 1);
        } else {
            for (const [tid, students] of this.pendingAssignments) {
                const idx = students.findIndex(s => s.id === studentId);
                if (idx !== -1) {
                    student = students[idx];
                    students.splice(idx, 1);
                    if (students.length === 0) this.pendingAssignments.delete(tid);
                    break;
                }
            }
        }

        if (!student) return;

        if (!this.pendingAssignments.has(teacherId)) {
            this.pendingAssignments.set(teacherId, []);
        }

        const existing = this.pendingAssignments.get(teacherId)!;
        if (!existing.find(s => s.id === student.id)) {
            existing.push(student);
        }

        this.draggedStudent = null;
        this.cdr.detectChanges();
    }

    onDropBackToUnassigned(event: DragEvent): void {
        event.preventDefault();
        this.dragOverUnassigned = false;

        const studentId = Number(event.dataTransfer?.getData('text/plain'));
        if (!studentId) return;

        for (const [tid, students] of this.pendingAssignments) {
            const idx = students.findIndex(s => s.id === studentId);
            if (idx !== -1) {
                const student = students[idx];
                students.splice(idx, 1);
                if (students.length === 0) this.pendingAssignments.delete(tid);

                if (!this.unassignedStudents.find(s => s.id === student.id)) {
                    this.unassignedStudents.push(student);
                }
                break;
            }
        }

        this.draggedStudent = null;
        this.cdr.detectChanges();
    }

    removeFromTeacher(student: User, teacherId: number): void {
        const students = this.pendingAssignments.get(teacherId);
        if (!students) return;

        const idx = students.findIndex(s => s.id === student.id);
        if (idx !== -1) {
            students.splice(idx, 1);
            if (students.length === 0) this.pendingAssignments.delete(teacherId);
            if (!this.unassignedStudents.find(s => s.id === student.id)) {
                this.unassignedStudents.push(student);
            }
            this.cdr.detectChanges();
        }
    }

    // ── Assignment helpers ──

    getPendingForTeacher(teacherId: number): User[] {
        return this.pendingAssignments.get(teacherId) || [];
    }

    hasPendingAssignments(): boolean {
        for (const students of this.pendingAssignments.values()) {
            if (students.length > 0) return true;
        }
        return false;
    }

    get totalPendingCount(): number {
        let count = 0;
        for (const students of this.pendingAssignments.values()) {
            count += students.length;
        }
        return count;
    }

    clearPendingAssignments(): void {
        for (const students of this.pendingAssignments.values()) {
            for (const student of students) {
                if (!this.unassignedStudents.find(s => s.id === student.id)) {
                    this.unassignedStudents.push(student);
                }
            }
        }
        this.pendingAssignments = new Map();
        this.cdr.detectChanges();
    }

    // ── Confirm assignments ──

    confirmAssignments(): void {
        if (!this.hasPendingAssignments() || this.assigningInProgress) return;

        this.assigningInProgress = true;
        this.cdr.detectChanges();

        const requests: { teacherId: number; studentIds: number[] }[] = [];
        for (const [teacherId, students] of this.pendingAssignments) {
            if (students.length > 0) {
                requests.push({ teacherId, studentIds: students.map(s => s.id) });
            }
        }

        forkJoin(
            requests.map(req => this.userService.assignTeacherBatch(req.teacherId, req.studentIds))
        ).subscribe({
            next: (responses: BatchAssignResponse[]) => {
                const totalProcessed = responses.reduce((sum, r) => sum + r.processedCount, 0);
                const totalFailed = responses.reduce((sum, r) => sum + (r.failedStudentIds?.length || 0), 0);

                if (totalFailed > 0) {
                    this.messageService.showWarning(`${totalProcessed} alumnos asignados, ${totalFailed} fallaron`);
                } else {
                    this.messageService.showSuccess(`${totalProcessed} alumnos asignados correctamente`);
                }

                this.assigningInProgress = false;
                this.pendingAssignments = new Map();
                this.loadAssignmentData();
            },
            error: (err) => {
                console.error('Error assigning students:', err);
                this.messageService.showError('Error al asignar los alumnos');
                this.assigningInProgress = false;
                this.cdr.detectChanges();
            }
        });
    }

    // ── Modal operations ──

    openCreateModal(): void {
        this.selectedUser = null;
        this.showFormModal = true;
    }

    openEditModal(user: User): void {
        this.loadTeachers();

        const hasTeacherProperty = Object.prototype.hasOwnProperty.call(user, 'teacher');
        if (hasTeacherProperty) {
            this.selectedUser = { ...user };
            this.showFormModal = true;
            return;
        }

        this.userService.getById(user.id).subscribe({
            next: (fullUser) => {
                this.selectedUser = { ...fullUser };
                this.showFormModal = true;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading user details:', err);
                this.messageService.showError('No se pudieron cargar los datos completos del usuario');
            }
        });
    }

    closeFormModal(): void {
        this.showFormModal = false;
        this.selectedUser = null;
    }

    openMobileModal(user: User): void {
        this.selectedUserForMobile = user;
        this.showMobileModal = true;
    }

    closeMobileModal(): void {
        this.showMobileModal = false;
        this.selectedUserForMobile = null;
    }

    onSaveUser(data: any): void {
        if (this.selectedUser) {
            const userId = this.selectedUser.id;
            const originalTeacherId = this.selectedUser.teacher?.id ?? null;
            const request: UserRequest = {
                name: data.name,
                user: data.user,
                role: data.role
            };

            if (data.password) {
                request.password = data.password;
            }

            const hasTeacherPayload = Object.prototype.hasOwnProperty.call(data, 'teacherId');
            const nextTeacherId = hasTeacherPayload
                ? (data.teacherId === '' || data.teacherId === undefined ? null : Number(data.teacherId))
                : originalTeacherId;

            this.userService.update(userId, request).pipe(
                switchMap(() => {
                    if (!hasTeacherPayload || nextTeacherId === originalTeacherId) {
                        return of(null);
                    }
                    return this.userService.assignTeacher(userId, nextTeacherId);
                })
            ).subscribe({
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
            const hasTeacherPayload = Object.prototype.hasOwnProperty.call(data, 'teacherId');
            const teacherId = hasTeacherPayload
                ? (data.teacherId === '' || data.teacherId === undefined ? null : Number(data.teacherId))
                : null;

            this.userService.create(request).pipe(
                switchMap((createdUser) => {
                    if (!teacherId || !createdUser?.id) {
                        return of(null);
                    }
                    return this.userService.assignTeacher(createdUser.id, teacherId);
                })
            ).subscribe({
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
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error(`Error ${actionText} usuario:`, err);
                const errorMessage = err.error?.message || `Error al ${actionText} el usuario`;
                this.messageService.showError(errorMessage);
                this.cdr.detectChanges();
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

    isStudentRole(role: string): boolean {
        return role === 'USER' || role === 'ELEVATED';
    }
}
