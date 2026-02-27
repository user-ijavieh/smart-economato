import { Component, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecipeService } from '../../../core/services/recipe.service';
import { RecipeAuditService } from '../../../core/services/recipe-audit.service';
import { UserService } from '../../../core/services/user.service';
import { MessageService } from '../../../core/services/message.service';
import { Recipe, RecipeRequest } from '../../../shared/models/recipe.model';
import { RecipeAudit } from '../../../shared/models/recipe-audit.model';
import { RecipeCreateModalComponent } from '../../general/recipes/recipe-create-modal/recipe-create-modal.component';
import { RecipeEditModalComponent } from '../../general/recipes/recipe-edit-modal/recipe-edit-modal.component';
import { RecipeDetailModalComponent } from '../../general/recipes/recipe-detail-modal/recipe-detail-modal.component';
import { ConfirmDialogComponent } from '../../../shared/components/layout/confirm-dialog/confirm-dialog.component';
import { ToastComponent } from '../../../shared/components/layout/toast/toast.component';
import { finalize, catchError, forkJoin } from 'rxjs';
import { of } from 'rxjs';

@Component({
    selector: 'app-recipes-management',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        RecipeCreateModalComponent,
        RecipeEditModalComponent,
        RecipeDetailModalComponent,
        ConfirmDialogComponent,
        ToastComponent
    ],
    templateUrl: './recipes-management.component.html',
    styleUrl: './recipes-management.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecipesManagementComponent implements OnInit {
    private recipeService = inject(RecipeService);
    private recipeAuditService = inject(RecipeAuditService);
    private userService = inject(UserService);
    private cdr = inject(ChangeDetectorRef);
    messageService = inject(MessageService);

    // ── Tab state ──
    activeTab: 'recipes' | 'audits' = 'recipes';

    // ── Recipes state ──
    recipes: Recipe[] = [];
    filteredRecipes: Recipe[] = [];
    loading = true;
    searchTerm = '';

    // Pagination state (Recipes)
    currentPage = 0;
    pageSize = 20;
    totalPages = 0;
    totalElements = 0;

    // Modal state
    showCreateModal = false;
    showEditModal = false;
    showDetailModal = false;
    selectedRecipe: Recipe | null = null;

    // Stats
    get totalRecipes(): number { return this.totalElements; }
    get recipesWithAllergens(): number { return this.filteredRecipes.filter(r => r.allergens?.length > 0).length; }
    get recipesWithoutAllergens(): number { return this.filteredRecipes.filter(r => !r.allergens || r.allergens.length === 0).length; }
    get averageCost(): number {
        if (this.filteredRecipes.length === 0) return 0;
        const total = this.filteredRecipes.reduce((sum, r) => sum + r.totalCost, 0);
        return total / this.filteredRecipes.length;
    }

    // ── Audits state ──
    audits: RecipeAudit[] = [];
    filteredAudits: RecipeAudit[] = [];
    loadingAudits = false;
    auditsLoaded = false;
    auditSearchTerm = '';
    auditActionFilter = '';
    auditStartDate = '';
    auditEndDate = '';
    userMap: { [id: number]: string } = {};
    loadingUsers = false;
    selectedAudit: RecipeAudit | null = null;
    showAuditDetailModal = false;

    // ── Caché de auditorías ──
    private auditCache: Map<string, RecipeAudit[]> = new Map();

    get totalAudits(): number { return this.filteredAudits.length; }
    get auditsByAction(): { [key: string]: number } {
        const counts: { [key: string]: number } = {};
        this.filteredAudits.forEach(a => {
            counts[a.action] = (counts[a.action] || 0) + 1;
        });
        return counts;
    }
    get uniqueActions(): string[] {
        return [...new Set(this.audits.map(a => a.action))].sort();
    }

    ngOnInit(): void {
        this.loadRecipes();
    }

    // ── Tab switching ──

    switchTab(tab: 'recipes' | 'audits'): void {
        this.activeTab = tab;
        if (tab === 'audits') {
            this.loadAudits();
        }
        this.cdr.detectChanges();
    }

    // ── Recipes ──

    loadRecipes(page: number = 0): void {
        this.loading = true;
        this.currentPage = page;
        this.cdr.markForCheck();

        const source$ = this.searchTerm.trim()
            ? this.recipeService.searchByName(this.searchTerm.trim(), this.currentPage, this.pageSize, 'name,asc')
            : this.recipeService.getAll(this.currentPage, this.pageSize, 'name,asc');

        source$.pipe(
            finalize(() => {
                this.loading = false;
                this.cdr.markForCheck();
            })
        ).subscribe({
            next: (pageData) => {
                this.recipes = pageData.content;
                this.filteredRecipes = pageData.content;
                this.totalElements = pageData.totalElements;
                this.totalPages = pageData.totalPages;
                this.cdr.markForCheck();
            },
            error: () => {
                this.messageService.showError('Error al cargar las recetas');
            }
        });
    }

    onSearch(): void {
        this.currentPage = 0;
        this.loadRecipes();
    }

    clearFilters(): void {
        this.searchTerm = '';
        this.currentPage = 0;
        this.loadRecipes();
    }

    changePage(delta: number): void {
        const newPage = this.currentPage + delta;
        if (newPage >= 0 && newPage < this.totalPages) {
            this.loadRecipes(newPage);
        }
    }

    hasActiveFilters(): boolean {
        return this.searchTerm.trim().length > 0;
    }

    // ── Audits ──

    loadAudits(): void {
        // Generar clave de caché basada en filtros de fecha
        const cacheKey = this.auditStartDate && this.auditEndDate 
            ? `date:${this.auditStartDate}-${this.auditEndDate}`
            : 'all';

        // Verificar si tenemos datos en caché
        if (this.auditCache.has(cacheKey)) {
            this.audits = this.auditCache.get(cacheKey) || [];
            this.applyAuditFilters();
            this.loadUsersForAudits();
            this.auditsLoaded = true;
            this.cdr.detectChanges();
            return;
        }

        // Si no hay caché válido, hacer petición
        this.loadingAudits = true;
        this.cdr.detectChanges();

        const source$ = (this.auditStartDate && this.auditEndDate)
            ? this.recipeAuditService.getByDateRange(this.auditStartDate, this.auditEndDate)
            : this.recipeAuditService.getAll();

        source$.pipe(
            finalize(() => {
                this.loadingAudits = false;
                this.auditsLoaded = true;
                this.cdr.detectChanges();
            })
        ).subscribe({
            next: (response) => {
                // Verificar si la respuesta es un array directo o un objeto paginado
                let auditsArray: any[] = [];
                
                if (Array.isArray(response)) {
                    auditsArray = response;
                } else if (response && Array.isArray((response as any).content)) {
                    // Respuesta paginada con estructura {content: [], ...}
                    auditsArray = (response as any).content;
                } else {
                    console.warn('Respuesta inesperada del servicio de auditorías:', response);
                }
                
                // Guardar en caché
                this.auditCache.set(cacheKey, auditsArray);
                
                this.audits = auditsArray;
                this.applyAuditFilters();
                this.loadUsersForAudits();
                this.cdr.detectChanges();
            },
            error: () => {
                this.messageService.showError('Error al cargar las auditorías');
            }
        });
    }

    applyAuditFilters(): void {
        let result = [...this.audits];

        if (this.auditSearchTerm.trim()) {
            const term = this.auditSearchTerm.toLowerCase();
            result = result.filter(a =>
                a.details.toLowerCase().includes(term) ||
                a.action.toLowerCase().includes(term) ||
                a.id_recipe.toString().includes(term) ||
                a.id_user.toString().includes(term)
            );
        }

        if (this.auditActionFilter) {
            result = result.filter(a => a.action === this.auditActionFilter);
        }

        this.filteredAudits = result;
        this.cdr.markForCheck();
    }

    onAuditSearch(): void {
        this.applyAuditFilters();
    }

    onAuditActionFilterChange(): void {
        this.applyAuditFilters();
    }

    onDateRangeFilter(): void {
        if (this.auditStartDate && this.auditEndDate) {
            this.loadAudits();
        }
    }

    clearAuditFilters(): void {
        this.auditSearchTerm = '';
        this.auditActionFilter = '';
        this.auditStartDate = '';
        this.auditEndDate = '';
        this.loadAudits();
    }

    // ── Métodos de caché ──

    hasActiveAuditFilters(): boolean {
        return this.auditSearchTerm.trim().length > 0
            || this.auditActionFilter.length > 0
            || (this.auditStartDate.length > 0 && this.auditEndDate.length > 0);
    }

    refreshAudits(): void {
        this.auditCache.clear();
        this.loadAudits();
    }

    getActionBadgeClass(action: string): string {
        const u = action.toUpperCase();
        if (u.includes('CREA') || u === 'CREATE_RECIPE') return 'badge-create';
        if (u.includes('MODIFIC') || u === 'UPDATE_RECIPE') return 'badge-update';
        if (u.includes('ELIMIN') || u === 'DELETE_RECIPE') return 'badge-delete';
        return 'badge-default';
    }

    translateAction(action: string): string {
        const u = action.toUpperCase();
        if (u.includes('CREA') || u === 'CREATE_RECIPE') return 'Crear';
        if (u.includes('MODIFIC') || u === 'UPDATE_RECIPE') return 'Actualizar';
        if (u.includes('ELIMIN') || u === 'DELETE_RECIPE') return 'Eliminar';
        return action;
    }

    loadUsersForAudits(): void {
        // Obtener IDs únicos de usuarios que realmente aparecen en las auditorías
        const userIds = [...new Set(this.audits.map(a => a.id_user))];
        
        // Filtrar solo los usuarios que no tenemos en caché
        const missingUserIds = userIds.filter(id => !this.userMap[id]);
        
        // Si ya tenemos todos los usuarios, no hacer petición
        if (missingUserIds.length === 0) {
            this.cdr.markForCheck();
            return;
        }

        this.loadingUsers = true;
        this.cdr.markForCheck();

        // Cargar solo los usuarios que faltan
        this.loadUsersByIds(missingUserIds);
    }

    private loadUsersByIds(userIds: number[]): void {
        // Hacer múltiples peticiones en paralelo para usuarios específicos
        const userRequests = userIds.map(id => 
            this.userService.getById(id).pipe(
                // Si falla una petición, usar un fallback
                catchError(() => of({ id, name: `Usuario #${id}` }))
            )
        );

        forkJoin(userRequests).pipe(
            finalize(() => {
                this.loadingUsers = false;
                this.cdr.markForCheck();
            })
        ).subscribe({
            next: (users) => {
                // Actualizar caché solo con los nuevos usuarios
                users.forEach(user => {
                    this.userMap[user.id] = user.name;
                });
                this.cdr.markForCheck();
            },
            error: () => {
                // En caso de error total, usar fallbacks para todos
                userIds.forEach(id => {
                    this.userMap[id] = `Usuario #${id}`;
                });
                this.cdr.markForCheck();
            }
        });
    }

    getUserName(userId: number): string {
        return this.userMap[userId] || `Usuario #${userId}`;
    }

    getRecipeName(recipeId: number): string {
        const recipe = this.recipes.find(r => r.id === recipeId);
        return recipe ? recipe.name : `Receta #${recipeId}`;
    }

    openAuditDetail(audit: RecipeAudit): void {
        this.selectedAudit = audit;
        this.showAuditDetailModal = true;
        this.cdr.markForCheck();
    }

    closeAuditDetail(): void {
        this.showAuditDetailModal = false;
        this.selectedAudit = null;
        this.cdr.markForCheck();
    }

    onAuditOverlayClick(event: MouseEvent): void {
        if ((event.target as HTMLElement).classList.contains('audit-modal-overlay')) {
            this.closeAuditDetail();
        }
    }

    formatDate(dateStr: string): string {
        const d = new Date(dateStr);
        return d.toLocaleString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    // ── Detail ──

    openDetailModal(recipe: Recipe): void {
        this.selectedRecipe = recipe;
        this.showDetailModal = true;
        this.cdr.markForCheck();
    }

    closeDetailModal(): void {
        this.showDetailModal = false;
        this.selectedRecipe = null;
        this.cdr.markForCheck();
    }

    // ── Create ──

    openCreateModal(): void {
        this.showCreateModal = true;
        this.cdr.markForCheck();
    }

    closeCreateModal(): void {
        this.showCreateModal = false;
        this.cdr.markForCheck();
    }

    onCreateRecipe(recipeRequest: RecipeRequest): void {
        this.recipeService.create(recipeRequest).subscribe({
            next: (recipe) => {
                this.messageService.showSuccess(`Receta "${recipe.name}" creada con éxito`);
                this.closeCreateModal();
                this.loadRecipes();
            },
            error: (err) => {
                const msg = err.error?.message || err.error || 'Error al crear la receta';
                this.messageService.showError(msg);
            }
        });
    }

    // ── Edit ──

    openEditModal(recipe: Recipe): void {
        this.selectedRecipe = recipe;
        this.showEditModal = true;
        this.cdr.markForCheck();
    }

    closeEditModal(): void {
        this.showEditModal = false;
        this.selectedRecipe = null;
        this.cdr.markForCheck();
    }

    onSaveRecipe(recipeRequest: RecipeRequest): void {
        if (!this.selectedRecipe) return;

        this.recipeService.update(this.selectedRecipe.id, recipeRequest).subscribe({
            next: (recipe) => {
                this.messageService.showSuccess(`Receta "${recipe.name}" actualizada con éxito`);
                this.closeEditModal();
                this.loadRecipes();
            },
            error: (err) => {
                const msg = err.error?.message || err.error || 'Error al actualizar la receta';
                this.messageService.showError(msg);
            }
        });
    }

    // ── Delete ──

    async deleteRecipe(recipe: Recipe): Promise<void> {
        const confirmed = await this.messageService.confirm(
            '¿Eliminar receta?',
            `¿Estás seguro de que quieres eliminar "${recipe.name}"? Esta acción no se puede deshacer.`
        );

        if (!confirmed) return;

        this.recipeService.delete(recipe.id).subscribe({
            next: () => {
                this.messageService.showSuccess(`Receta "${recipe.name}" eliminada correctamente`);
                this.loadRecipes();
            },
            error: (err) => {
                const msg = err.error?.message || err.error || 'Error al eliminar la receta';
                this.messageService.showError(msg);
            }
        });
    }

    // ── Cook ──

    onCookRecipe(event: { quantity: number; details: string }): void {
        if (!this.selectedRecipe) return;

        this.recipeService.cook({
            recipeId: this.selectedRecipe.id,
            quantity: event.quantity,
            details: event.details
        }).subscribe({
            next: (recipe) => {
                this.messageService.showSuccess(`¡"${recipe.name}" cocinada con éxito!`);
                this.closeDetailModal();
                this.loadRecipes();
            },
            error: (err) => {
                const msg = err.error?.message || err.error || 'Error al cocinar la receta';
                this.messageService.showError(msg);
            }
        });
    }

    // ── PDF ──

    downloadPdf(recipe: Recipe): void {
        this.recipeService.getPdf(recipe.id).subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `receta-${recipe.name.replace(/\s+/g, '-').toLowerCase()}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                this.messageService.showSuccess('PDF descargado correctamente');
            },
            error: () => {
                this.messageService.showError('Error al generar el PDF');
            }
        });
    }

    // ── Helpers ──

    hasAllergens(recipe: Recipe): boolean {
        return recipe.allergens && recipe.allergens.length > 0;
    }

    // ── Diff Helpers ──

    get parsedPreviousState(): any | null {
        if (!this.selectedAudit?.previousState) return null;
        try { return JSON.parse(this.selectedAudit.previousState); }
        catch { return null; }
    }

    get parsedNewState(): any | null {
        if (!this.selectedAudit?.newState) return null;
        try { return JSON.parse(this.selectedAudit.newState); }
        catch { return null; }
    }

    get hasDiffData(): boolean {
        return this.parsedPreviousState !== null && this.parsedNewState !== null;
    }

    getDiffFields(): { label: string; prev: string; next: string; changed: boolean }[] {
        const prev = this.parsedPreviousState;
        const next = this.parsedNewState;
        if (!prev || !next) return [];

        const fields: { label: string; prev: string; next: string; changed: boolean }[] = [];

        // Nombre
        fields.push({
            label: 'Nombre',
            prev: prev.nombre ?? '',
            next: next.nombre ?? '',
            changed: prev.nombre !== next.nombre
        });

        // Elaboración
        fields.push({
            label: 'Elaboración',
            prev: prev.elaboracion ?? '',
            next: next.elaboracion ?? '',
            changed: prev.elaboracion !== next.elaboracion
        });

        // Presentación
        fields.push({
            label: 'Presentación',
            prev: prev.presentacion ?? '',
            next: next.presentacion ?? '',
            changed: prev.presentacion !== next.presentacion
        });

        // Coste Total
        const prevCost = prev.costeTotal?.toFixed(2) ?? '0.00';
        const nextCost = next.costeTotal?.toFixed(2) ?? '0.00';
        fields.push({
            label: 'Coste Total',
            prev: prevCost + ' €',
            next: nextCost + ' €',
            changed: prevCost !== nextCost
        });

        // Alérgenos
        const prevAllergens = (prev.alergenos ?? []).join(', ') || 'Ninguno';
        const nextAllergens = (next.alergenos ?? []).join(', ') || 'Ninguno';
        fields.push({
            label: 'Alérgenos',
            prev: prevAllergens,
            next: nextAllergens,
            changed: prevAllergens !== nextAllergens
        });

        return fields;
    }

    getComponentDiffs(): { nombre: string; prevCantidad: string; nextCantidad: string; status: 'added' | 'removed' | 'changed' | 'unchanged' }[] {
        const prev = this.parsedPreviousState;
        const next = this.parsedNewState;
        if (!prev || !next) return [];

        const prevComps: any[] = prev.componentes ?? [];
        const nextComps: any[] = next.componentes ?? [];
        const result: any[] = [];

        // Map by productoId
        const prevMap = new Map<number, any>();
        const nextMap = new Map<number, any>();
        prevComps.forEach(c => prevMap.set(c.productoId, c));
        nextComps.forEach(c => nextMap.set(c.productoId, c));

        // All product IDs
        const allIds = new Set([...prevMap.keys(), ...nextMap.keys()]);

        allIds.forEach(id => {
            const p = prevMap.get(id);
            const n = nextMap.get(id);
            const name = n?.productoNombre ?? p?.productoNombre ?? `Producto #${id}`;

            if (p && !n) {
                result.push({ nombre: name, prevCantidad: p.cantidad.toString(), nextCantidad: '—', status: 'removed' });
            } else if (!p && n) {
                result.push({ nombre: name, prevCantidad: '—', nextCantidad: n.cantidad.toString(), status: 'added' });
            } else if (p && n) {
                const changed = p.cantidad !== n.cantidad;
                result.push({
                    nombre: name,
                    prevCantidad: p.cantidad.toString(),
                    nextCantidad: n.cantidad.toString(),
                    status: changed ? 'changed' : 'unchanged'
                });
            }
        });

        return result;
    }
}
