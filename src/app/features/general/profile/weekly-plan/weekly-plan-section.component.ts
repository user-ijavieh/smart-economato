import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnInit, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { MessageService } from '../../../../core/services/message.service';
import { RecipeService } from '../../../../core/services/recipe.service';
import { UserService } from '../../../../core/services/user.service';
import { WeeklyPlanService } from '../../../../core/services/weekly-plan.service';
import { Recipe } from '../../../../shared/models/recipe.model';
import { Page } from '../../../../shared/models/page.model';
import { User } from '../../../../shared/models/user.model';
import {
  StudentMetrics,
  WeeklyPlanPage,
  WeeklyPlanRequest,
  WeeklyPlanResponse,
  WeeklyPlanSlotResponse,
  WeeklyPlanSlotStudentResponse,
  WeeklyPlanStockRequirement
} from '../../../../shared/models/weekly-plan.model';
import { WeeklyPlanCalendarViewComponent } from './requirements/weekly-plan-calendar-view.component';
import { WeeklyPlanFormComponent } from './requirements/weekly-plan-form.component';
import { WeeklyPlanDuplicateComponent } from './requirements/weekly-plan-duplicate.component';
import { WeeklyPlanConfirmationComponent } from './slot-actions/weekly-plan-confirmation.component';
import { WeeklyPlanHistoryComponent } from './history/weekly-plan-history.component';
import { WeeklyPlanStockRequirementsPanelComponent } from './stock/weekly-plan-stock-requirements-panel.component';
import { WeeklyPlanStudentMetricsPanelComponent } from './stock/weekly-plan-student-metrics-panel.component';
import { WEEKLY_PLAN_STATUS_LABELS, getWeeklyPlanStatusClass } from './weekly-plan.constants';
import { Role } from '../../../../shared/models/role-permissions';

@Component({
  selector: 'app-weekly-plan-section',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    WeeklyPlanCalendarViewComponent,
    WeeklyPlanFormComponent,
    WeeklyPlanDuplicateComponent,
    WeeklyPlanConfirmationComponent,
    WeeklyPlanHistoryComponent,
    WeeklyPlanStockRequirementsPanelComponent,
    WeeklyPlanStudentMetricsPanelComponent
  ],
  templateUrl: './weekly-plan-section.component.html',
  styleUrl: './weekly-plan-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeeklyPlanSectionComponent implements OnInit, OnChanges {
  @Input() currentUser: User | null = null;

  private authService = inject(AuthService);
  private weeklyPlanService = inject(WeeklyPlanService);
  private recipeService = inject(RecipeService);
  private userService = inject(UserService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

  role: Role | null = null;
  roleLabel = '';
  currentRole: Role | null = null;
  accessMessage = '';

  activeTab: 'current' | 'history' = 'current';
  detailPlan: WeeklyPlanResponse | null = null;
  detailReadOnly = true;

  currentPlan: WeeklyPlanResponse | null = null;
  loadingCurrent = false;

  historyPlans: WeeklyPlanResponse[] = [];
  historyLoading = false;
  historyPage = 0;
  historyTotalPages = 0;
  historyTotalElements = 0;
  historyStatusFilter = '';

  showFormModal = false;
  formMode: 'create' | 'edit' = 'create';
  formPlan: WeeklyPlanResponse | null = null;
  formSaving = false;
  formActivating = false;

  showDuplicateModal = false;
  duplicatePlan: WeeklyPlanResponse | null = null;
  duplicateSaving = false;

  showStockModal = false;
  stockLoading = false;
  stockRequirements: WeeklyPlanStockRequirement[] = [];

  showMetricsModal = false;
  metricsLoading = false;
  metrics: StudentMetrics[] = [];
  metricsPage = 0;
  metricsTotalPages = 0;
  metricsTotalElements = 0;
  selectedChefId: number | null = null;
  chefs: Array<{ id: number; name: string }> = [];

  recipes: Recipe[] = [];
  students: User[] = [];
  teachers: User[] = [];
  auxDataLoaded = false;
  loadingAuxData = false;

  // Confirmation dialogs
  showConfirmDialog = false;
  confirmAction: 'confirmSlot' | 'confirmDay' | 'cancelSlot' | 'cancelStudent' | null = null;
  confirmDialogTitle = '';
  confirmDialogMessage = '';
  confirmDialogDetails: string[] = [];
  confirmDialogConfirmText = '';
  confirmDialogDangerous = false;
  confirmDialogLoading = false;
  pendingConfirmationSlot: WeeklyPlanSlotResponse | null = null;
  pendingConfirmationDay: number | null = null;
  pendingConfirmationStudent: WeeklyPlanSlotStudentResponse | null = null;

  private previousRole: Role | null = null;
  private previousChefId: number | null = null;

  ngOnInit(): void {
    this.applyRoleContext();
  }

  ngOnChanges(_: SimpleChanges): void {
    this.applyRoleContext();
  }

  private applyRoleContext(): void {
    const role = (this.currentUser?.role || this.authService.getRole() || 'USER') as Role;
    const chefId = this.currentUser?.teacher?.id || null;

    // Evitar recargar si nada ha cambiado
    if (this.previousRole === role && this.previousChefId === chefId) {
      return;
    }

    this.previousRole = role;
    this.previousChefId = chefId;

    this.role = role;
    this.currentRole = role;
    this.roleLabel = role;

    if (role === 'USER') {
      this.accessMessage = 'No tienes acceso a esta funcionalidad.';
      this.currentPlan = null;
      this.historyPlans = [];
      this.detailPlan = null;
      this.cdr.markForCheck();
      return;
    }

    this.accessMessage = '';

    if (role === 'ADMIN') {
      this.activeTab = 'history';
      this.loadHistory();
      return;
    }

    if (role === 'ELEVATED' && !this.currentUser?.teacher) {
      this.accessMessage = 'No tienes un profesor asignado. Pide a un administrador que revise tu cuenta.';
      this.currentPlan = null;
      this.cdr.markForCheck();
      return;
    }

    if (role === 'CHEF' || role === 'ELEVATED') {
      this.activeTab = 'current';
      this.loadCurrentPlan();
    }

    this.cdr.markForCheck();
  }

  get canCreatePlan(): boolean {
    return this.role === 'ADMIN' || this.role === 'CHEF';
  }

  get canEditPlan(): boolean {
    return this.role === 'ADMIN' || this.role === 'CHEF' || this.role === 'ELEVATED';
  }

  get canActivatePlan(): boolean {
    return this.role === 'ADMIN' || this.role === 'CHEF';
  }

  get canViewSensitivePanels(): boolean {
    return this.role === 'ADMIN' || this.role === 'CHEF';
  }

  get canShowChefSelector(): boolean {
    return this.role === 'ADMIN';
  }

  get selectedPlanForReadOnly(): WeeklyPlanResponse | null {
    return this.detailPlan || this.currentPlan;
  }

  get currentStatusLabel(): string {
    return this.currentPlan ? WEEKLY_PLAN_STATUS_LABELS[this.currentPlan.status] || this.currentPlan.status : '';
  }

  get currentStatusClass(): string {
    return this.currentPlan ? getWeeklyPlanStatusClass(this.currentPlan.status) : '';
  }

  get chefOptions(): Array<{ id: number; name: string }> {
    return this.teachers.map(teacher => ({ id: teacher.id, name: teacher.name }));
  }

  switchTab(tab: 'current' | 'history'): void {
    this.activeTab = tab;
    if (tab === 'history' && this.historyPlans.length === 0 && this.role !== 'USER') {
      this.loadHistory();
    }
  }

  openCreateForm(): void {
    if (!this.canCreatePlan) {
      return;
    }

    this.ensureAuxiliaryData().then(() => {
      this.formMode = 'create';
      this.formPlan = null;
      this.showFormModal = true;
      this.cdr.markForCheck();
    });
  }

  openEditForm(plan: WeeklyPlanResponse | null = null): void {
    if (!plan && !this.currentPlan) {
      return;
    }

    const target = plan || this.currentPlan;
    if (!target) {
      return;
    }

    this.ensureAuxiliaryData().then(() => {
      this.formMode = 'edit';
      this.formPlan = target;
      this.showFormModal = true;
      this.cdr.markForCheck();
    });
  }

  openDetail(plan: WeeklyPlanResponse): void {
    this.detailPlan = plan;
    this.detailReadOnly = true;
    this.cdr.markForCheck();
  }

  closeDetail(): void {
    this.detailPlan = null;
    this.cdr.markForCheck();
  }

  closeForm(): void {
    this.showFormModal = false;
    this.formPlan = null;
    this.cdr.markForCheck();
  }

  openDuplicate(plan: WeeklyPlanResponse): void {
    if (plan.status === 'DRAFT') {
      this.messageService.showError('No puedes duplicar un plan en borrador. Primero actívalo.');
      return;
    }

    this.duplicatePlan = plan;
    this.showDuplicateModal = true;
    this.cdr.markForCheck();
  }

  closeDuplicate(): void {
    this.showDuplicateModal = false;
    this.duplicatePlan = null;
    this.cdr.markForCheck();
  }

  doDuplicate(request: WeeklyPlanRequest): void {
    this.duplicateSaving = true;
    this.weeklyPlanService.createPlan(request).pipe(
      finalize(() => {
        this.duplicateSaving = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (newPlan) => {
        this.messageService.showSuccess(`Plan duplicado correctamente. Nueva semana: ${newPlan.weekStartDate}`);
        this.showDuplicateModal = false;
        this.duplicatePlan = null;
        this.refreshAfterMutation(newPlan.id, newPlan.chefId);
      },
      error: (error) => {
        this.messageService.showError(error.error?.message || 'No se pudo duplicar el plan.');
      }
    });
  }

  saveDraft(request: WeeklyPlanRequest): void {
    this.formSaving = true;
    const requestPlan = this.formMode === 'edit' && this.formPlan?.id
      ? this.weeklyPlanService.updatePlan(this.formPlan.id, request)
      : this.weeklyPlanService.createPlan(request);

    requestPlan.pipe(finalize(() => {
      this.formSaving = false;
      this.cdr.markForCheck();
    })).subscribe({
      next: (plan) => {
        this.messageService.showSuccess('Plan guardado correctamente.');
        this.showFormModal = false;
        this.formPlan = null;
        this.refreshAfterMutation(plan.id, plan.chefId);
      },
      error: (error) => {
        this.messageService.showError(error.error?.message || 'No se pudo guardar el plan.');
      }
    });
  }

  activatePlan(request: WeeklyPlanRequest): void {
    if (!this.formPlan?.id) {
      this.messageService.showError('Primero guarda el plan como borrador.');
      return;
    }

    this.formSaving = true;
    this.weeklyPlanService.updatePlan(this.formPlan.id, request).pipe(
      finalize(() => {
        this.formSaving = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.formActivating = true;
        this.weeklyPlanService.activatePlan(this.formPlan!.id).pipe(
          finalize(() => {
            this.formActivating = false;
            this.cdr.markForCheck();
          })
        ).subscribe({
          next: (plan) => {
            this.messageService.showSuccess('Plan activado correctamente.');
            this.showFormModal = false;
            this.formPlan = null;
            this.refreshAfterMutation(plan.id, plan.chefId);
          },
          error: (error) => this.messageService.showError(error.error?.message || 'No se pudo activar el plan.')
        });
      },
      error: (error) => this.messageService.showError(error.error?.message || 'No se pudo guardar el plan.')
    });
  }

  confirmSlot(slot: WeeklyPlanSlotResponse): void {
    if (!this.selectedPlanForReadOnly && !this.currentPlan) {
      return;
    }

    const plan = this.selectedPlanForReadOnly || this.currentPlan;
    if (!plan) {
      return;
    }

    // Show confirmation dialog
    this.confirmDialogTitle = `Confirmar ${slot.recipeName}`;
    this.confirmDialogMessage = `¿Confirmar este slot? Se descontará stock del inventario y no se podrá revertir.`;
    this.confirmDialogDetails = [
      `Receta: ${slot.recipeName}`,
      `Cantidad: ${slot.quantity}`,
      `Horario: ${slot.startTime} - ${slot.endTime}`,
      `Estudiantes: ${slot.students.length || 'Sin asignar'}`
    ];
    this.confirmDialogConfirmText = 'Confirmar';
    this.confirmDialogDangerous = true;
    this.confirmAction = 'confirmSlot';
    this.pendingConfirmationSlot = slot;
    this.showConfirmDialog = true;
    this.cdr.markForCheck();
  }

  doConfirmSlot(): void {
    if (!this.pendingConfirmationSlot) {
      return;
    }

    const plan = this.selectedPlanForReadOnly || this.currentPlan;
    if (!plan) {
      return;
    }

    this.confirmDialogLoading = true;
    this.weeklyPlanService.confirmSlot(plan.id, this.pendingConfirmationSlot.id).pipe(
      finalize(() => {
        this.confirmDialogLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.messageService.showSuccess('Slot confirmado correctamente.');
        this.closeConfirmDialog();
        this.reloadPlan(plan.id);
      },
      error: (error) => this.messageService.showError(error.error?.message || 'No se pudo confirmar el slot.')
    });
  }

  cancelSlot(slot: WeeklyPlanSlotResponse): void {
    const plan = this.selectedPlanForReadOnly || this.currentPlan;
    if (!plan) {
      return;
    }

    // Show confirmation dialog
    this.confirmDialogTitle = `Cancelar ${slot.recipeName}`;
    this.confirmDialogMessage = `¿Cancelar este slot? Todos los estudiantes asignados también serán cancelados.`;
    this.confirmDialogDetails = [
      `Receta: ${slot.recipeName}`,
      `Cantidad: ${slot.quantity}`,
      `Estudiantes afectados: ${slot.students.length || 'Ninguno'}`
    ];
    this.confirmDialogConfirmText = 'Cancelar slot';
    this.confirmDialogDangerous = true;
    this.confirmAction = 'cancelSlot';
    this.pendingConfirmationSlot = slot;
    this.showConfirmDialog = true;
    this.cdr.markForCheck();
  }

  doCancelSlot(): void {
    if (!this.pendingConfirmationSlot) {
      return;
    }

    const plan = this.selectedPlanForReadOnly || this.currentPlan;
    if (!plan) {
      return;
    }

    this.confirmDialogLoading = true;
    this.weeklyPlanService.cancelSlot(plan.id, this.pendingConfirmationSlot.id).pipe(
      finalize(() => {
        this.confirmDialogLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.messageService.showSuccess('Slot cancelado correctamente.');
        this.closeConfirmDialog();
        this.reloadPlan(plan.id);
      },
      error: (error) => this.messageService.showError(error.error?.message || 'No se pudo cancelar el slot.')
    });
  }

  confirmDay(dayOfWeek: number): void {
    const plan = this.selectedPlanForReadOnly || this.currentPlan;
    if (!plan) {
      return;
    }

    const dayName = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][dayOfWeek] || `Día ${dayOfWeek}`;
    const slotsForDay = plan.slots.filter(s => s.dayOfWeek === dayOfWeek && s.status !== 'CANCELLED');

    // Show confirmation dialog
    this.confirmDialogTitle = `Confirmar todos los slots de ${dayName}`;
    this.confirmDialogMessage = `¿Confirmar los ${slotsForDay.length} slot(s) del ${dayName}? Se descontará stock del inventario.`;
    this.confirmDialogDetails = slotsForDay.map(s => `${s.recipeName} (${s.startTime}-${s.endTime})`);
    this.confirmDialogConfirmText = 'Confirmar día';
    this.confirmDialogDangerous = true;
    this.confirmAction = 'confirmDay';
    this.pendingConfirmationDay = dayOfWeek;
    this.showConfirmDialog = true;
    this.cdr.markForCheck();
  }

  doConfirmDay(): void {
    if (this.pendingConfirmationDay === null) {
      return;
    }

    const plan = this.selectedPlanForReadOnly || this.currentPlan;
    if (!plan) {
      return;
    }

    this.confirmDialogLoading = true;
    this.weeklyPlanService.confirmDay(plan.id, this.pendingConfirmationDay).pipe(
      finalize(() => {
        this.confirmDialogLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.messageService.showSuccess('Día confirmado correctamente.');
        this.closeConfirmDialog();
        this.reloadPlan(plan.id);
      },
      error: (error) => this.messageService.showError(error.error?.message || 'No se pudo confirmar el día.')
    });
  }

  cancelStudent(event: { slot: WeeklyPlanSlotResponse; student: WeeklyPlanSlotStudentResponse }): void {
    const plan = this.selectedPlanForReadOnly || this.currentPlan;
    if (!plan) {
      return;
    }

    // Show confirmation dialog
    this.confirmDialogTitle = `Cancelar estudiante`;
    this.confirmDialogMessage = `¿Cancelar la asistencia de ${event.student.studentName} en ${event.slot.recipeName}?`;
    this.confirmDialogDetails = [
      `Estudiante: ${event.student.studentName}`,
      `Slot: ${event.slot.recipeName} (${event.slot.startTime}-${event.slot.endTime})`
    ];
    this.confirmDialogConfirmText = 'Cancelar';
    this.confirmDialogDangerous = false;
    this.confirmAction = 'cancelStudent';
    this.pendingConfirmationSlot = event.slot;
    this.pendingConfirmationStudent = event.student;
    this.showConfirmDialog = true;
    this.cdr.markForCheck();
  }

  doCancelStudent(): void {
    if (!this.pendingConfirmationSlot || !this.pendingConfirmationStudent) {
      return;
    }

    const plan = this.selectedPlanForReadOnly || this.currentPlan;
    if (!plan) {
      return;
    }

    this.confirmDialogLoading = true;
    this.weeklyPlanService.cancelStudentFromSlot(plan.id, this.pendingConfirmationSlot.id, this.pendingConfirmationStudent.studentId).pipe(
      finalize(() => {
        this.confirmDialogLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.messageService.showSuccess('Estudiante cancelado correctamente.');
        this.closeConfirmDialog();
        this.reloadPlan(plan.id);
      },
      error: (error) => this.messageService.showError(error.error?.message || 'No se pudo cancelar el estudiante.')
    });
  }

  closeConfirmDialog(): void {
    this.showConfirmDialog = false;
    this.confirmAction = null;
    this.pendingConfirmationSlot = null;
    this.pendingConfirmationDay = null;
    this.pendingConfirmationStudent = null;
    this.confirmDialogLoading = false;
    this.cdr.markForCheck();
  }

  onConfirmDialogConfirmed(): void {
    switch (this.confirmAction) {
      case 'confirmSlot':
        this.doConfirmSlot();
        break;
      case 'confirmDay':
        this.doConfirmDay();
        break;
      case 'cancelSlot':
        this.doCancelSlot();
        break;
      case 'cancelStudent':
        this.doCancelStudent();
        break;
    }
  }

  openStockRequirements(plan: WeeklyPlanResponse | null = null): void {
    if (!this.canViewSensitivePanels) {
      return;
    }

    const target = plan || this.currentPlan || this.detailPlan;
    if (!target) {
      return;
    }

    this.showStockModal = true;
    this.stockLoading = true;
    this.weeklyPlanService.getStockRequirements(target.id).pipe(
      finalize(() => {
        this.stockLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (requirements) => {
        this.stockRequirements = requirements;
      },
      error: (error) => {
        this.messageService.showError(error.error?.message || 'No se pudieron cargar los requisitos de stock.');
        this.showStockModal = false;
      }
    });
  }

  openMetrics(): void {
    if (!this.canViewSensitivePanels) {
      return;
    }

    this.ensureAuxiliaryData().then(() => {
      this.showMetricsModal = true;
      this.loadMetrics();
    });
  }

  onMetricsChefChange(chefId: number | null): void {
    this.selectedChefId = chefId;
    this.metricsPage = 0;
    this.loadMetrics();
  }

  onMetricsPageChange(page: number): void {
    this.metricsPage = page;
    this.loadMetrics();
  }

  loadMetrics(): void {
    if (!this.canViewSensitivePanels) {
      return;
    }

    this.metricsLoading = true;
    this.weeklyPlanService.getStudentMetrics(this.role === 'ADMIN' ? this.selectedChefId : this.currentPlan?.chefId ?? this.currentUser?.id ?? null, this.metricsPage, 10, 'studentName,asc').pipe(
      finalize(() => {
        this.metricsLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (page) => {
        this.metrics = page.content;
        this.metricsPage = page.number;
        this.metricsTotalPages = page.totalPages;
        this.metricsTotalElements = page.totalElements;
      },
      error: (error) => {
        this.messageService.showError(error.error?.message || 'No se pudieron cargar las métricas.');
        this.showMetricsModal = false;
      }
    });
  }

  loadHistory(page = 0): void {
    this.historyLoading = true;
    this.historyPage = page;
    this.weeklyPlanService.getAllPlans(page, 10, 'weekStartDate,desc').pipe(
      finalize(() => {
        this.historyLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (response) => {
        const filtered = this.historyStatusFilter ? response.content.filter(plan => plan.status === this.historyStatusFilter) : response.content;
        this.historyPlans = filtered;
        this.historyTotalPages = response.totalPages;
        this.historyTotalElements = this.historyStatusFilter ? filtered.length : response.totalElements;
      },
      error: (error) => {
        this.messageService.showError(error.error?.message || 'No se pudo cargar el historial.');
      }
    });
  }

  onHistoryFilterChange(status: string): void {
    this.historyStatusFilter = status;
    this.loadHistory(0);
  }

  onHistoryPageChange(page: number): void {
    this.loadHistory(page);
  }

  loadCurrentPlan(): void {
    if (this.role === 'ADMIN') {
      return;
    }

    this.loadingCurrent = true;
    this.weeklyPlanService.getCurrentWeekPlan().pipe(
      finalize(() => {
        this.loadingCurrent = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (plan) => {
        this.currentPlan = plan;
      },
      error: (error) => {
        this.currentPlan = null;
        // 404 es normal cuando no hay plan activo - no mostrar como error
        if (error.status !== 404) {
          this.messageService.showError(error.error?.message || 'No se pudo cargar el plan semanal.');
        }
      }
    });
  }

  reloadPlan(planId: number): void {
    this.weeklyPlanService.getPlanById(planId).subscribe({
      next: (plan) => {
        if (this.currentPlan?.id === plan.id) {
          this.currentPlan = plan;
        }
        if (this.detailPlan?.id === plan.id) {
          this.detailPlan = plan;
        }
        this.loadHistory(this.historyPage);
        this.cdr.markForCheck();
      },
      error: (error) => this.messageService.showError(error.error?.message || 'No se pudo recargar el plan.')
    });
  }

  private refreshAfterMutation(planId: number, chefId: number): void {
    this.reloadPlan(planId);
    if (this.role === 'ADMIN') {
      this.loadHistory(this.historyPage);
      this.selectedChefId = chefId;
    }
  }

  private ensureAuxiliaryData(): Promise<void> {
    if (this.auxDataLoaded || this.loadingAuxData) {
      return Promise.resolve();
    }

    this.loadingAuxData = true;
    return new Promise(resolve => {
      forkJoin({
        recipes: this.recipeService.getAll(0, 200, 'name,asc').pipe(catchError(() => of({ content: [] as Recipe[] } as Page<Recipe>))),
        teachers: this.userService.getTeachers().pipe(catchError(() => of([] as User[]))),
        students: this.loadStudentsForForm()
      }).pipe(
        finalize(() => {
          this.loadingAuxData = false;
          this.cdr.markForCheck();
          resolve();
        })
      ).subscribe({
        next: ({ recipes, teachers, students }) => {
          this.recipes = recipes.content || [];
          this.teachers = teachers;
          this.students = students;
          this.auxDataLoaded = true;
        },
        error: () => {
          this.recipes = [];
          this.teachers = [];
          this.students = [];
        }
      });
    });
  }

  private loadStudentsForForm() {
    if (this.role === 'ADMIN') {
      return this.userService.getByRole('USER').pipe(catchError(() => of([] as User[])));
    }

    if (this.role === 'CHEF') {
      return this.userService.getMyStudents().pipe(catchError(() => of([] as User[])));
    }

    if (this.role === 'ELEVATED') {
      const currentStudents = (this.currentPlan?.slots || this.detailPlan?.slots || [])
        .flatMap(slot => slot.students || [])
        .map(student => ({
          id: student.studentId,
          name: student.studentName,
          user: String(student.studentId),
          role: 'USER' as const
        }));

      return of(currentStudents);
    }

    return of([] as User[]);
  }
}