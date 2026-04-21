import { Component, OnDestroy, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, switchMap, takeUntil } from 'rxjs';
import { Subscription } from 'rxjs';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { UserService } from '../../../core/services/user.service';
import { MessageService } from '../../../core/services/message.service';
import { User, UserRequest, BatchAssignResponse } from '../../../shared/models/user.model';
import { UserFormModalComponent } from './user-form-modal/user-form-modal.component';
import { ScrollService } from '../../../core/services/scroll.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { UserPresenceSnapshot } from '../../../shared/models/presence.model';
import { UserActivityService } from '../../../core/services/user-activity.service';
import { UserActivityLogResponse } from '../../../shared/models/user-activity.model';
import { PresenceTrackingService } from '../../../core/services/presence-tracking.service';
import { SyncCacheInvalidationService } from '../../../core/services/sync-cache-invalidation.service';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';
import { SEARCH_DEBOUNCE_MS } from '../../../core/constants/search.constants';

@Component({
    selector: 'app-users-management',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        UserFormModalComponent,
        BaseModalComponent,
        TranslateModule
    ],
    templateUrl: './users-management.component.html',
    styleUrl: './users-management.component.css'
})
export class UsersManagementComponent implements OnInit, OnDestroy {
    private userService = inject(UserService);
    private cdr = inject(ChangeDetectorRef);
    private scrollService = inject(ScrollService);
    private webSocketService = inject(WebSocketService);
    private userActivityService = inject(UserActivityService);
    private presenceTrackingService = inject(PresenceTrackingService);
    private syncCacheInvalidationService = inject(SyncCacheInvalidationService);
    private translate = inject(TranslateService);
    messageService = inject(MessageService);
    private destroy$ = new Subject<void>();
    private presenceSubscription?: Subscription;
    private searchSubscription?: Subscription;
    private searchSubject = new Subject<string>();
    private assignmentSearchSubscription?: Subscription;
    private assignmentSearchSubject = new Subject<string>();
    private wsActivityRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    private lastActivityRefreshAt = 0;

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
    teacherStudentsForDetail: User[] = [];
    loadingTeacherStudentsForDetail = false;

    // View state
    showingHidden = false;

    // Sorting state
    sortColumn = 'name';
    sortDir: 'asc' | 'desc' = 'asc';
    sortInteracted = false;

    // ── Tab state ──
    activeTab: 'users' | 'assignments' | 'presence' = 'users';

    // ── Presence + Activity state ──
    connectedSnapshots: UserPresenceSnapshot[] = [];
    onlineUsers: User[] = [];
    private presenceUsersById: Map<number, User> = new Map();
    private presenceCatalogLoaded = false;
    activityLogs: UserActivityLogResponse[] = [];
    activityPage = 0;
    activitySize = 20;
    activityLoading = false;
    activityHasMore = true;
    activityInitialized = false;
    private readonly minActivityRefreshIntervalMs = 10000;

    // ── Assignments state ──
    unassignedStudents: User[] = [];
    filteredUnassignedStudents: User[] = [];
    visibleUnassignedStudents: User[] = [];
    teachers: User[] = [];
    teachersLoaded = false;
    pendingAssignments: Map<number, User[]> = new Map(); // teacherId → students pendientes
    loadingAssignments = false;
    assignmentsLoaded = false;
    assigningInProgress = false;
    assignmentStudentSearchTerm = '';
    unassignedPageSize = 20;
    unassignedHasMore = false;
    unassignedLoadingMore = false;
    dragOverTeacherId: number | null = null;
    dragOverUnassigned = false;
    draggedStudent: User | null = null;
    draggedStudentIds: number[] = [];
    selectedStudentIds: Set<number> = new Set();
    lastSelectedIndex: number | null = null;

    ngOnInit(): void {
        this.searchSubscription = this.searchSubject.pipe(
            debounceTime(SEARCH_DEBOUNCE_MS),
            distinctUntilChanged()
        ).subscribe(() => {
            this.currentPage = 0;
            this.loadUsers(0);
        });

        this.assignmentSearchSubscription = this.assignmentSearchSubject.pipe(
            debounceTime(SEARCH_DEBOUNCE_MS),
            distinctUntilChanged()
        ).subscribe(() => {
            this.refreshUnassignedStudentsView(true);
            this.cdr.detectChanges();
        });

        this.loadUsers();
        this.loadTeachers();
        this.loadPresenceUsersCatalog();

        this.presenceSubscription = this.webSocketService.adminPresence$.subscribe((snapshots) => {
            this.connectedSnapshots = snapshots ?? [];
            this.updateOnlineUsers();
            this.scheduleActivityRefreshFromWebSocket();
            this.cdr.detectChanges();
        });

        this.syncCacheInvalidationService.invalidatedDomains$
            .pipe(takeUntil(this.destroy$))
            .subscribe(({ domains }) => {
                if (domains.includes('user')) {
                    this.loadUsers(this.currentPage);
                    this.loadPresenceUsersCatalog(true);
                }
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.presenceSubscription?.unsubscribe();
        this.searchSubscription?.unsubscribe();
        this.assignmentSearchSubscription?.unsubscribe();
        this.searchSubject.complete();
        this.assignmentSearchSubject.complete();
        if (this.wsActivityRefreshTimer) {
            clearTimeout(this.wsActivityRefreshTimer);
            this.wsActivityRefreshTimer = null;
        }
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
                this.messageService.showError(this.translate.instant('USERS.MESSAGES.ERROR_LOADING_TEACHERS'));
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
                    this.mergeUsersInPresenceIndex(this.users);
                    this.serverTotalElements = pageData.totalElements;
                    this.serverTotalPages = pageData.totalPages;
                    this.applySearchFilter(true);
                    this.loading = false;
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Error loading hidden users:', err);
                    this.messageService.showError(this.translate.instant('USERS.MESSAGES.ERROR_LOADING_HIDDEN_USERS'));
                    this.loading = false;
                }
            });
        } else if (this.roleFilter) {
            // Role endpoint returns User[], we must do frontend pagination
            this.userService.getByRole(this.roleFilter, sortParam).subscribe({
                next: (users) => {
                    this.users = users;
                    this.mergeUsersInPresenceIndex(this.users);
                    this.applySearchFilter();
                    this.loading = false;
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Error loading users:', err);
                    this.messageService.showError(this.translate.instant('USERS.MESSAGES.LOAD_USERS_ERROR'));
                    this.loading = false;
                }
            });
        } else {
            // Normal getAll returns Page<User>
            this.userService.getAll(this.currentPage, this.pageSize, sortParam).subscribe({
                next: (pageData) => {
                    this.users = pageData.content;
                    this.mergeUsersInPresenceIndex(this.users);
                    this.serverTotalElements = pageData.totalElements;
                    this.serverTotalPages = pageData.totalPages;
                    this.applySearchFilter(true); // Is pre-paginated
                    this.loading = false;
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Error loading users:', err);
                    this.messageService.showError(this.translate.instant('USERS.MESSAGES.LOAD_USERS_ERROR'));
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

        this.updateOnlineUsers();
    }

    private updateOnlineUsers(): void {
        const connectedIds = Array.from(new Set(
            this.connectedSnapshots
                .map(snapshot => snapshot.userId)
                .filter((id): id is number => typeof id === 'number')
        ));

        const missingIds = connectedIds.filter(id => !this.presenceUsersById.has(id));
        if (missingIds.length > 0) {
            this.loadMissingPresenceUsers(missingIds);
        }

        this.onlineUsers = connectedIds
            .map(id => this.presenceUsersById.get(id))
            .filter((user): user is User => !!user)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    private mergeUsersInPresenceIndex(users: User[]): void {
        for (const user of users) {
            if (!user?.id) continue;
            this.presenceUsersById.set(user.id, user);
        }
    }

    private loadPresenceUsersCatalog(force = false): void {
        if (this.presenceCatalogLoaded && !force) {
            return;
        }

        this.userService.getAll(0, 500, 'name,asc').subscribe({
            next: (pageData) => {
                this.mergeUsersInPresenceIndex(pageData.content || []);
                this.presenceCatalogLoaded = true;
                this.updateOnlineUsers();
                this.cdr.detectChanges();
            },
            error: () => {
                // Keep presence running with incremental user resolution.
            }
        });
    }

    private loadMissingPresenceUsers(userIds: number[]): void {
        if (!userIds.length) {
            return;
        }

        forkJoin(userIds.map(id => this.userService.getById(id))).subscribe({
            next: (users) => {
                this.mergeUsersInPresenceIndex(users);
                this.onlineUsers = Array.from(new Set(this.connectedSnapshots.map(s => s.userId)))
                    .filter((id): id is number => typeof id === 'number')
                    .map(id => this.presenceUsersById.get(id))
                    .filter((user): user is User => !!user)
                    .sort((a, b) => a.name.localeCompare(b.name));
                this.cdr.detectChanges();
            },
            error: () => {
                // Ignore missing users here and keep available rows.
            }
        });
    }

    onSearch(): void {
        this.searchSubject.next(this.searchTerm);
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
            this.scrollService.scrollToTop();
            this.loadUsers(newPage);
        }
    }

    // ── Tab switching ──

    switchTab(tab: 'users' | 'assignments' | 'presence'): void {
        if (this.activeTab === tab) return;
        this.clearSelection();
        this.activeTab = tab;
        this.scrollService.scrollToTop();
        if (tab === 'assignments' && !this.assignmentsLoaded) {
            this.loadAssignmentData();
        }
        if (tab === 'presence' && !this.activityInitialized) {
            this.loadActivity(true);
        }
    }

    loadActivity(reset = false): void {
        if (this.activityLoading) return;

        this.lastActivityRefreshAt = Date.now();

        if (reset) {
            this.activityLogs = [];
            this.activityPage = 0;
            this.activityHasMore = true;
        }

        if (!this.activityHasMore) return;

        this.activityLoading = true;
        this.userActivityService.getAllActivity(this.activityPage, this.activitySize, 'timestamp,desc').subscribe({
            next: (page) => {
                const incoming = page.content ?? [];
                this.activityLogs = [...this.activityLogs, ...incoming];
                this.activityPage += 1;
                this.activityHasMore = !page.last;
                this.activityInitialized = true;
                this.activityLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading user activity:', err);
                this.messageService.showError(this.translate.instant('USERS.MESSAGES.ERROR_LOADING_ACTIVITY'));
                this.activityLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    onActivityScroll(event: Event): void {
        if (this.activityLoading || !this.activityHasMore) return;

        const target = event.target as HTMLElement;
        const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 120;
        if (nearBottom) {
            this.loadActivity(false);
        }
    }

    private scheduleActivityRefreshFromWebSocket(): void {
        if (!this.activityInitialized || this.activeTab !== 'presence') {
            return;
        }

        if (this.activityLoading) {
            return;
        }

        const elapsed = Date.now() - this.lastActivityRefreshAt;
        if (elapsed >= this.minActivityRefreshIntervalMs) {
            this.loadActivity(true);
            return;
        }

        if (this.wsActivityRefreshTimer) {
            return;
        }

        const delay = this.minActivityRefreshIntervalMs - elapsed;
        this.wsActivityRefreshTimer = setTimeout(() => {
            this.wsActivityRefreshTimer = null;
            if (this.activeTab === 'presence' && this.activityInitialized && !this.activityLoading) {
                this.loadActivity(true);
            }
        }, delay);
    }

    getPresenceForUser(userId: number): UserPresenceSnapshot | undefined {
        return this.connectedSnapshots.find(snapshot => snapshot.userId === userId);
    }

    getCurrentScreen(snapshot: UserPresenceSnapshot): string {
        const screen = snapshot.tabs?.[0]?.screen;
        return this.translateScreenName(screen);
    }

    getLastHeartbeat(snapshot: UserPresenceSnapshot): string {
        const sorted = [...(snapshot.tabs ?? [])].sort((a, b) =>
            new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
        );
        return sorted[0]?.lastActivityAt ?? snapshot.connectedSince;
    }

    formatActivityScreen(log: UserActivityLogResponse): string {
        const screenLabel = this.translateScreenName(log.screen);
        const context = (log.screenContext || '').trim();
        return context ? `${screenLabel} · ${context}` : screenLabel;
    }

    private translateScreenName(screen?: string | null): string {
        if (!screen) return this.translate.instant('USERS.PRESENCE.NO_DATA');

        const map: Record<string, string> = {
            DASHBOARD: 'NAV.DASHBOARD',
            USER_MANAGEMENT: 'NAV.USERS',
            PRODUCT_MANAGEMENT: 'NAV.PRODUCTS',
            ORDER_MANAGEMENT: 'NAV.ORDERS',
            STOCK_MANAGEMENT: 'NAV.STOCK',
            RECIPE_MANAGEMENT: 'NAV.RECIPES',
            NOTIFICATIONS_MANAGEMENT: 'NAV.NOTIFICATIONS',
            INCIDENTS: 'NAV.INCIDENTS',
            ORDERS: 'NAV.ORDERS_SIMPLE',
            ORDER_RECEPTION: 'NAV.ORDER_RECEPTION',
            RECIPES: 'NAV.RECIPES_SIMPLE',
            INVENTORY: 'NAV.INVENTORY',
            PROFILE: 'NAV.PROFILE'
        };

        const key = map[screen];
        return key ? this.translate.instant(key) : screen.replaceAll('_', ' ');
    }

    formatActivityAction(action: string): string {
        switch (action) {
            case 'CONNECTED':
                return this.translate.instant('USERS.PRESENCE.ACTIONS.CONNECTED');
            case 'DISCONNECTED':
                return this.translate.instant('USERS.PRESENCE.ACTIONS.DISCONNECTED');
            case 'SCREEN_CHANGED':
                return this.translate.instant('USERS.PRESENCE.ACTIONS.SCREEN_CHANGED');
            default:
                return action;
        }
    }

    trackByActivityId(index: number, item: UserActivityLogResponse): number {
        return item.id ?? index;
    }

    // ── Assignments data loading ──

    loadAssignmentData(): void {
        this.loadingAssignments = true;
        this.clearSelection();
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
                this.assignmentStudentSearchTerm = '';
                this.teachers = teachers;
                this.teachersLoaded = true;
                this.pendingAssignments = new Map();
                this.refreshUnassignedStudentsView(true);
                this.clearSelection();
                this.loadingAssignments = false;
                this.assignmentsLoaded = true;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading assignment data:', err);
                this.messageService.showError(this.translate.instant('USERS.MESSAGES.ERROR_LOADING_ASSIGNMENTS'));
                this.loadingAssignments = false;
                this.cdr.detectChanges();
            }
        });
    }

    // ── Drag and Drop (HTML5 nativo) ──

    onDragStart(event: DragEvent, student: User): void {
        this.draggedStudent = student;
        if (!this.selectedStudentIds.has(student.id)) {
            this.clearSelection();
            this.selectedStudentIds.add(student.id);
            this.lastSelectedIndex = this.unassignedStudents.findIndex(s => s.id === student.id);
        }

        this.draggedStudentIds = Array.from(this.selectedStudentIds);
        if (this.draggedStudentIds.length === 0) {
            this.draggedStudentIds = [student.id];
        }

        event.dataTransfer?.setData('text/plain', JSON.stringify(this.draggedStudentIds));
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';

            const dragBadge = document.createElement('div');
            const studentsLabel = this.draggedStudentIds.length > 1 
                ? this.translate.instant('USERS.ASSIGNMENTS.STUDENTS_PLURAL') 
                : this.translate.instant('USERS.ASSIGNMENTS.STUDENT_SINGULAR');
            dragBadge.textContent = `${this.draggedStudentIds.length} ${studentsLabel}`;
            dragBadge.style.position = 'fixed';
            dragBadge.style.top = '-1000px';
            dragBadge.style.left = '-1000px';
            dragBadge.style.padding = '8px 12px';
            dragBadge.style.borderRadius = '999px';
            dragBadge.style.background = 'rgba(90, 120, 220, 0.95)';
            dragBadge.style.color = 'white';
            dragBadge.style.fontSize = '12px';
            dragBadge.style.fontWeight = '600';
            dragBadge.style.boxShadow = '0 6px 18px rgba(0,0,0,0.35)';
            document.body.appendChild(dragBadge);
            event.dataTransfer.setDragImage(dragBadge, 20, 20);
            setTimeout(() => dragBadge.remove(), 0);
        }
    }

    private getDraggedIds(event: DragEvent): number[] {
        const rawData = event.dataTransfer?.getData('text/plain');
        if (rawData) {
            try {
                const parsed = JSON.parse(rawData);
                if (Array.isArray(parsed)) {
                    return parsed.map(id => Number(id)).filter(id => Number.isFinite(id) && id > 0);
                }
                const asNumber = Number(parsed);
                if (Number.isFinite(asNumber) && asNumber > 0) {
                    return [asNumber];
                }
            } catch {
                const asNumber = Number(rawData);
                if (Number.isFinite(asNumber) && asNumber > 0) {
                    return [asNumber];
                }
            }
        }
        return this.draggedStudentIds;
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
        this.draggedStudentIds = [];
        this.dragOverTeacherId = null;
        this.dragOverUnassigned = false;
    }

    onDrop(event: DragEvent, teacherId: number): void {
        event.preventDefault();
        this.dragOverTeacherId = null;

        const studentIds = this.getDraggedIds(event);
        if (!studentIds.length) return;

        for (const studentId of studentIds) {
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

            if (!student) continue;

            if (!this.pendingAssignments.has(teacherId)) {
                this.pendingAssignments.set(teacherId, []);
            }

            const existing = this.pendingAssignments.get(teacherId)!;
            if (!existing.find(s => s.id === student.id)) {
                existing.push(student);
            }
        }

        this.draggedStudent = null;
        this.draggedStudentIds = [];
        this.refreshUnassignedStudentsView();
        this.clearSelection();
        this.cdr.detectChanges();
    }

    onDropBackToUnassigned(event: DragEvent): void {
        event.preventDefault();
        this.dragOverUnassigned = false;

        const studentIds = this.getDraggedIds(event);
        if (!studentIds.length) return;

        for (const studentId of studentIds) {
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
        }

        this.draggedStudent = null;
        this.draggedStudentIds = [];
        this.refreshUnassignedStudentsView();
        this.clearSelection();
        this.cdr.detectChanges();
    }

    onAssignmentSearch(): void {
        this.assignmentSearchSubject.next(this.assignmentStudentSearchTerm);
    }

    onUnassignedScroll(event: Event): void {
        if (this.unassignedLoadingMore || !this.unassignedHasMore) {
            return;
        }

        const target = event.target as HTMLElement;
        const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 80;
        if (nearBottom) {
            this.loadMoreUnassignedStudents();
        }
    }

    private refreshUnassignedStudentsView(resetPagination = false): void {
        const term = this.assignmentStudentSearchTerm.trim().toLowerCase();
        this.filteredUnassignedStudents = term
            ? this.unassignedStudents.filter(student => student.name.toLowerCase().includes(term))
            : [...this.unassignedStudents];

        const validIds = new Set(this.filteredUnassignedStudents.map(student => student.id));
        for (const selectedId of Array.from(this.selectedStudentIds)) {
            if (!validIds.has(selectedId)) {
                this.selectedStudentIds.delete(selectedId);
            }
        }

        if (this.lastSelectedIndex !== null && this.lastSelectedIndex >= this.filteredUnassignedStudents.length) {
            this.lastSelectedIndex = null;
        }

        const currentVisible = resetPagination ? 0 : this.visibleUnassignedStudents.length;
        const visibleCount = Math.min(currentVisible, this.filteredUnassignedStudents.length);
        this.visibleUnassignedStudents = this.filteredUnassignedStudents.slice(0, visibleCount);
        this.unassignedHasMore = visibleCount < this.filteredUnassignedStudents.length;

        if (resetPagination || visibleCount === 0) {
            this.loadMoreUnassignedStudents();
        }
    }

    private loadMoreUnassignedStudents(): void {
        if (this.unassignedLoadingMore || !this.unassignedHasMore && this.visibleUnassignedStudents.length > 0) {
            return;
        }

        if (this.filteredUnassignedStudents.length === 0) {
            this.unassignedHasMore = false;
            return;
        }

        this.unassignedLoadingMore = true;

        const start = this.visibleUnassignedStudents.length;
        const end = Math.min(start + this.unassignedPageSize, this.filteredUnassignedStudents.length);
        const nextChunk = this.filteredUnassignedStudents.slice(start, end);
        this.visibleUnassignedStudents = [...this.visibleUnassignedStudents, ...nextChunk];
        this.unassignedHasMore = end < this.filteredUnassignedStudents.length;

        this.unassignedLoadingMore = false;
    }

    toggleStudentSelection(student: User, event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();

        const currentIndex = this.filteredUnassignedStudents.findIndex(s => s.id === student.id);
        if (currentIndex === -1) {
            return;
        }

        if (event.shiftKey && this.lastSelectedIndex !== null) {
            const start = Math.min(this.lastSelectedIndex, currentIndex);
            const end = Math.max(this.lastSelectedIndex, currentIndex);
            for (let i = start; i <= end; i++) {
                this.selectedStudentIds.add(this.unassignedStudents[i].id);
            }
        } else if (event.ctrlKey || event.metaKey) {
            if (this.selectedStudentIds.has(student.id)) {
                this.selectedStudentIds.delete(student.id);
            } else {
                this.selectedStudentIds.add(student.id);
            }
        } else {
            if (this.selectedStudentIds.has(student.id) && this.selectedStudentIds.size === 1) {
                this.selectedStudentIds.delete(student.id);
            } else {
                this.selectedStudentIds.clear();
                this.selectedStudentIds.add(student.id);
            }
        }

        this.lastSelectedIndex = this.selectedStudentIds.has(student.id) ? currentIndex : null;
    }

    selectAllStudents(): void {
        if (this.isAllSelected) {
            this.clearSelection();
            return;
        }

        this.selectedStudentIds.clear();
        for (const student of this.filteredUnassignedStudents) {
            this.selectedStudentIds.add(student.id);
        }
        this.lastSelectedIndex = this.filteredUnassignedStudents.length ? this.filteredUnassignedStudents.length - 1 : null;
    }

    clearSelection(): void {
        this.selectedStudentIds.clear();
        this.lastSelectedIndex = null;
    }

    get isAllSelected(): boolean {
        return this.filteredUnassignedStudents.length > 0
            && this.filteredUnassignedStudents.every(student => this.selectedStudentIds.has(student.id));
    }

    get selectionCount(): number {
        return this.unassignedStudents.reduce((count, student) => {
            return this.selectedStudentIds.has(student.id) ? count + 1 : count;
        }, 0);
    }

    isSelected(studentId: number): boolean {
        return this.selectedStudentIds.has(studentId);
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
            this.refreshUnassignedStudentsView();
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
        this.refreshUnassignedStudentsView();
        this.cdr.detectChanges();
    }

    // ── Confirm assignments ──

    confirmAssignments(): void {
        if (!this.hasPendingAssignments() || this.assigningInProgress) return;

        this.clearSelection();
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
                    this.messageService.showWarning(this.translate.instant('USERS.MESSAGES.BATCH_PARTIAL_SUCCESS', { processed: totalProcessed, failed: totalFailed }));
                } else {
                    this.messageService.showSuccess(this.translate.instant('USERS.MESSAGES.BATCH_SUCCESS', { count: totalProcessed }));
                }

                this.assigningInProgress = false;
                this.pendingAssignments = new Map();
                this.loadAssignmentData();
            },
            error: (err) => {
                console.error('Error assigning students:', err);
                this.messageService.showError(this.translate.instant('USERS.MESSAGES.ERROR_ASSIGNING'));
                this.assigningInProgress = false;
                this.cdr.detectChanges();
            }
        });
    }

    // ── Modal operations ──

    openCreateModal(): void {
        this.selectedUser = null;
        this.showFormModal = true;
        this.presenceTrackingService.reportModal(this.translate.instant('USERS.MODAL.CREATE_TITLE'));
    }

    openEditModal(user: User): void {
        this.loadTeachers();

        const hasTeacherProperty = Object.prototype.hasOwnProperty.call(user, 'teacher');
        if (hasTeacherProperty) {
            this.selectedUser = { ...user };
            this.showFormModal = true;
            this.presenceTrackingService.reportModal(this.translate.instant('USERS.MODAL.EDIT_TITLE'), user.name);
            return;
        }

        this.userService.getById(user.id).subscribe({
            next: (fullUser) => {
                this.selectedUser = { ...fullUser };
                this.showFormModal = true;
                this.presenceTrackingService.reportModal(this.translate.instant('USERS.MODAL.EDIT_TITLE'), fullUser.name);
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading user details:', err);
                this.messageService.showError(this.translate.instant('USERS.MESSAGES.LOAD_DETAILS_ERROR'));
            }
        });
    }

    closeFormModal(): void {
        this.showFormModal = false;
        this.selectedUser = null;
        this.presenceTrackingService.clearContext();
    }

    openMobileModal(user: User): void {
        const hasTeacherProperty = Object.prototype.hasOwnProperty.call(user, 'teacher');
        if (hasTeacherProperty) {
            this.selectedUserForMobile = { ...user };
            this.showMobileModal = true;
            this.loadTeacherStudentsForDetail();
            return;
        }

        this.userService.getById(user.id).subscribe({
            next: (fullUser) => {
                this.selectedUserForMobile = { ...fullUser };
                this.showMobileModal = true;
                this.loadTeacherStudentsForDetail();
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading user details:', err);
                this.messageService.showError(this.translate.instant('USERS.MESSAGES.LOAD_DETAILS_ERROR'));
            }
        });
    }

    closeMobileModal(): void {
        this.showMobileModal = false;
        this.selectedUserForMobile = null;
        this.teacherStudentsForDetail = [];
        this.loadingTeacherStudentsForDetail = false;
    }

    private loadTeacherStudentsForDetail(): void {
        const user = this.selectedUserForMobile;
        if (!user || user.role !== 'CHEF' || !user.id) {
            this.teacherStudentsForDetail = [];
            this.loadingTeacherStudentsForDetail = false;
            return;
        }

        this.loadingTeacherStudentsForDetail = true;
        this.teacherStudentsForDetail = [];

        this.userService.getStudentsByTeacherId(user.id).subscribe({
            next: (students) => {
                this.teacherStudentsForDetail = students;
                this.loadingTeacherStudentsForDetail = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading teacher students:', err);
                this.loadingTeacherStudentsForDetail = false;
                this.teacherStudentsForDetail = [];
                this.messageService.showError(this.translate.instant('USERS.MESSAGES.ERROR_TEACHER_STUDENTS'));
                this.cdr.detectChanges();
            }
        });
    }

    openEditFromMobile(): void {
        if (!this.selectedUserForMobile) {
            return;
        }

        // Keep mobile detail modal open and stack edit modal above it.
        this.openEditModal(this.selectedUserForMobile);
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
                    this.messageService.showSuccess(this.translate.instant('USERS.MESSAGES.UPDATE_SUCCESS'));
                    this.closeFormModal();
                    this.loadUsers();
                },
                error: (err) => {
                    console.error('Error updating user:', err);
                    this.messageService.showError(this.translate.instant('USERS.MESSAGES.UPDATE_ERROR'));
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
                    this.messageService.showSuccess(this.translate.instant('USERS.MESSAGES.CREATE_SUCCESS'));
                    this.loadUsers();
                },
                error: (err) => {
                    console.error('Error creating user:', err);
                    this.messageService.showError(this.translate.instant('USERS.MESSAGES.CREATE_ERROR'));
                }
            });
        }
    }

    toggleView(): void {
        this.showingHidden = !this.showingHidden;
        this.clearFilters(); // This will reset page to 0 and call loadUsers()
    }

    async toggleUserVisibility(user: User): Promise<void> {
        const actionTitle = this.showingHidden ? 'USERS.MESSAGES.ACTIVATE_CONFIRM_TITLE' : 'USERS.MESSAGES.DEACTIVATE_CONFIRM_TITLE';
        const actionMsg = this.showingHidden ? 'USERS.MESSAGES.ACTIVATE_CONFIRM_MSG' : 'USERS.MESSAGES.DEACTIVATE_CONFIRM_MSG';
        
        const confirmed = await this.messageService.confirm(
            this.translate.instant(actionTitle),
            this.translate.instant(actionMsg, { name: user.name })
        );

        if (!confirmed) return;

        this.userService.toggleHidden(user.id, !this.showingHidden).subscribe({
            next: () => {
                const successMsg = this.showingHidden ? 'USERS.MESSAGES.ACTIVATE_SUCCESS' : 'USERS.MESSAGES.DEACTIVATE_SUCCESS';
                this.messageService.showSuccess(this.translate.instant(successMsg));
                this.loadUsers(this.currentPage);
                this.cdr.detectChanges();
            },
            error: (err) => {
                const errorKey = this.showingHidden ? 'USERS.MESSAGES.ACTIVATE_ERROR' : 'USERS.MESSAGES.DEACTIVATE_ERROR';
                const errorMessage = err.error?.message || this.translate.instant(errorKey);
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

    getRoleLabel(role: string): string {
        switch (role) {
            case 'ADMIN': return this.translate.instant('COMMON.ROLES.ADMIN');
            case 'CHEF': return this.translate.instant('COMMON.ROLES.CHEF');
            case 'USER': return this.translate.instant('COMMON.ROLES.STUDENT');
            case 'ELEVATED': return this.translate.instant('COMMON.ROLES.STUDENT');
            default: return role;
        }
    }

    countByRole(role: string): number {
        return this.filteredUsers.filter(u => u.role === role).length;
    }

    isStudentRole(role: string): boolean {
        return role === 'USER' || role === 'ELEVATED';
    }
}
