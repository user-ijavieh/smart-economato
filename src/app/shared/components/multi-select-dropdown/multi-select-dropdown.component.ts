import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, OnInit, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { SEARCH_DEBOUNCE_MS } from '../../../core/constants/search.constants';

export interface SelectableItem {
  id: number;
  name: string;
}

@Component({
  selector: 'app-multi-select-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="multi-select-wrapper" [class.open]="isOpen">
      <div class="select-trigger" (click)="toggle()">
        <span class="select-value">
          @if (selectedItems.length > 0) {
            {{ selectedItems.length }} seleccionado{{ selectedItems.length !== 1 ? 's' : '' }}
          } @else {
            {{ placeholder }}
          }
        </span>
        <svg class="chevron" [class.rotated]="isOpen" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      
      @if (isOpen) {
        <div class="dropdown-panel">
          <input 
            type="text" 
            [(ngModel)]="searchText" 
            (ngModelChange)="onSearch($event)"
            placeholder="Buscar..."
            class="search-input"
            autocomplete="off"
          />
          
          <div class="items-list" (scroll)="onScroll($event)">
            @if (filteredItems.length > 0) {
              @for (item of filteredItems; track item.id) {
                <label class="list-item">
                  <input 
                    type="checkbox" 
                    [checked]="isItemSelected(item.id)"
                    (change)="toggleItem(item)"
                  />
                  <span>{{ item.name }}</span>
                </label>
              }
            } @else {
              <div class="list-empty">No hay resultados</div>
            }
            
            @if (loadingMore) {
              <div class="list-loading">Cargando más...</div>
            }
          </div>
        </div>
      }
    </div>

    @if (selectedItems.length > 0 && showTags) {
      <div class="selected-tags">
        @for (item of selectedItems; track item.id) {
          <span class="tag">
            {{ item.name }}
            <button type="button" class="tag-remove" (click)="removeItem(item)">✕</button>
          </span>
        }
      </div>
    }
  `,
  styles: [`
    .multi-select-wrapper {
      position: relative;
      width: 100%;
    }

    .select-trigger {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      border: 1px solid var(--theme-border-glass);
      border-radius: 8px;
      background: var(--theme-surface-glass);
      color: var(--theme-text-primary);
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s ease;
      user-select: none;
    }

    .select-trigger:hover {
      border-color: var(--theme-border-medium);
      background: var(--theme-surface-glass-hover);
    }

    .select-trigger.open {
      border-color: var(--brand-primary);
      box-shadow: 0 0 0 2px rgba(var(--brand-primary-rgb), 0.1);
    }

    .select-value {
      flex: 1;
    }

    .chevron {
      transition: transform 0.2s ease;
      margin-left: 8px;
    }

    .chevron.rotated {
      transform: rotate(180deg);
    }

    .dropdown-panel {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: var(--theme-surface-glass);
      border: 1px solid var(--theme-border-glass);
      border-radius: 8px;
      box-shadow: var(--theme-shadow-card);
      z-index: 1000;
      max-height: 350px;
      display: flex;
      flex-direction: column;
    }

    .search-input {
      padding: 10px 12px;
      border: none;
      border-bottom: 1px solid var(--theme-border-glass);
      background: transparent;
      color: var(--theme-text-primary);
      font-size: 0.9rem;
    }

    .search-input:focus {
      outline: none;
      color: var(--brand-primary);
    }

    .items-list {
      flex: 1;
      overflow-y: auto;
      max-height: 280px;
    }

    .list-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      cursor: pointer;
      transition: background 0.15s ease;
      font-size: 0.9rem;
      color: var(--theme-text-primary);
      user-select: none;
    }

    .list-item:hover {
      background: var(--theme-surface-glass-hover);
    }

    .list-item input[type="checkbox"] {
      cursor: pointer;
      accent-color: var(--brand-primary);
    }

    .list-empty,
    .list-loading {
      padding: 12px;
      text-align: center;
      color: var(--theme-text-secondary);
      font-size: 0.85rem;
    }

    .selected-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }

    .tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: var(--color-accent-admin-bg);
      color: var(--color-accent-admin);
      border-radius: 16px;
      font-size: 0.85rem;
      font-weight: 500;
    }

    .tag-remove {
      background: none;
      border: none;
      color: currentColor;
      cursor: pointer;
      padding: 0;
      font-size: 0.9rem;
      opacity: 0.8;
      transition: opacity 0.2s;
    }

    .tag-remove:hover {
      opacity: 1;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MultiSelectDropdownComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);

  @Input() items: SelectableItem[] = [];
  @Input() placeholder = 'Selecciona...';
  @Input() selectedIds: number[] = [];
  @Input() loading = false;
  @Input() loadingMore = false;
  @Input() showTags = true;

  @Output() search = new EventEmitter<string>();
  @Output() scrollNearBottom = new EventEmitter<void>();
  @Output() selectionChange = new EventEmitter<number[]>();

  isOpen = false;
  searchText = '';
  filteredItems: SelectableItem[] = [];
  selectedItems: SelectableItem[] = [];
  private searchSubject = new Subject<string>();

  ngOnInit(): void {
    this.updateSelectedItems();
    this.searchSubject.pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged()
    ).subscribe(query => {
      this.search.emit(query);
    });
  }

  ngOnDestroy(): void {
    this.searchSubject.complete();
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.filteredItems = this.items;
    }
    this.cdr.markForCheck();
  }

  onSearch(query: string): void {
    this.searchSubject.next(query);
  }

  toggleItem(item: SelectableItem): void {
    const index = this.selectedIds.indexOf(item.id);
    if (index > -1) {
      this.selectedIds.splice(index, 1);
    } else {
      this.selectedIds.push(item.id);
    }
    this.updateSelectedItems();
    this.selectionChange.emit(this.selectedIds);
  }

  removeItem(item: SelectableItem): void {
    const index = this.selectedIds.indexOf(item.id);
    if (index > -1) {
      this.selectedIds.splice(index, 1);
    }
    this.updateSelectedItems();
    this.selectionChange.emit(this.selectedIds);
  }

  isItemSelected(id: number): boolean {
    return this.selectedIds.includes(id);
  }

  private updateSelectedItems(): void {
    this.selectedItems = this.items.filter(item => this.selectedIds.includes(item.id));
    this.cdr.markForCheck();
  }

  onScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const scrollPosition = element.scrollTop + element.clientHeight;
    const scrollHeight = element.scrollHeight;

    if (scrollHeight - scrollPosition < 100) {
      this.scrollNearBottom.emit();
    }
  }

  // Método para actualizar items filtrados desde el parent
  setFilteredItems(items: SelectableItem[]): void {
    this.filteredItems = items;
    this.cdr.markForCheck();
  }
}
