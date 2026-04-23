import { Component, OnDestroy, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../shared/models/user.model';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';
import { finalize } from 'rxjs';
import { Subscription } from 'rxjs';
import { WebSocketService } from '../../../core/services/websocket.service';
import { UserPresenceSnapshot } from '../../../shared/models/presence.model';
import { UserActivityService } from '../../../core/services/user-activity.service';
import { UserActivityLogResponse } from '../../../shared/models/user-activity.model';
import { MessageService } from '../../../core/services/message.service';
import { LoggerService } from '../../../core/services/logger.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseModalComponent, TranslateModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit, OnDestroy {
  private logger = inject(LoggerService);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private webSocketService = inject(WebSocketService);
  private userActivityService = inject(UserActivityService);
  private messageService = inject(MessageService);
  private translate = inject(TranslateService);
  private presenceSubscription?: Subscription;

  currentUser: User | null = null;
  userInitials: string = '';
  isChef: boolean = false;
  
  students: (User & { initials?: string })[] = [];
  loadingStudents = false;
  studentPresence: UserPresenceSnapshot[] = [];
  studentSearchTerm = '';
  studentsPage = 0;
  studentsPageSize = 50;
  studentsTotalPages = 1;
  studentsTotalElements = 0;

  activityLogs: UserActivityLogResponse[] = [];
  activityPage = 0;
  activitySize = 10;
  activityLoading = false;
  activityHasMore = true;
  
  // Modal
  showEscalateModal = false;
  selectedStudent: User | null = null;
  durationInput = 60;
  
  // Control de estado loading por botón de alumno
  processingIds = new Set<number>();

  get filteredStudents(): (User & { initials?: string })[] {
    const term = this.studentSearchTerm.trim().toLowerCase();
    if (!term) {
      return this.students;
    }
    return this.students.filter(student =>
      student.name.toLowerCase().includes(term)
    );
  }

  get pagedFilteredStudents(): (User & { initials?: string })[] {
    const start = this.studentsPage * this.studentsPageSize;
    return this.filteredStudents.slice(start, start + this.studentsPageSize);
  }

  get filteredStudentsTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredStudents.length / this.studentsPageSize));
  }

  ngOnInit(): void {
    const role = this.authService.getRole();
    this.isChef = role === 'CHEF';

    this.loadCurrentUser();

    if (this.isChef) {
      this.loadStudents();
      this.presenceSubscription = this.webSocketService.studentPresence$.subscribe((presence) => {
        this.studentPresence = presence ?? [];
        this.cdr.detectChanges();
      });
      this.loadStudentsActivity(true);
    }
  }

  ngOnDestroy(): void {
    this.presenceSubscription?.unsubscribe();
  }

  loadCurrentUser() {
    this.currentUser = {
      id: this.authService.getUserId() || 0,
      name: this.authService.getName() || this.translate.instant('COMMON.USER'),
      role: (this.authService.getRole() as any) || 'USER',
      user: '' 
    };
    
    this.userInitials = this.getInitials(this.currentUser.name);
    this.cdr.detectChanges();
    
    const id = this.authService.getUserId();
    if(id) {
        this.userService.getById(id).subscribe({
           next: (user) => { 
               this.currentUser = user; 
               this.userInitials = this.getInitials(this.currentUser.name);
               this.cdr.detectChanges();
           }
        });
    }
  }

  loadStudents(): void {
    this.loadingStudents = true;
    this.cdr.detectChanges();

    this.userService.getMyStudents().subscribe({
      next: (data) => {
        this.students = (data || []).map(s => ({
          ...s,
          initials: this.getInitials(s.name)
        }));
        this.studentsTotalElements = this.students.length;
        this.studentsTotalPages = Math.max(1, Math.ceil(this.studentsTotalElements / this.studentsPageSize));
        if (this.studentsPage >= this.studentsTotalPages) {
          this.studentsPage = this.studentsTotalPages - 1;
        }
        this.sortStudents();
        this.loadingStudents = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.logger.error('Error al cargar alumnos', err);
        this.loadingStudents = false;
        this.cdr.detectChanges();
      }
    });
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  isProcessing(id: number): boolean {
    return this.processingIds.has(id);
  }

  getOnlineStudentsCount(): number {
    const studentIds = new Set(this.filteredStudents.map(student => student.id));
    return this.studentPresence.filter(presence => studentIds.has(presence.userId)).length;
  }

  prevStudentsPage(): void {
    if (this.studentsPage <= 0) {
      return;
    }
    this.studentsPage -= 1;
  }

  nextStudentsPage(): void {
    if (this.studentsPage >= this.filteredStudentsTotalPages - 1) {
      return;
    }
    this.studentsPage += 1;
  }

  onStudentSearchChange(): void {
    this.studentsPage = 0;
  }

  private sortStudents(): void {
    this.students.sort((a, b) => {
      const aElevated = a.role === 'ELEVATED';
      const bElevated = b.role === 'ELEVATED';

      if (aElevated !== bElevated) {
        return aElevated ? -1 : 1;
      }

      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    });
  }

  openEscalateModal(student: User) {
    this.selectedStudent = student;
    this.durationInput = 60; // default 1h
    this.showEscalateModal = true;
    this.cdr.detectChanges();
  }

  closeEscalateModal() {
    this.showEscalateModal = false;
    this.selectedStudent = null;
    this.cdr.detectChanges();
  }

  confirmEscalate() {
    if (!this.selectedStudent) return;
    
    if (!this.durationInput || this.durationInput < 1) {
       this.messageService.showError(this.translate.instant('PROFILE.INVALID_DURATION'));
       return;
    }

    const studentId = this.selectedStudent.id;
    this.processingIds.add(studentId);
    this.cdr.detectChanges();
    this.userService.escalateRoles(studentId, this.durationInput)
      .pipe(finalize(() => {
        this.processingIds.delete(studentId);
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.closeEscalateModal();
          this.loadStudents();
        },
        error: (err) => {
          this.logger.error(err);
          this.messageService.showError(this.translate.instant('PROFILE.ESCALATE_ERROR'));
        }
      });
  }

  async deescalate(student: User): Promise<void> {
    const confirmed = await this.messageService.confirm(
      this.translate.instant('PROFILE.DEESCALATE_CONFIRM_TITLE'),
      this.translate.instant('PROFILE.DEESCALATE_CONFIRM_MSG', { name: student.name })
    );

    if (!confirmed) {
      return;
    }

    this.processingIds.add(student.id);
    this.cdr.detectChanges();
    this.userService.deescalateRoles(student.id)
      .pipe(finalize(() => {
        this.processingIds.delete(student.id);
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.loadStudents();
        },
        error: (err) => {
          this.logger.error(err);
          this.messageService.showError(this.translate.instant('PROFILE.DEESCALATE_ERROR'));
        }
      });
  }

  getStudentPresence(studentId: number): UserPresenceSnapshot | undefined {
    return this.studentPresence.find(p => p.userId === studentId);
  }

  getStudentCurrentScreen(presence: UserPresenceSnapshot): string {
    const screen = presence.tabs?.[0]?.screen;
    return this.translateScreenName(screen);
  }

  getStudentLastActivity(presence: UserPresenceSnapshot): string {
    const sorted = [...(presence.tabs ?? [])].sort((a, b) =>
      new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
    );
    return sorted[0]?.lastActivityAt ?? presence.connectedSince;
  }

  loadStudentsActivity(reset = false): void {
    if (this.activityLoading) return;

    if (reset) {
      this.activityLogs = [];
      this.activityPage = 0;
      this.activityHasMore = true;
    }

    if (!this.activityHasMore) return;

    this.activityLoading = true;
    this.userActivityService.getMyStudentsActivity(this.activityPage, this.activitySize, 'timestamp,desc').subscribe({
      next: (page) => {
        this.activityLogs = [...this.activityLogs, ...(page.content ?? [])];
        this.activityPage += 1;
        this.activityHasMore = !page.last;
        this.activityLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.logger.error('Error loading students activity', err);
        this.activityLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  formatActivityAction(action: string): string {
    switch (action) {
      case 'CONNECTED':
        return this.translate.instant('PROFILE.ACTIVITY.CONNECTED');
      case 'DISCONNECTED':
        return this.translate.instant('PROFILE.ACTIVITY.DISCONNECTED');
      case 'SCREEN_CHANGED':
        return this.translate.instant('PROFILE.ACTIVITY.SCREEN_CHANGED');
      default:
        return action;
    }
  }

  formatActivityScreen(screen?: string | null, context?: string | null): string {
    const label = this.translateScreenName(screen);
    const detail = (context || '').trim();
    return detail ? `${label} · ${detail}` : label;
  }

  private translateScreenName(screen?: string | null): string {
    if (!screen) return this.translate.instant('PROFILE.SCREENS.NONE');

    const key = `PROFILE.SCREENS.${screen}`;
    const translated = this.translate.instant(key);
    
    // If translation doesn't exist, fallback to original or format it
    if (translated === key) {
        return screen.replaceAll('_', ' ');
    }
    
    return translated;
  }
}
