import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { BaseModalComponent } from '../../../../../shared/components/base-modal/base-modal.component';
import { Recipe } from '../../../../../shared/models/recipe.model';
import { User } from '../../../../../shared/models/user.model';
import {
  WeeklyPlanRequest,
  WeeklyPlanResponse,
  WeeklyPlanSlotRequest,
  WeeklyPlanSlotResponse
} from '../../../../../shared/models/weekly-plan.model';
import { WEEK_DAYS, normalizeWeekStartDate, timeToMinutes } from '../weekly-plan.constants';
import { RecipeService } from '../../../../../core/services/recipe.service';
import { UserService } from '../../../../../core/services/user.service';

interface WeeklyPlanFormSlot extends WeeklyPlanSlotRequest {
  locked?: boolean;
  recipeName?: string;
}

interface SearchableRecipe {
  id: number;
  name: string;
}

interface SearchableStudent {
  id: number;
  name: string;
}

@Component({
  selector: 'app-weekly-plan-form',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseModalComponent],
  templateUrl: './weekly-plan-form.component.html',
  styleUrl: './weekly-plan-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeeklyPlanFormComponent implements OnChanges, OnInit, OnDestroy {
  private recipeService = inject(RecipeService);
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);

  @Input() open = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() role: 'ADMIN' | 'CHEF' | 'ELEVATED' | 'USER' | null = null;
  @Input() plan: WeeklyPlanResponse | null = null;
  @Input() recipes: Recipe[] = [];
  @Input() students: User[] = [];
  @Input() teachers: User[] = [];
  @Input() defaultChefId: number | null = null;
  @Input() saving = false;
  @Input() activating = false;

  @Output() closed = new EventEmitter<void>();
  @Output() saveDraft = new EventEmitter<WeeklyPlanRequest>();
  @Output() activatePlan = new EventEmitter<WeeklyPlanRequest>();

  readonly days = WEEK_DAYS;

  weekStartDate = '';
  chefId: number | null = null;
  slots: WeeklyPlanFormSlot[] = [];
  validationMessage = '';

  // Recipe search
  recipeSearchResults: SearchableRecipe[] = [];
  currentRecipePage = 0;
  totalRecipePages = 0;
  loadingMoreRecipes = false;
  recipeSearchQuery = '';

  // Student search
  studentSearchResults: SearchableStudent[] = [];
  currentStudentPage = 0;
  totalStudentPages = 0;
  loadingMoreStudents = false;
  studentSearchQuery = '';

  private recipeSearchSubject = new Subject<string>();
  private studentSearchSubject = new Subject<string>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['plan'] || changes['open']) {
      this.rebuildForm();
    }
    if (changes['recipes']) {
      this.initializeRecipeSearch();
    }
    if (changes['students']) {
      this.initializeStudentSearch();
    }
  }

  ngOnInit(): void {
    this.initializeRecipeSearch();
    this.initializeStudentSearch();
  }

  ngOnDestroy(): void {
    this.recipeSearchSubject.complete();
    this.studentSearchSubject.complete();
  }

  private initializeRecipeSearch(): void {
    this.recipeSearchResults = this.recipes.slice(0, 50);
    this.totalRecipePages = Math.ceil(this.recipes.length / 50);
  }

  private initializeStudentSearch(): void {
    this.studentSearchResults = this.students
      .filter(u => u.role === 'USER' || u.role === 'ELEVATED')
      .slice(0, 50)
      .map(u => ({ id: u.id, name: u.name }));
    this.totalStudentPages = Math.ceil(this.students.length / 50);
  }

  rebuildForm(): void {
    if (!this.open) {
      return;
    }

    if (this.plan) {
      this.weekStartDate = this.plan.weekStartDate;
      this.chefId = this.plan.chefId;
      this.slots = this.plan.slots.map(slot => ({
        id: slot.id,
        recipeId: slot.recipeId,
        quantity: Number(slot.quantity),
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        sortOrder: slot.sortOrder,
        studentIds: slot.students.map(student => student.studentId),
        locked: this.isLocked(slot)
      }));
    } else {
      this.weekStartDate = this.defaultChefId ? this.normalizeDate(new Date().toISOString().slice(0, 10)) : this.normalizeDate(new Date().toISOString().slice(0, 10));
      this.chefId = this.defaultChefId;
      this.slots = [this.createEmptySlot(1)];
    }

    this.validationMessage = '';
  }

  isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  canActivate(): boolean {
    return this.mode === 'edit' && this.plan?.status === 'DRAFT';
  }

  addSlot(dayOfWeek = 1): void {
    this.slots.push(this.createEmptySlot(dayOfWeek));
  }

  removeSlot(index: number): void {
    this.slots.splice(index, 1);
    if (this.slots.length === 0) {
      this.slots.push(this.createEmptySlot(1));
    }
  }

  onWeekStartDateChange(value: string): void {
    this.weekStartDate = this.normalizeDate(value);
  }

  isLocked(slot: WeeklyPlanSlotResponse): boolean {
    return this.plan?.status !== 'DRAFT' && slot.status === 'CONFIRMED';
  }

  isSlotLocked(slot: WeeklyPlanFormSlot): boolean {
    return !!slot.locked;
  }

  save(): void {
    if (!this.validate()) {
      return;
    }

    this.saveDraft.emit(this.buildRequest());
  }

  activate(): void {
    if (!this.validate()) {
      return;
    }

    this.activatePlan.emit(this.buildRequest());
  }

  trackBySlot(index: number): number {
    return index;
  }

  private buildRequest(): WeeklyPlanRequest {
    return {
      chefId: this.isAdmin() ? this.chefId ?? undefined : this.defaultChefId ?? undefined,
      weekStartDate: this.weekStartDate,
      slots: this.slots.map(slot => ({
        id: slot.id,
        recipeId: Number(slot.recipeId),
        quantity: Number(slot.quantity),
        dayOfWeek: Number(slot.dayOfWeek),
        startTime: slot.startTime,
        endTime: slot.endTime,
        sortOrder: Number(slot.sortOrder),
        studentIds: (slot.studentIds || []).map(studentId => Number(studentId))
      }))
    };
  }

  private validate(): boolean {
    this.validationMessage = '';

    if (!this.weekStartDate) {
      this.validationMessage = 'Selecciona una semana válida.';
      return false;
    }

    const normalizedWeekStart = normalizeWeekStartDate(this.weekStartDate);
    if (normalizedWeekStart !== this.weekStartDate) {
      this.weekStartDate = normalizedWeekStart;
    }

    if (this.isAdmin() && !this.chefId) {
      this.validationMessage = 'Selecciona un chef para el plan.';
      return false;
    }

    if (this.slots.length === 0) {
      this.validationMessage = 'Añade al menos un turno.';
      return false;
    }

    const grouped = new Map<number, WeeklyPlanFormSlot[]>();
    for (const slot of this.slots) {
      if (!slot.recipeId || !slot.quantity || !slot.dayOfWeek || !slot.startTime || !slot.endTime) {
        this.validationMessage = 'Completa todos los campos de los turnos.';
        return false;
      }

      if (timeToMinutes(slot.endTime) <= timeToMinutes(slot.startTime)) {
        this.validationMessage = 'La hora de fin debe ser posterior a la hora de inicio.';
        return false;
      }

      const daySlots = grouped.get(slot.dayOfWeek) || [];
      daySlots.push(slot);
      grouped.set(slot.dayOfWeek, daySlots);
    }

    for (const daySlots of grouped.values()) {
      const sorted = [...daySlots].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      for (let index = 1; index < sorted.length; index += 1) {
        if (timeToMinutes(sorted[index].startTime) < timeToMinutes(sorted[index - 1].endTime)) {
          this.validationMessage = 'Hay turnos solapados en el mismo día.';
          return false;
        }
      }
    }

    return true;
  }

  // Recipe search methods
  searchRecipes(query: string): void {
    this.recipeSearchQuery = query;
    if (query.trim() === '') {
      this.recipeSearchResults = this.recipes.slice(0, 50);
      this.currentRecipePage = 0;
    } else {
      const filtered = this.recipes.filter(r => r.name.toLowerCase().includes(query.toLowerCase()));
      this.recipeSearchResults = filtered.slice(0, 50);
      this.totalRecipePages = Math.ceil(filtered.length / 50);
      this.currentRecipePage = 0;
    }
    this.cdr.markForCheck();
  }

  loadMoreRecipes(): void {
    if (this.currentRecipePage < this.totalRecipePages - 1 && !this.loadingMoreRecipes) {
      this.loadingMoreRecipes = true;
      const nextPage = this.currentRecipePage + 1;
      const start = nextPage * 50;
      const end = start + 50;

      let filtered = this.recipes;
      if (this.recipeSearchQuery.trim() !== '') {
        filtered = this.recipes.filter(r => r.name.toLowerCase().includes(this.recipeSearchQuery.toLowerCase()));
      }

      const newResults = filtered.slice(start, end);
      this.recipeSearchResults = [...this.recipeSearchResults, ...newResults];
      this.currentRecipePage = nextPage;
      this.loadingMoreRecipes = false;
      this.cdr.markForCheck();
    }
  }

  // Student search methods
  searchStudents(query: string): void {
    this.studentSearchQuery = query;
    const studentUsers = this.students.filter(u => u.role === 'USER' || u.role === 'ELEVATED');
    
    if (query.trim() === '') {
      this.studentSearchResults = studentUsers.slice(0, 50).map(u => ({ id: u.id, name: u.name }));
      this.currentStudentPage = 0;
    } else {
      const filtered = studentUsers.filter(u => u.name.toLowerCase().includes(query.toLowerCase()));
      this.studentSearchResults = filtered.slice(0, 50).map(u => ({ id: u.id, name: u.name }));
      this.totalStudentPages = Math.ceil(filtered.length / 50);
      this.currentStudentPage = 0;
    }
    this.cdr.markForCheck();
  }

  loadMoreStudents(): void {
    if (this.currentStudentPage < this.totalStudentPages - 1 && !this.loadingMoreStudents) {
      this.loadingMoreStudents = true;
      const nextPage = this.currentStudentPage + 1;
      const start = nextPage * 50;
      const end = start + 50;

      const studentUsers = this.students.filter(u => u.role === 'USER' || u.role === 'ELEVATED');
      let filtered = studentUsers;
      if (this.studentSearchQuery.trim() !== '') {
        filtered = studentUsers.filter(u => u.name.toLowerCase().includes(this.studentSearchQuery.toLowerCase()));
      }

      const newResults = filtered.slice(start, end).map(u => ({ id: u.id, name: u.name }));
      this.studentSearchResults = [...this.studentSearchResults, ...newResults];
      this.currentStudentPage = nextPage;
      this.loadingMoreStudents = false;
      this.cdr.markForCheck();
    }
  }

  getRecipeName(recipeId: number): string {
    return this.recipes.find(r => r.id === recipeId)?.name || 'Receta desconocida';
  }

  getStudentNames(studentIds: number[]): string[] {
    return studentIds.map(id => this.students.find(s => s.id === id)?.name || `Alumno ${id}`);
  }

  onRecipeScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const scrollPosition = element.scrollTop + element.clientHeight;
    const scrollHeight = element.scrollHeight;

    if (scrollHeight - scrollPosition < 100 && this.currentRecipePage < this.totalRecipePages - 1) {
      this.loadMoreRecipes();
    }
  }

  onStudentScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const scrollPosition = element.scrollTop + element.clientHeight;
    const scrollHeight = element.scrollHeight;

    if (scrollHeight - scrollPosition < 100 && this.currentStudentPage < this.totalStudentPages - 1) {
      this.loadMoreStudents();
    }
  }

  toggleStudent(slot: WeeklyPlanFormSlot, studentId: number, checked: boolean): void {
    if (!slot.studentIds) {
      slot.studentIds = [];
    }

    if (checked) {
      if (!slot.studentIds.includes(studentId)) {
        slot.studentIds.push(studentId);
      }
    } else {
      const index = slot.studentIds.indexOf(studentId);
      if (index > -1) {
        slot.studentIds.splice(index, 1);
      }
    }
    this.cdr.markForCheck();
  }

  private createEmptySlot(dayOfWeek: number): WeeklyPlanFormSlot {
    return {
      recipeId: 0,
      quantity: 1,
      dayOfWeek,
      startTime: '10:00',
      endTime: '11:00',
      sortOrder: this.slots.length + 1,
      studentIds: []
    };
  }

  private normalizeDate(value: string): string {
    return normalizeWeekStartDate(value);
  }
}