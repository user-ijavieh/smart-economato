import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, OnInit, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

export interface SearchableItem {
  id: number;
  name: string;
}

@Component({
  selector: 'app-searchable-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="searchable-dropdown-wrapper" [class.open]="isOpen">
      <input 
        type="text" 
        [(ngModel)]="searchText" 
        (ngModelChange)="onSearch($event)"
        (focus)="open()"
        (blur)="close()"
        [placeholder]="placeholder"
        class="search-input"
        autocomplete="off"
      />
      
      @if (isOpen && searchResults.length > 0) {
        <div class="dropdown-menu" (scroll)="onScroll($event)">
          @for (item of searchResults; track item.id) {
            <div 
              class="dropdown-item"
              [class.selected]="isSelected(item.id)"
              (click)="selectItem(item)"
            >
              {{ item.name }}
            </div>
          }
          @if (loadingMore) {
            <div class="dropdown-item loading">
              <span>Cargando más...</span>
            </div>
          }
        </div>
      } @else if (isOpen && searchResults.length === 0 && !loading) {
        <div class="dropdown-menu">
          <div class="dropdown-item disabled">No hay resultados</div>
        </div>
      }
    </div>
  `,
  styles: [`
    .searchable-dropdown-wrapper {
      position: relative;
      width: 100%;
    }

    .search-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--theme-border-glass);
      border-radius: 8px;
      background: var(--theme-surface-glass);
      color: var(--theme-text-primary);
      font-size: 0.9rem;
      transition: all 0.2s ease;
    }

    .search-input:focus {
      outline: none;
      border-color: var(--brand-primary);
      box-shadow: 0 0 0 2px rgba(var(--brand-primary-rgb), 0.1);
    }

    .dropdown-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      max-height: 300px;
      overflow-y: auto;
      background: var(--theme-surface-glass);
      border: 1px solid var(--theme-border-glass);
      border-radius: 8px;
      box-shadow: var(--theme-shadow-card);
      z-index: 1000;
    }

    .dropdown-item {
      padding: 10px 12px;
      cursor: pointer;
      transition: background 0.15s ease;
      font-size: 0.9rem;
      color: var(--theme-text-primary);
    }

    .dropdown-item:hover:not(.disabled):not(.loading) {
      background: var(--theme-surface-glass-hover);
    }

    .dropdown-item.selected {
      background: var(--color-accent-admin-bg);
      color: var(--color-accent-admin);
      font-weight: 600;
    }

    .dropdown-item.disabled {
      color: var(--theme-text-secondary);
      cursor: not-allowed;
    }

    .dropdown-item.loading {
      text-align: center;
      color: var(--theme-text-secondary);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchableDropdownComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);

  @Input() items: SearchableItem[] = [];
  @Input() placeholder = 'Buscar...';
  @Input() selectedIds: number[] = [];
  @Input() loading = false;
  @Input() loadingMore = false;

  @Output() search = new EventEmitter<string>();
  @Output() scrollNearBottom = new EventEmitter<void>();
  @Output() itemSelected = new EventEmitter<SearchableItem>();

  searchText = '';
  isOpen = false;
  searchResults: SearchableItem[] = [];
  private searchSubject = new Subject<string>();

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(query => {
      this.search.emit(query);
    });
  }

  ngOnDestroy(): void {
    this.searchSubject.complete();
  }

  onSearch(query: string): void {
    this.searchResults = [];
    this.searchSubject.next(query);
  }

  open(): void {
    this.isOpen = true;
    this.searchResults = this.items;
    this.cdr.markForCheck();
  }

  close(): void {
    setTimeout(() => {
      this.isOpen = false;
      this.searchText = '';
      this.searchResults = [];
      this.cdr.markForCheck();
    }, 150);
  }

  selectItem(item: SearchableItem): void {
    this.itemSelected.emit(item);
    this.searchText = item.name;
    this.close();
  }

  isSelected(id: number): boolean {
    return this.selectedIds.includes(id);
  }

  onScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const scrollPosition = element.scrollTop + element.clientHeight;
    const scrollHeight = element.scrollHeight;

    if (scrollHeight - scrollPosition < 100) {
      this.scrollNearBottom.emit();
    }
  }
}
