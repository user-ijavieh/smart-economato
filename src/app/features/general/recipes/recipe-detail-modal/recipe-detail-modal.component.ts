import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Recipe } from '../../../../shared/models/recipe.model';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';

@Component({
  selector: 'app-recipe-detail-modal',
  standalone: true,
  imports: [FormsModule, BaseModalComponent, DecimalPipe, TranslateModule],
  templateUrl: './recipe-detail-modal.component.html',
  styleUrl: './recipe-detail-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecipeDetailModalComponent {
  @Input({ required: true }) recipe!: Recipe;
  @Input() canEdit = false;
  @Input() isAdmin = false;
  @Input() canCook = true;

  @Output() close = new EventEmitter<void>();
  @Output() print = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
  @Output() cook = new EventEmitter<{ quantity: number; details: string }>();

  cookQuantity = 1;
  cookDetails = '';

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

  getGrossQuantity(net: number, availability?: number): number {
    if (!availability || availability <= 0 || availability >= 100) {
      return net;
    }
    return net * 100 / availability;
  }
}
