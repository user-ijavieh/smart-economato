import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { WeeklyPlanService } from '../../../core/services/weekly-plan.service';
import { AuthService } from '../../../core/services/auth.service';
import { RecipeService } from '../../../core/services/recipe.service';
import { UserService } from '../../../core/services/user.service';
import { MessageService } from '../../../core/services/message.service';
import { OrderService } from '../../../core/services/order.service';
import { WeeklyPlanRequest, StudentMetrics } from '../../../shared/models/weekly-plan.model';
import { Recipe, CookableRecipe } from '../../../shared/models/recipe.model';
import { User } from '../../../shared/models/user.model';
import { SearchableDropdownComponent, SearchableItem } from '../../../shared/components/searchable-dropdown/searchable-dropdown.component';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';
import { StorageService } from '../../../core/services/storage.service';
import { LoggerService } from '../../../core/services/logger.service';

type DistributionMode = 'EQUITATIVE' | 'HISTORICAL' | 'RANDOM';

interface AutoCreateOptions {
  sessionCount: number;
  startTime: string;
  endTime: string;
  sessionDurationMinutes: number;
  platesPerSession: number;
  maxStudentsPerSession: number;
  breakStartTime: string;
  breakEndTime: string;
  useCurrentStock: boolean;
  recipeSelectionMode: 'EXCLUDE' | 'INCLUDE';
  excludedAllergenIds: number[];
  selectedRecipeIds: number[];
  excludedStudentIds: number[];
  distributionMode: DistributionMode;
}

interface WizardSlot {
  uiKey?: string;
  id?: number;
  dayOfWeek: number;
  recipeId: number | null;
  recipeName: string;
  quantity: number;
  startTime: string;
  endTime: string;
  studentIds: number[];
}

interface StockUsageRow {
  productId: number;
  productName: string;
  unit: string;
  required: number; // Neto
  grossRequired: number;
  availabilityPercentage: number;
  available: number; // Neto utilizable
  grossAvailable: number;
  reservedByOtherPlans: number;
  realAvailable: number;
  pendingOrdered: number;
  shortage: number; // Faltante bruto
}


@Component({
  selector: 'app-weekly-plan-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableDropdownComponent, BaseModalComponent, TranslateModule],
  templateUrl: './weekly-plan-wizard.component.html',
  styleUrls: ['./weekly-plan-wizard.component.css']
})
export class WeeklyPlanWizardComponent implements OnInit {
  private logger = inject(LoggerService);
  private weeklyPlanService = inject(WeeklyPlanService);
  private authService = inject(AuthService);
  private recipeService = inject(RecipeService);
  private userService = inject(UserService);
  private orderService = inject(OrderService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  private storageService = inject(StorageService);
  private translate = inject(TranslateService);
  private pendingOrdersByProduct: Record<number, number> = {};
  private pendingOrdersLookupKey = '';
  private pendingOrdersLoading = false;
  private readonly shortageEpsilon = 0.0001;
  private readonly AUTO_CREATE_STORAGE_KEY = 'weekly_plan_wizard_auto_create_options';

  currentStep = 1;
  saving = false;
  loadingInitial = false;
  private initialStateSnapshot = '';
  private nextSlotUiId = 0;

  // Edit mode
  editMode = false;
  duplicateMode = false;
  planId: number | null = null;

  // Step 1 data
  weekStartDate: string = '';
  chefId: number | null = null;
  selectedChefName: string = '';
  chefSearchItems: SearchableItem[] = [];
  chefSearchQuery: string = '';
  chefSearchPage: number = 0;
  chefSearchPageSize: number = 8;
  chefSearchHasMore: boolean = true;
  loadingChefSearch: boolean = false;
  loadingChefSearchMore: boolean = false;
  role: string | null = null;

  // Step 2 data
  slots: WizardSlot[] = [];
  collapsedParticipation = false;
  collapsedStockUsage = true;
  collapsedDays: Record<number, boolean> = {};
  collapsedSlots: Record<string, boolean> = {};
  warnedOverlapDays = new Set<number>();
  activeWarning: { key: string; message: string } | null = null;

  showAutoCreateModal = false;
  autoCreateDayOfWeek: number | null = null;
  autoCreateSessionCount = 2;
  autoCreateStartTime = '08:00';
  autoCreateEndTime = '14:00';
  autoCreateSessionDurationMinutes = 60;
  autoCreatePlatesPerSession = 1;
  autoCreateMaxStudentsPerSession = 2;
  autoCreateBreakStartTime = '';
  autoCreateBreakEndTime = '';
  autoCreateUseCurrentStock = true;
  autoCreateRecipeSelectionMode: 'EXCLUDE' | 'INCLUDE' = 'EXCLUDE';
  autoCreateExcludedAllergenIds: number[] = [];
  autoCreateSelectedRecipeIds: number[] = [];
  autoCreateExcludedStudentIds: number[] = [];
  autoCreateDistributionMode: DistributionMode = 'EQUITATIVE';
  loadingCookableRecipes = false;
  cookableRecipes: CookableRecipe[] = [];
  autoCreateRecipeSearchQuery = '';
  autoCreateRecipePage = 0;
  autoCreateRecipePageSize = 12;
  autoCreateRecipeHasMore = true;
  autoCreateRecipeLoading = false;
  autoCreateRecipeLoadingMore = false;
  autoCreateRecipeResults: SearchableItem[] = [];
  
  days = [
    { value: 1, label: 'COMMON.DAYS.MONDAY' },
    { value: 2, label: 'COMMON.DAYS.TUESDAY' },
    { value: 3, label: 'COMMON.DAYS.WEDNESDAY' },
    { value: 4, label: 'COMMON.DAYS.THURSDAY' },
    { value: 5, label: 'COMMON.DAYS.FRIDAY' },
    { value: 6, label: 'COMMON.DAYS.SATURDAY' },
    { value: 7, label: 'COMMON.DAYS.SUNDAY' }
  ];

  myStudents: User[] = [];
  studentMetrics: Record<number, StudentMetrics> = {};

  // Recipe search state
  recipeSearchResults: SearchableItem[] = [];
  recipeSearchQuery = '';
  recipePage = 0;
  recipeHasMore = true;
  loadingRecipes = false;
  loadingMoreRecipes = false;

  ngOnInit() {
    this.initializeCollapsedDays();

    this.role = this.authService.getRole();
    if (this.role === 'CHEF' || this.role === 'ELEVATED') {
      const userStr = this.storageService.get('currentUser');
      if (userStr) {
        try {
          const userObj = JSON.parse(userStr);
          this.chefId = userObj.teacher?.id || userObj.id;
        } catch(e) {}
      }
    }

    this.loadCatalogs();
    if (this.role === 'ADMIN') {
      this.loadChefPage('', true);
    }

    this.route.paramMap.subscribe(params => {
      const idStr = params.get('id');
      if (idStr) {
        this.planId = Number(idStr);
        this.editMode = true;
        this.duplicateMode = false;
        this.loadPlanForEditing();
      } else {
        const duplicateFrom = this.route.snapshot.queryParamMap.get('duplicateFrom');
        const queryChefId = this.route.snapshot.queryParamMap.get('chefId');
        if (queryChefId) {
          this.chefId = Number(queryChefId);
          this.resolveChefSelection(this.chefId);
          this.loadStudentMetricsForChef();
          this.loadStudentsForChef();
        }
        if (duplicateFrom) {
          const keepStudents = this.route.snapshot.queryParamMap.get('keepStudents') !== '0';
          const targetWeekStartDate = this.route.snapshot.queryParamMap.get('weekStartDate') || '';
          this.planId = null;
          this.editMode = false;
          this.duplicateMode = true;
          this.loadPlanForDuplication(Number(duplicateFrom), keepStudents, targetWeekStartDate);
        } else {
          this.initialStateSnapshot = this.buildStateSnapshot();
        }
      }
    });
  }

  loadCatalogs() {
    this.searchRecipes(''); // Initial load of recipes
    this.loadCookableRecipeCatalog();

    if (this.role === 'CHEF' || this.role === 'ELEVATED') {
      this.loadStudentsForChef();
    }

    if (this.chefId) {
      this.loadStudentMetricsForChef();
      if (this.role === 'ADMIN') {
        this.loadStudentsForChef();
      }
    }
  }

  private loadStudentsForChef() {
    if (!this.chefId && this.role === 'ADMIN') {
      this.myStudents = [];
      return;
    }

    const obs = (this.role === 'ADMIN' && this.chefId)
      ? this.userService.getStudentsByTeacher(this.chefId)
      : this.userService.getMyStudents();

    obs.subscribe({
      next: (students) => {
        this.myStudents = students;
        this.cdr.detectChanges();
      },
      error: () => {
        this.myStudents = [];
        this.cdr.detectChanges();
      }
    });
  }

  private loadStudentMetricsForChef() {
    if (!this.chefId) {
      this.studentMetrics = {};
      return;
    }

    this.weeklyPlanService.getStudentMetrics(this.chefId, 0, 50).subscribe({
      next: (page) => {
        const map: Record<number, StudentMetrics> = {};
        page.content.forEach(m => map[m.studentId] = m);
        this.studentMetrics = map;
        this.cdr.detectChanges();
      },
      error: () => {
        this.studentMetrics = {};
        this.cdr.detectChanges();
      }
    });
  }

  onChefSearch(query: string) {
    this.loadChefPage(query, true);
  }

  onChefScrollNearBottom() {
    if (!this.chefSearchHasMore || this.loadingChefSearch || this.loadingChefSearchMore) {
      return;
    }

    this.chefSearchPage++;
    this.loadChefPage(this.chefSearchQuery, false);
  }

  onChefSelected(item: SearchableItem) {
    this.chefId = item.id;
    this.selectedChefName = item.name;
    this.loadStudentMetricsForChef();
    this.loadStudentsForChef();
  }

  // RECIPE SEARCH
  searchRecipes(query: string) {
    this.recipeSearchQuery = query;
    this.recipePage = 0;
    this.recipeHasMore = true;
    this.loadingRecipes = true;
    
    this.recipeService.searchByName(query, this.recipePage, 10).subscribe({
      next: (page) => {
        this.recipeSearchResults = page.content.map(r => ({ id: r.id, name: r.name }));
        this.recipeHasMore = !page.last;
        this.loadingRecipes = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingRecipes = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadMoreRecipes() {
    if (!this.recipeHasMore || this.loadingMoreRecipes) return;
    this.recipePage++;
    this.loadingMoreRecipes = true;

    this.recipeService.searchByName(this.recipeSearchQuery, this.recipePage, 10).subscribe({
      next: (page) => {
        const newItems = page.content.map(r => ({ id: r.id, name: r.name }));
        this.recipeSearchResults = [...this.recipeSearchResults, ...newItems];
        this.recipeHasMore = !page.last;
        this.loadingMoreRecipes = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingMoreRecipes = false;
        this.cdr.detectChanges();
      }
    });
  }

  selectRecipeForSlot(slot: WizardSlot, item: SearchableItem) {
    slot.recipeId = item.id;
    slot.recipeName = item.name;
    this.onSlotChanged(slot);
    this.warnForRecipeAllergens(slot);
    this.cdr.detectChanges();
  }

  loadPlanForEditing() {
    if (!this.planId) return;
    this.loadingInitial = true;
    this.weeklyPlanService.getPlanById(this.planId).subscribe({
      next: (plan) => {
        this.weekStartDate = plan.weekStartDate;
        this.chefId = plan.chefId;
        this.resolveChefSelection(this.chefId);
        this.loadStudentMetricsForChef();
        this.loadStudentsForChef();
        
        this.slots = plan.slots.map(s => ({
          uiKey: `slot-${this.nextSlotUiId++}`,
          id: s.id,
          dayOfWeek: s.dayOfWeek,
          recipeId: s.recipeId,
          recipeName: s.recipeName,
          quantity: s.quantity,
          startTime: s.startTime,
          endTime: s.endTime,
          studentIds: s.students ? s.students.map(st => st.studentId) : []
        }));
        for (const slot of this.slots) {
          this.collapsedSlots[this.getSlotUiKey(slot)] = true;
        }
        this.initializeCollapsedDays();
        this.loadCookableRecipeCatalog();

        this.loadingInitial = false;
        this.initialStateSnapshot = this.buildStateSnapshot();
        this.cdr.detectChanges();
      },
      error: () => {
        this.messageService.showError(this.translate.instant('WEEKLY_PLANS.MESSAGES.LOAD_ERROR'));
        this.router.navigate([this.getBaseRoute()]);
      }
    });
  }

  loadPlanForDuplication(sourcePlanId: number, keepStudents: boolean, targetWeekStartDate: string) {
    this.loadingInitial = true;
    this.weeklyPlanService.getPlanById(sourcePlanId).subscribe({
      next: (plan) => {
        this.weekStartDate = targetWeekStartDate || this.addDaysToDate(plan.weekStartDate, 7);
        this.chefId = plan.chefId;
        this.resolveChefSelection(this.chefId);
        this.loadStudentMetricsForChef();
        this.loadStudentsForChef();
        this.slots = plan.slots.map(s => ({
          uiKey: `slot-${this.nextSlotUiId++}`,
          dayOfWeek: s.dayOfWeek,
          recipeId: s.recipeId,
          recipeName: s.recipeName,
          quantity: s.quantity,
          startTime: s.startTime,
          endTime: s.endTime,
          studentIds: keepStudents && s.students ? s.students.map(st => st.studentId) : []
        }));
        for (const slot of this.slots) {
          this.collapsedSlots[this.getSlotUiKey(slot)] = true;
        }
        this.initializeCollapsedDays();
        this.loadCookableRecipeCatalog();

        this.loadingInitial = false;
        this.initialStateSnapshot = this.buildStateSnapshot();
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingInitial = false;
        this.messageService.showError(this.translate.instant('WEEKLY_PLANS.WIZARD.LOAD_DUPLICATE_ERROR'));
        this.router.navigate([this.getBaseRoute()]);
      }
    });
  }

  nextStep() {
    if (this.currentStep === 1 && !this.weekStartDate) {
      this.messageService.showWarning(this.translate.instant('WEEKLY_PLANS.WIZARD.WEEK_START_WARN'));
      return;
    }

    if (this.currentStep === 1 && this.isPastWeek(this.weekStartDate)) {
      this.messageService.showWarning('No se puede crear un plan para una semana anterior a la actual.');
      return;
    }

    if (this.currentStep === 1 && !this.editMode && !this.duplicateMode) {
      if (this.role === 'ADMIN' && !this.chefId) {
        this.messageService.showWarning(this.translate.instant('WEEKLY_PLANS.WIZARD.CHEF_WARN'));
        return;
      }
      this.redirectToExistingPlanIfWeekTaken();
      return;
    }

    this.currentStep++;
    if (this.currentStep === 2) {
      this.loadCookableRecipeCatalog();
    }
  }

  private redirectToExistingPlanIfWeekTaken(): void {
    const selectedWeek = this.weekStartDate;
    if (!selectedWeek) {
      this.currentStep++;
      if (this.currentStep === 2) {
        this.loadCookableRecipeCatalog();
      }
      return;
    }

    this.loadingInitial = true;
    this.weeklyPlanService.getAllPlans(0, 50).subscribe({
      next: (page) => {
        const existingPlan = (page.content || []).find(plan => 
          plan.weekStartDate === selectedWeek && (!this.chefId || plan.chefId === this.chefId)
        );

        this.loadingInitial = false;
        if (existingPlan) {
          if (existingPlan.status === 'DRAFT') {
            this.messageService.showInfo(this.translate.instant('WEEKLY_PLANS.WIZARD.EXISTING_DRAFT_INFO', { week: selectedWeek }));
            this.router.navigate([this.getBaseRoute(), existingPlan.id, 'edit']);
            return;
          }

          if (existingPlan.status === 'ACTIVE' || existingPlan.status === 'IN_PROGRESS') {
            this.messageService.showError(this.translate.instant('WEEKLY_PLANS.WIZARD.EXISTING_ACTIVE_ERROR', { week: selectedWeek }));
            this.cdr.detectChanges();
            return;
          }

          this.messageService.showWarning(this.translate.instant('WEEKLY_PLANS.WIZARD.EXISTING_PLAN_WARN', { week: selectedWeek, status: existingPlan.status }));
          this.cdr.detectChanges();
          return;
        }

        this.currentStep++;
        if (this.currentStep === 2) {
          this.loadCookableRecipeCatalog();
        }
        this.cdr.detectChanges();
      },
      error: () => {
        // If verification fails, keep wizard usable and allow continuing.
        this.loadingInitial = false;
        this.currentStep++;
        if (this.currentStep === 2) {
          this.loadCookableRecipeCatalog();
        }
        this.cdr.detectChanges();
      }
    });
  }

  prevStep() {
    this.currentStep--;
  }

  addSlot() {
    this.addSlotForDay(1);
  }

  addSlotForDay(dayOfWeek: number, seed?: Partial<WizardSlot>) {
    const lastSlot = this.getDaySlots(dayOfWeek)[this.getDaySlots(dayOfWeek).length - 1];
    const startTime = lastSlot?.endTime || '10:00';
    const endTime = this.addMinutes(startTime, 120);

    const slot: WizardSlot = {
      uiKey: `slot-${this.nextSlotUiId++}`,
      recipeId: null,
      recipeName: '',
      quantity: 1,
      ...seed,
      dayOfWeek,
      startTime: seed?.startTime ?? startTime,
      endTime: seed?.endTime ?? endTime,
      studentIds: seed?.studentIds ?? []
    };

    for (const existing of this.getDaySlots(dayOfWeek)) {
      this.collapsedSlots[this.getSlotUiKey(existing)] = true;
    }

    this.slots.push(slot);
    this.collapsedSlots[this.getSlotUiKey(slot)] = false;
    this.collapsedDays[dayOfWeek] = false;
    this.onSlotChanged(slot);
  }

  removeSlot(index: number) {
    const removed = this.slots[index];
    this.slots.splice(index, 1);
    if (removed) {
      delete this.collapsedSlots[this.getSlotUiKey(removed)];
      const daySlots = this.getSlotsForDay(removed.dayOfWeek);
      if (daySlots.length === 0) {
        this.collapsedDays[removed.dayOfWeek] = false;
      }
    }
  }

  getSlotsForDay(dayOfWeek: number) {
    return this.slots.filter(slot => slot.dayOfWeek === dayOfWeek);
  }

  getDaySlots(dayOfWeek: number) {
    return this.getSlotsForDay(dayOfWeek);
  }

  toggleDay(dayOfWeek: number) {
    this.collapsedDays[dayOfWeek] = !this.isDayCollapsed(dayOfWeek);
  }

  toggleParticipation() {
    this.collapsedParticipation = !this.collapsedParticipation;
  }

  toggleStockUsage() {
    this.collapsedStockUsage = !this.collapsedStockUsage;
  }

  toggleSlot(slot: any) {
    const key = this.getSlotUiKey(slot);
    this.collapsedSlots[key] = !this.isSlotCollapsed(slot);
  }

  isParticipationCollapsed() {
    return this.collapsedParticipation;
  }

  isStockUsageCollapsed() {
    return this.collapsedStockUsage;
  }

  getSlotUiKey(slot: any) {
    if (!slot.uiKey) {
      slot.uiKey = `slot-${this.nextSlotUiId++}`;
    }

    return slot.uiKey;
  }

  isSlotCollapsed(slot: any) {
    return this.collapsedSlots[this.getSlotUiKey(slot)] ?? false;
  }

  getSlotSummary(slot: any) {
    const recipe = slot.recipeName?.trim() || this.translate.instant('WEEKLY_PLANS.WIZARD.NO_RECIPE');
    const studentsLabel = this.translate.instant('WEEKLY_PLANS.WIZARD.STUDENTS_COUNT', { count: slot.studentIds?.length || 0 });
    return `${recipe} · ${slot.startTime || '--:--'}-${slot.endTime || '--:--'} · ${studentsLabel}`;
  }

  getSlotWarningMessage(slot: WizardSlot) {
    const problems: string[] = [];

    if (!slot.recipeId) {
      problems.push(this.translate.instant('WEEKLY_PLANS.WIZARD.NO_RECIPE').toLowerCase());
    }

    if (!slot.quantity) {
      problems.push(this.translate.instant('WEEKLY_PLANS.WIZARD.NO_QUANTITY').toLowerCase());
    }

    if (!slot.startTime || !slot.endTime) {
      problems.push(this.translate.instant('WEEKLY_PLANS.WIZARD.NO_SCHEDULE').toLowerCase());
    }

    if (!slot.studentIds || slot.studentIds.length === 0) {
      problems.push(this.translate.instant('WEEKLY_PLANS.WIZARD.NO_STUDENTS').toLowerCase());
    }

    return problems.length > 0 ? this.translate.instant('WEEKLY_PLANS.WIZARD.SESSION_INCOMPLETE', { num: this.getSlotDisplayNumber(slot), problems: problems.join(', ') }) : '';
  }

  setWarning(key: string, message: string) {
    this.activeWarning = this.activeWarning?.key === key ? null : { key, message };
  }

  clearWarning() {
    this.activeWarning = null;
  }

  isDayCollapsed(dayOfWeek: number) {
    return this.collapsedDays[dayOfWeek] ?? false;
  }

  dayHasIncompleteSlots(dayOfWeek: number) {
    return this.getDaySlots(dayOfWeek).some(slot => !this.isSlotComplete(slot));
  }

  dayHasOverlap(dayOfWeek: number) {
    const daySlots = this.getDaySlots(dayOfWeek)
      .slice()
      .sort((a, b) => this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime));

    for (let index = 0; index < daySlots.length - 1; index++) {
      const current = daySlots[index];
      const next = daySlots[index + 1];
      if (this.timesOverlap(current.startTime, current.endTime, next.startTime, next.endTime)) {
        return true;
      }
    }

    return false;
  }

  getOverlapMessage(dayOfWeek: number) {
    const daySlots = this.getDaySlots(dayOfWeek)
      .slice()
      .sort((a, b) => this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime));

    for (let index = 0; index < daySlots.length - 1; index++) {
      const current = daySlots[index];
      const next = daySlots[index + 1];
      if (this.timesOverlap(current.startTime, current.endTime, next.startTime, next.endTime)) {
        return this.translate.instant('WEEKLY_PLANS.WIZARD.OVERLAP_MSG', { start1: current.startTime, end1: current.endTime, start2: next.startTime, end2: next.endTime });
      }
    }

    return '';
  }

  onSlotChanged(slot: WizardSlot) {
    const dayOfWeek = Number(slot.dayOfWeek);
    if (!dayOfWeek) {
      return;
    }

    const slotKey = this.getSlotUiKey(slot);

    if (!this.isSlotComplete(slot) && this.isSlotCollapsed(slot)) {
      this.setWarning(slotKey, this.getSlotWarningMessage(slot));
    } else if (this.activeWarning?.key === slotKey && this.isSlotComplete(slot)) {
      this.clearWarning();
    }

    if (this.dayHasOverlap(dayOfWeek)) {
      if (!this.warnedOverlapDays.has(dayOfWeek)) {
        const firstOverlap = this.getOverlapDetails(dayOfWeek);
        const warningKey = `day-${dayOfWeek}`;
        const dayLabel = this.translate.instant(this.getDayLabel(dayOfWeek));
        const warningMessage = firstOverlap || this.translate.instant('WEEKLY_PLANS.WIZARD.OVERLAP_GENERIC', { day: dayLabel });
        this.setWarning(warningKey, warningMessage);
        this.messageService.showWarning(this.translate.instant('WEEKLY_PLANS.WIZARD.OVERLAP_GENERIC', { day: dayLabel }));
        this.warnedOverlapDays.add(dayOfWeek);
      }
    } else {
      this.warnedOverlapDays.delete(dayOfWeek);
      if (this.activeWarning?.key === `day-${dayOfWeek}`) {
        this.clearWarning();
      }
    }
  }

  getOverlapDetails(dayOfWeek: number) {
    const daySlots = this.getDaySlots(dayOfWeek)
      .slice()
      .sort((a, b) => this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime));

    for (let index = 0; index < daySlots.length - 1; index++) {
      const current = daySlots[index];
      const next = daySlots[index + 1];
      if (this.timesOverlap(current.startTime, current.endTime, next.startTime, next.endTime)) {
        return this.translate.instant('WEEKLY_PLANS.WIZARD.OVERLAP_DETAIL', { num1: this.getSlotDisplayNumber(current), num2: this.getSlotDisplayNumber(next) });
      }
    }

    return '';
  }

  getDayLabel(dayOfWeek: number) {
    return this.days.find(day => day.value === dayOfWeek)?.label || 'COMMON.DAYS.DAY';
  }

  isSlotComplete(slot: any) {
    return !!slot.recipeId && !!slot.quantity && !!slot.startTime && !!slot.endTime && (slot.studentIds?.length || 0) > 0;
  }

  getSlotDisplayNumber(slot: any) {
    const daySlots = this.getDaySlots(slot.dayOfWeek);
    return daySlots.indexOf(slot) + 1;
  }

  weekStartToday() {
    const today = new Date();
    this.weekStartDate = this.normalizeToMonday(this.toIsoDate(today));
    if (this.currentStep === 1) {
      this.nextStep();
    }
  }

  onWeekStartDateChange(value: string) {
    this.weekStartDate = this.normalizeToMonday(value);
  }

  private normalizeToMonday(dateStr: string): string {
    if (!dateStr) return '';
    
    // Use T00:00:00 to ensure the date is interpreted in local time
    const date = new Date(`${dateStr}T00:00:00`);
    if (isNaN(date.getTime())) return dateStr;

    const day = date.getDay(); // 0 (Sun) to 6 (Sat)
    const mondayOffset = day === 0 ? -6 : 1 - day;
    
    date.setDate(date.getDate() + mondayOffset);
    return this.toIsoDate(date);
  }


  trackBySlotIdOrIndex(index: number, slot: any) {
    return slot.id ?? `${slot.dayOfWeek}-${index}`;
  }

  private initializeCollapsedDays() {
    for (const day of this.days) {
      this.collapsedDays[day.value] = false;
    }
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = (time || '00:00').split(':').map(value => Number(value) || 0);
    return hours * 60 + minutes;
  }

  private addMinutes(time: string, minutesToAdd: number): string {
    const total = this.timeToMinutes(time) + minutesToAdd;
    const clamped = Math.min(Math.max(total, 0), 23 * 60 + 59);
    const hours = Math.floor(clamped / 60).toString().padStart(2, '0');
    const minutes = (clamped % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
    const startMinutesA = this.timeToMinutes(startA);
    const endMinutesA = this.timeToMinutes(endA);
    const startMinutesB = this.timeToMinutes(startB);
    const endMinutesB = this.timeToMinutes(endB);

    return startMinutesA < endMinutesB && startMinutesB < endMinutesA;
  }

  trackSlotByIndex = (index: number) => index;

  loadCookableRecipeCatalog(force = false) {
    if (this.loadingCookableRecipes) {
      return;
    }

    if (!force && this.cookableRecipes.length > 0) {
      return;
    }

    this.loadingCookableRecipes = true;
    this.recipeService.getCookableRecipes().subscribe({
      next: (recipes) => {
        this.cookableRecipes = recipes;
        this.loadingCookableRecipes = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingCookableRecipes = false;
        this.cdr.detectChanges();
      }
    });
  }

  getAutoCreateAllergenOptions() {
    const map = new Map<number, { id: number; name: string }>();
    for (const recipe of this.cookableRecipes) {
      for (const allergen of recipe.allergens || []) {
        map.set(allergen.id, { id: allergen.id, name: allergen.name });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  toggleExcludedAllergen(allergenId: number) {
    const index = this.autoCreateExcludedAllergenIds.indexOf(allergenId);
    if (index >= 0) {
      this.autoCreateExcludedAllergenIds.splice(index, 1);
    } else {
      this.autoCreateExcludedAllergenIds.push(allergenId);
    }
  }

  openAutoCreateModal(dayOfWeek: number) {
    this.autoCreateDayOfWeek = dayOfWeek;

    // Load from cache or set defaults
    const cached = this.loadAutoCreateOptions();
    if (cached) {
      this.autoCreateSessionCount = cached.sessionCount;
      this.autoCreateStartTime = cached.startTime;
      this.autoCreateEndTime = cached.endTime;
      this.autoCreateSessionDurationMinutes = cached.sessionDurationMinutes;
      this.autoCreatePlatesPerSession = cached.platesPerSession;
      this.autoCreateMaxStudentsPerSession = cached.maxStudentsPerSession;
      this.autoCreateBreakStartTime = cached.breakStartTime;
      this.autoCreateBreakEndTime = cached.breakEndTime;
      this.autoCreateUseCurrentStock = cached.useCurrentStock;
      this.autoCreateRecipeSelectionMode = cached.recipeSelectionMode;
      this.autoCreateExcludedAllergenIds = cached.excludedAllergenIds;
      this.autoCreateSelectedRecipeIds = cached.selectedRecipeIds;
      this.autoCreateExcludedStudentIds = cached.excludedStudentIds;
      this.autoCreateDistributionMode = cached.distributionMode;
    } else {
      this.autoCreateSessionCount = Math.max(1, this.getDaySlots(dayOfWeek).length || 2);
      this.autoCreateStartTime = '08:00';
      this.autoCreateEndTime = '14:00';
      this.autoCreateSessionDurationMinutes = 60;
      this.autoCreatePlatesPerSession = 1;
      this.autoCreateMaxStudentsPerSession = Math.max(1, Math.min(2, this.myStudents.length || 1));
      this.autoCreateBreakStartTime = '';
      this.autoCreateBreakEndTime = '';
      this.autoCreateUseCurrentStock = true;
      this.autoCreateRecipeSelectionMode = 'EXCLUDE';
      this.autoCreateExcludedAllergenIds = [];
      this.autoCreateSelectedRecipeIds = [];
      this.autoCreateExcludedStudentIds = [];
      this.autoCreateDistributionMode = 'EQUITATIVE';
    }

    this.autoCreateRecipeSearchQuery = '';
    this.autoCreateRecipePage = 0;
    this.autoCreateRecipeHasMore = true;
    this.autoCreateRecipeResults = [];
    this.showAutoCreateModal = true;
    this.loadCookableRecipeCatalog();
    this.loadAutoCreateRecipePage('', true);
  }

  private saveAutoCreateOptions() {
    const options: AutoCreateOptions = {
      sessionCount: this.autoCreateSessionCount,
      startTime: this.autoCreateStartTime,
      endTime: this.autoCreateEndTime,
      sessionDurationMinutes: this.autoCreateSessionDurationMinutes,
      platesPerSession: this.autoCreatePlatesPerSession,
      maxStudentsPerSession: this.autoCreateMaxStudentsPerSession,
      breakStartTime: this.autoCreateBreakStartTime,
      breakEndTime: this.autoCreateBreakEndTime,
      useCurrentStock: this.autoCreateUseCurrentStock,
      recipeSelectionMode: this.autoCreateRecipeSelectionMode,
      excludedAllergenIds: this.autoCreateExcludedAllergenIds,
      selectedRecipeIds: this.autoCreateSelectedRecipeIds,
      excludedStudentIds: this.autoCreateExcludedStudentIds,
      distributionMode: this.autoCreateDistributionMode
    };
    this.storageService.set(this.AUTO_CREATE_STORAGE_KEY, JSON.stringify(options), 'local');
  }

  private loadAutoCreateOptions(): AutoCreateOptions | null {
    const data = this.storageService.get(this.AUTO_CREATE_STORAGE_KEY, 'local');
    if (!data) {
      return null;
    }
    try {
      return JSON.parse(data) as AutoCreateOptions;
    } catch (e) {
      this.logger.error('Error parsing auto create options from localStorage', e);
      return null;
    }
  }

  closeAutoCreateModal() {
    this.showAutoCreateModal = false;
    this.autoCreateDayOfWeek = null;
  }

  createDayAutomatically() {
    if (!this.autoCreateDayOfWeek) {
      return;
    }

    const targetDayOfWeek = this.autoCreateDayOfWeek;
    this.clearDaySlots(targetDayOfWeek);

    if (this.myStudents.length === 0) {
      this.messageService.showWarning(this.translate.instant('WEEKLY_PLANS.WIZARD.AUTO_NO_STUDENTS_WARN'));
      return;
    }

    const availableStudents = this.getAvailableStudentsForAutoCreate();
    if (availableStudents.length === 0) {
      this.messageService.showWarning(this.translate.instant('WEEKLY_PLANS.WIZARD.AUTO_NO_STUDENTS_FILTER_WARN'));
      return;
    }

    const excluded = new Set(this.autoCreateExcludedAllergenIds);
    const selectedRecipes = new Set(this.autoCreateSelectedRecipeIds);
    const selectedRecipeIds = this.autoCreateSelectedRecipeIds.length > 0 ? selectedRecipes : null;

    const candidates = this.cookableRecipes.filter(recipe => {
      if (this.autoCreateUseCurrentStock && (!recipe.cookable || (recipe.cookableQuantity ?? 0) < 1)) {
        return false;
      }

      if (!(recipe.allergens || []).every(allergen => !excluded.has(allergen.id))) {
        return false;
      }

      if (!selectedRecipeIds) {
        return true;
      }

      return this.autoCreateRecipeSelectionMode === 'INCLUDE'
        ? selectedRecipeIds.has(recipe.id)
        : !selectedRecipeIds.has(recipe.id);
    });

    if (candidates.length === 0) {
      this.messageService.showWarning(this.translate.instant('WEEKLY_PLANS.WIZARD.AUTO_NO_RECIPES_WARN'));
      return;
    }

    const schedule = this.buildAutomaticDaySchedule(
      candidates,
      availableStudents,
      Math.max(1, Math.floor(this.autoCreateSessionCount || 1)),
      Math.max(1, Math.floor(this.autoCreateSessionDurationMinutes || 1)),
      this.autoCreateStartTime,
      this.autoCreateEndTime,
      this.autoCreateBreakStartTime,
      this.autoCreateBreakEndTime,
      this.autoCreateDistributionMode,
      Math.max(1, Math.floor(this.autoCreateMaxStudentsPerSession || 1)),
    );

    if (schedule.length === 0) {
      this.messageService.showWarning(this.translate.instant('WEEKLY_PLANS.WIZARD.AUTO_NO_SPACE_WARN'));
      return;
    }

    for (const slot of schedule) {
      this.addSlotForDay(targetDayOfWeek, {
        recipeId: slot.recipe.id,
        recipeName: slot.recipe.name,
        quantity: Math.max(1, Math.floor(this.autoCreatePlatesPerSession || 1)),
        startTime: slot.startTime,
        endTime: slot.endTime,
        studentIds: slot.students.map(student => student.id)
      });
    }

    this.saveAutoCreateOptions();
    this.closeAutoCreateModal();
    this.messageService.showSuccess(this.translate.instant('WEEKLY_PLANS.WIZARD.AUTO_SUCCESS', { count: schedule.length, day: this.translate.instant(this.getDayLabel(targetDayOfWeek)) }));
  }

  private clearDaySlots(dayOfWeek: number): void {
    const removedSlots = this.getDaySlots(dayOfWeek);
    if (!removedSlots.length) {
      return;
    }

    const removedUiKeys = new Set(removedSlots.map(slot => this.getSlotUiKey(slot)));
    this.slots = this.slots.filter(slot => slot.dayOfWeek !== dayOfWeek);
    for (const key of removedUiKeys) {
      delete this.collapsedSlots[key];
    }

    this.warnedOverlapDays.delete(dayOfWeek);
    if (this.activeWarning && (this.activeWarning.key === `day-${dayOfWeek}` || removedUiKeys.has(this.activeWarning.key))) {
      this.clearWarning();
    }
  }

  private buildAutomaticDaySchedule(
    candidates: CookableRecipe[],
    students: User[],
    desiredSessions: number,
    durationMinutes: number,
    startTime: string,
    endTime: string,
    breakStartTime: string,
    breakEndTime: string,
    mode: DistributionMode,
    maxStudentsPerSession: number
  ): Array<{ startTime: string; endTime: string; recipe: CookableRecipe; students: User[] }> {
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    if (endMinutes <= startMinutes) {
      return [];
    }

    const breakStartMinutes = breakStartTime ? this.timeToMinutes(breakStartTime) : null;
    const breakEndMinutes = breakEndTime ? this.timeToMinutes(breakEndTime) : null;
    const hasBreak = breakStartMinutes !== null
      && breakEndMinutes !== null
      && breakEndMinutes > breakStartMinutes
      && breakStartMinutes < endMinutes
      && breakEndMinutes > startMinutes;

    const viableSlots: Array<{ startMinutes: number; endMinutes: number }> = [];
    let cursor = startMinutes;

    while (viableSlots.length < desiredSessions) {
      if (hasBreak && breakStartMinutes !== null && breakEndMinutes !== null && cursor >= breakStartMinutes && cursor < breakEndMinutes) {
        cursor = breakEndMinutes;
      }

      const slotStart = cursor;
      const slotEnd = slotStart + durationMinutes;

      if (slotEnd > endMinutes) {
        break;
      }

      if (hasBreak && breakStartMinutes !== null && breakEndMinutes !== null && slotStart < breakStartMinutes && slotEnd > breakStartMinutes) {
        cursor = breakEndMinutes;
        continue;
      }

      viableSlots.push({ startMinutes: slotStart, endMinutes: slotEnd });
      cursor = slotEnd;
    }

    if (viableSlots.length === 0) {
      return [];
    }

    const studentGroups = this.splitStudentsAcrossSessions(
      students,
      viableSlots.length,
      maxStudentsPerSession,
      mode
    );

    return viableSlots.map((slot, index) => ({
      startTime: this.minutesToTime(slot.startMinutes),
      endTime: this.minutesToTime(slot.endMinutes),
      recipe: candidates[Math.floor(Math.random() * candidates.length)],
      students: studentGroups[index] || []
    }));
  }

  loadAutoCreateRecipePage(query: string, reset = false) {
    if (this.autoCreateRecipeLoading || this.autoCreateRecipeLoadingMore) {
      return;
    }

    const normalizedQuery = query.trim();

    if (reset) {
      this.autoCreateRecipeSearchQuery = normalizedQuery;
      this.autoCreateRecipePage = 0;
      this.autoCreateRecipeHasMore = true;
      this.autoCreateRecipeResults = [];
      this.autoCreateRecipeLoading = true;
    } else {
      this.autoCreateRecipeLoadingMore = true;
    }

    this.recipeService.searchByName(normalizedQuery, this.autoCreateRecipePage, this.autoCreateRecipePageSize).subscribe({
      next: (page) => {
        const newItems = page.content.map(recipe => ({ id: recipe.id, name: recipe.name }));
        this.autoCreateRecipeResults = reset
          ? newItems
          : [...this.autoCreateRecipeResults, ...newItems];
        this.autoCreateRecipeHasMore = !page.last;
        this.autoCreateRecipeLoading = false;
        this.autoCreateRecipeLoadingMore = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.autoCreateRecipeLoading = false;
        this.autoCreateRecipeLoadingMore = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadMoreAutoCreateRecipes() {
    if (!this.autoCreateRecipeHasMore || this.autoCreateRecipeLoading || this.autoCreateRecipeLoadingMore) {
      return;
    }

    this.autoCreateRecipePage++;
    this.loadAutoCreateRecipePage(this.autoCreateRecipeSearchQuery, false);
  }

  onAutoCreateRecipeScroll(event: Event) {
    const element = event.target as HTMLElement;
    const scrollPosition = element.scrollTop + element.clientHeight;
    if (element.scrollHeight - scrollPosition < 120) {
      this.loadMoreAutoCreateRecipes();
    }
  }

  onAutoCreateRecipeSearchChange(query: string) {
    this.loadAutoCreateRecipePage(query, true);
  }

  toggleAutoCreateRecipeSelection(recipeId: number) {
    const index = this.autoCreateSelectedRecipeIds.indexOf(recipeId);
    if (index >= 0) {
      this.autoCreateSelectedRecipeIds.splice(index, 1);
    } else {
      this.autoCreateSelectedRecipeIds.push(recipeId);
    }
  }

  isAutoCreateRecipeSelected(recipeId: number) {
    return this.autoCreateSelectedRecipeIds.includes(recipeId);
  }

  private getAvailableStudentsForAutoCreate(): User[] {
    const excludedIds = new Set(this.autoCreateExcludedStudentIds);
    return this.myStudents.filter(student => !excludedIds.has(student.id));
  }

  toggleExcludedStudent(studentId: number) {
    const index = this.autoCreateExcludedStudentIds.indexOf(studentId);
    if (index >= 0) {
      this.autoCreateExcludedStudentIds.splice(index, 1);
    } else {
      this.autoCreateExcludedStudentIds.push(studentId);
    }
  }

  getAutoCreateStudentOptions() {
    return [...this.myStudents].sort((a, b) => a.name.localeCompare(b.name));
  }

  private getStudentAssignmentCounts(students: User[]): Map<number, number> {
    const assignmentCounts = new Map<number, number>();
    for (const slot of this.slots) {
      for (const studentId of slot.studentIds || []) {
        if (students.some(student => student.id === studentId)) {
          assignmentCounts.set(studentId, (assignmentCounts.get(studentId) || 0) + 1);
        }
      }
    }
    return assignmentCounts;
  }

  private splitStudentsAcrossSessions(
    students: User[],
    sessionCount: number,
    maxStudentsPerSession: number,
    mode: DistributionMode
  ): User[][] {
    const groups: User[][] = Array.from({ length: sessionCount }, () => []);
    const counts = this.getStudentAssignmentCounts(students);
    const orderedStudents = [...students];

    const pickNextStudent = (excludeIds: Set<number>): User | null => {
      const candidates = orderedStudents.filter(student => !excludeIds.has(student.id));
      if (candidates.length === 0) {
        return null;
      }

      if (mode === 'RANDOM') {
        const sorted = [...candidates].sort(() => Math.random() - 0.5);
        return sorted[0] || null;
      }

      return [...candidates].sort((a, b) => {
        const countA = counts.get(a.id) || 0;
        const countB = counts.get(b.id) || 0;
        if (countA !== countB) {
          return countA - countB;
        }

        if (mode === 'HISTORICAL') {
          const rateA = this.studentMetrics[a.id]?.participationRate ?? 0;
          const rateB = this.studentMetrics[b.id]?.participationRate ?? 0;
          if (rateA !== rateB) {
            return rateA - rateB;
          }
        }

        return a.name.localeCompare(b.name);
      })[0] || null;
    };

    for (let sessionIndex = 0; sessionIndex < sessionCount; sessionIndex++) {
      const assignedIds = new Set<number>();

      while (groups[sessionIndex].length < maxStudentsPerSession) {
        const nextStudent = pickNextStudent(assignedIds);
        if (!nextStudent) {
          break;
        }

        groups[sessionIndex].push(nextStudent);
        assignedIds.add(nextStudent.id);
        counts.set(nextStudent.id, (counts.get(nextStudent.id) || 0) + 1);
      }
    }

    return groups;
  }

  private minutesToTime(totalMinutes: number): string {
    const normalized = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
    const hours = Math.floor(normalized / 60).toString().padStart(2, '0');
    const minutes = (normalized % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private warnForRecipeAllergens(slot: WizardSlot) {
    if (!slot.recipeId) {
      return;
    }

    const recipe = this.cookableRecipes.find(candidate => candidate.id === slot.recipeId);
    if (!recipe || !recipe.allergens || recipe.allergens.length === 0) {
      return;
    }

    const allergenNames = recipe.allergens.map(allergen => allergen.name).join(', ');
    this.messageService.showWarning(this.translate.instant('WEEKLY_PLANS.WIZARD.RECIPE_ALLERGENS_WARN', { name: recipe.name, allergens: allergenNames }));
  }

  getStockUsageSummary() {
    const rowsByProduct = new Map<number, StockUsageRow>();
    const recipesById = new Map(this.cookableRecipes.map(recipe => [recipe.id, recipe]));

    for (const slot of this.slots) {
      if (!slot.recipeId || !slot.quantity) {
        continue;
      }

      const recipe = recipesById.get(slot.recipeId);
      if (!recipe) {
        continue;
      }

      for (const component of recipe.components || []) {
        const required = Number(component.requiredQuantity || 0) * Number(slot.quantity || 0);
        const existing = rowsByProduct.get(component.productId);
        if (!existing) {
          const availPct = component.availabilityPercentage || 100;
          const grossRequired = availPct > 0 ? (required * 100) / availPct : required;
          
          rowsByProduct.set(component.productId, {
            productId: component.productId,
            productName: component.productName,
            unit: component.unit || '',
            required,
            grossRequired,
            availabilityPercentage: availPct,
            available: Number(component.availableStock || 0),
            grossAvailable: Number(component.grossAvailableStock || 0),
            reservedByOtherPlans: Number(component.reservedByOtherPlans || 0),
            realAvailable: 0,
            pendingOrdered: 0,
            shortage: 0
          });
        } else {
          existing.required += required;
          const availPct = existing.availabilityPercentage || 100;
          existing.grossRequired += availPct > 0 ? (required * 100) / availPct : required;
        }
      }

    }

    const productIds = Array.from(rowsByProduct.keys()).sort((a, b) => a - b);
    this.ensurePendingOrdersCoverage(productIds);

    const rows = Array.from(rowsByProduct.values())
      .map(row => {
        const realAvailable = Math.max(0, row.available - row.reservedByOtherPlans);
        const pendingOrdered = Number(this.pendingOrdersByProduct[row.productId] || 0);
        
        // El faltante que mostrare y que se pedira es el BRUTO
        const netShortage = Math.max(0, row.required - realAvailable - pendingOrdered);
        const rawShortage = row.availabilityPercentage > 0 
          ? (netShortage * 100) / row.availabilityPercentage 
          : netShortage;
        
        const shortage = this.normalizeShortage(rawShortage);

        return {
          ...row,
          realAvailable,
          pendingOrdered,
          shortage
        };
      })
      .sort((a, b) => b.shortage - a.shortage || a.productName.localeCompare(b.productName));


    const riskCount = rows.filter(row => row.shortage > 0).length;
    const totalShortage = rows.reduce((total, row) => total + row.shortage, 0);
    const sufficientRate = rows.length > 0
      ? Math.round((rows.filter(row => row.shortage <= 0).length / rows.length) * 100)
      : 100;

    return {
      rows,
      riskCount,
      totalShortage,
      sufficientRate,
      hasWarnings: riskCount > 0
    };
  }

  private normalizeShortage(value: number): number {
    if (value <= this.shortageEpsilon) {
      return 0;
    }

    return value;
  }

  private ensurePendingOrdersCoverage(productIds: number[]): void {
    const key = productIds.join(',');
    if (this.pendingOrdersLookupKey === key || this.pendingOrdersLoading) {
      return;
    }

    this.pendingOrdersLookupKey = key;
    if (!productIds.length) {
      this.pendingOrdersByProduct = {};
      return;
    }

    this.pendingOrdersLoading = true;
    this.orderService.searchByProducts({
      productIds,
      statuses: ['CREATED', 'PENDING', 'REVIEW']
    }).subscribe({
      next: (response) => {
        const map: Record<number, number> = {};
        const totals = response?.totalQuantityPerProduct || {};
        for (const [productId, quantity] of Object.entries(totals)) {
          map[Number(productId)] = Number(quantity || 0);
        }

        this.pendingOrdersByProduct = map;
        this.pendingOrdersLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.pendingOrdersByProduct = {};
        this.pendingOrdersLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getParticipationSummary() {
    const assignmentCounts = new Map<number, number>();

    for (const slot of this.slots) {
      for (const studentId of slot.studentIds || []) {
        assignmentCounts.set(studentId, (assignmentCounts.get(studentId) || 0) + 1);
      }
    }

    const rows = this.myStudents.map(student => {
      const assignments = assignmentCounts.get(student.id) || 0;
      const metrics = this.studentMetrics[student.id];
      const historicalRate = metrics?.participationRate ?? 0;
      
      // Net Attendance Rate: (Total - Cancelled) / Total
      let attendanceRate = 0;
      if (metrics && metrics.totalAssignments > 0) {
        attendanceRate = Math.round(((metrics.totalAssignments - metrics.totalCancelled) / metrics.totalAssignments) * 100);
      }

      return {
        id: student.id,
        name: student.name,
        assignments,
        historicalRate,
        attendanceRate,
        selected: assignments > 0
      };
    });

    const totalAssignments = rows.reduce((total, row) => total + row.assignments, 0);
    const activeStudents = rows.filter(row => row.assignments > 0).length;
    const averageHistoricalRate = rows.length
      ? Math.round(rows.reduce((total, row) => total + row.historicalRate, 0) / rows.length)
      : 0;

    return {
      rows: rows.sort((a, b) => b.attendanceRate - a.attendanceRate || a.historicalRate - b.historicalRate || a.name.localeCompare(b.name)),
      totalAssignments,
      activeStudents,
      averageHistoricalRate
    };
  }

  toggleStudent(slot: WizardSlot, studentId: number) {
    const idx = slot.studentIds.indexOf(studentId);
    if (idx >= 0) {
      slot.studentIds.splice(idx, 1);
    } else {
      slot.studentIds.push(studentId);
    }
    this.onSlotChanged(slot);
  }

  onStudentPillKeydown(event: KeyboardEvent, slot: any, studentId: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleStudent(slot, studentId);
    }
  }

  save() {
    if (!this.weekStartDate) return;

    if (this.isPastWeek(this.weekStartDate)) {
      this.messageService.showError('No se puede crear un plan para una semana anterior a la actual.');
      return;
    }

    if (this.role === 'ADMIN' && !this.chefId) {
      this.messageService.showWarning(this.translate.instant('WEEKLY_PLANS.WIZARD.CHEF_WARN'));
      return;
    }

    // Basic validation
    for (const slot of this.slots) {
      if (!slot.recipeId) {
        this.messageService.showError(this.translate.instant('WEEKLY_PLANS.WIZARD.RECIPE_ERROR'));
        return;
      }
    }

    this.saving = true;
    const request: WeeklyPlanRequest = {
      weekStartDate: this.weekStartDate,
      chefId: this.chefId || 0,
      slots: this.slots.map((s, i) => ({
        id: s.id, // will be undefined for new slots in edit mode
        dayOfWeek: s.dayOfWeek,
        recipeId: s.recipeId!,
        quantity: s.quantity,
        startTime: s.startTime,
        endTime: s.endTime,
        sortOrder: i,
        studentIds: s.studentIds
      }))
    };

    if (this.editMode && this.planId) {
      this.weeklyPlanService.updatePlan(this.planId, request).subscribe({
        next: (res) => {
          this.saving = false;
          this.messageService.showSuccess(this.translate.instant('WEEKLY_PLANS.WIZARD.UPDATE_SUCCESS'));
          this.router.navigate([this.getBaseRoute(), res.id]);
        },
        error: (err) => {
          this.saving = false;
const backendMessage = typeof err?.error?.message === 'string' ? err.error.message : '';  
          this.messageService.showError(backendMessage || this.translate.instant('WEEKLY_PLANS.WIZARD.UPDATE_ERROR') || 'Error al actualizar el plan semanal.');
        }
      });
    } else {
      this.weeklyPlanService.createPlan(request).subscribe({
        next: (res) => {
          this.saving = false;
          this.messageService.showSuccess(this.translate.instant('WEEKLY_PLANS.WIZARD.CREATE_SUCCESS'));
          this.router.navigate([this.getBaseRoute(), res.id]);
        },
        error: (err) => {
          this.saving = false;
const backendMessage = typeof err?.error?.message === 'string' ? err.error.message : '';  
          this.messageService.showError(backendMessage || this.translate.instant('WEEKLY_PLANS.WIZARD.CREATE_ERROR') || 'Error al guardar el plan semanal.');
        }
      });
    }
  }

  private isPastWeek(weekStartDate: string): boolean {
    if (!weekStartDate) {
      return false;
    }

    const selected = new Date(`${weekStartDate}T00:00:00`);
    if (Number.isNaN(selected.getTime())) {
      return false;
    }

    const now = new Date();
    const mondayOffset = now.getDay() === 0 ? -6 : 1 - now.getDay();
    const currentWeekMonday = new Date(now);
    currentWeekMonday.setDate(now.getDate() + mondayOffset);
    currentWeekMonday.setHours(0, 0, 0, 0);

    return selected < currentWeekMonday;
  }

  async cancel() {
    if (this.hasUnsavedChanges()) {
      const confirmed = await this.messageService.confirm(
        this.translate.instant('WEEKLY_PLANS.WIZARD.UNSAVED_TITLE'),
        this.translate.instant('WEEKLY_PLANS.WIZARD.UNSAVED_MSG'),
        this.translate.instant('WEEKLY_PLANS.WIZARD.UNSAVED_EXIT'),
        this.translate.instant('WEEKLY_PLANS.WIZARD.UNSAVED_STAY')
      );
      if (!confirmed) {
        return;
      }
    }

    if (this.editMode && this.planId) {
      this.router.navigate([this.getBaseRoute(), this.planId]);
    } else {
      this.router.navigate([this.getBaseRoute()]);
    }
  }

  private hasUnsavedChanges(): boolean {
    return this.initialStateSnapshot !== this.buildStateSnapshot();
  }

  private buildStateSnapshot(): string {
    const stableSlots = this.slots.map((slot, index) => ({
      index,
      dayOfWeek: slot.dayOfWeek,
      recipeId: slot.recipeId,
      quantity: slot.quantity,
      startTime: slot.startTime,
      endTime: slot.endTime,
      studentIds: [...(slot.studentIds || [])].sort((a: number, b: number) => a - b)
    }));

    return JSON.stringify({
      weekStartDate: this.weekStartDate,
      chefId: this.chefId,
      slots: stableSlots
    });
  }

  private addDaysToDate(dateStr: string, days: number): string {
    const date = new Date(`${dateStr}T00:00:00`);
    date.setDate(date.getDate() + days);
    return this.toIsoDate(date);
  }


  private getBaseRoute(): string {
    return this.router.url.startsWith('/admin-panel/weekly-plans')
      ? '/admin-panel/weekly-plans'
      : '/weekly-plans';
  }

  private loadChefPage(query: string, reset: boolean) {
    const normalizedQuery = query.trim();

    if (this.loadingChefSearch || this.loadingChefSearchMore) {
      return;
    }

    if (reset) {
      this.chefSearchQuery = normalizedQuery;
      this.chefSearchPage = 0;
      this.chefSearchHasMore = true;
      this.loadingChefSearch = true;
    } else {
      this.loadingChefSearchMore = true;
    }

    this.userService.searchTeachers(normalizedQuery, this.chefSearchPage, this.chefSearchPageSize).subscribe({
      next: (page) => {
        const mapped = (page.content || []).map(user => ({ id: user.id, name: user.name }));
        this.chefSearchItems = reset ? mapped : [...this.chefSearchItems, ...mapped];
        this.chefSearchHasMore = !page.last;
        this.loadingChefSearch = false;
        this.loadingChefSearchMore = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingChefSearch = false;
        this.loadingChefSearchMore = false;
        this.cdr.detectChanges();
      }
    });
  }

  private resolveChefSelection(chefId: number | null): void {
    if (!chefId) {
      this.selectedChefName = '';
      return;
    }

    const existing = this.chefSearchItems.find(item => item.id === chefId);
    if (existing) {
      this.selectedChefName = existing.name;
      return;
    }

    this.userService.getById(chefId).subscribe({
      next: (chef) => {
        this.selectedChefName = chef?.name || '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.selectedChefName = '';
        this.cdr.detectChanges();
      }
    });
  }

  clearChefSelection() {
    this.chefId = null;
    this.selectedChefName = '';
    this.studentMetrics = {};
    this.cdr.detectChanges();
  }
}
