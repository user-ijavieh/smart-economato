import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Recipe } from '../../../shared/models/recipe.model';

@Component({
  selector: 'app-recipe-detail-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recipe-detail-modal.component.html',
  styleUrl: './recipe-detail-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecipeDetailModalComponent {
  @Input({ required: true }) recipe!: Recipe;
  @Input() canEdit = false;
  
  @Output() close = new EventEmitter<void>();
  @Output() print = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
  @Output() cook = new EventEmitter<{ quantity: number; details: string }>();

  cookQuantity = 1;
  cookDetails = '';

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.close.emit();
    }
  }

  closeModal(): void {
    this.close.emit();
  }

  printRecipe(): void {
    this.print.emit();
  }

  editRecipe(): void {
    this.edit.emit();
  }

  cookRecipe(): void {
    this.cook.emit({
      quantity: this.cookQuantity,
      details: this.cookDetails
    });
  }

  hasAllergens(): boolean {
    return this.recipe.allergens && this.recipe.allergens.length > 0;
  }

  getElaborationSteps(elaboration: string): string[] {
    return elaboration.split('\n').filter(step => step.trim() !== '');
  }
}
