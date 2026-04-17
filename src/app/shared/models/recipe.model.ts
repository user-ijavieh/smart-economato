export interface Recipe {
  id: number;
  name: string;
  elaboration?: string;
  presentation?: string;
  portions?: number;
  totalCost: number;
  isHidden: boolean;
  components: RecipeComponent[];
  allergens: Allergen[];
}

export interface RecipeComponent {
  id: number;
  parentRecipeId: number;
  productId: number;
  productName: string;
  quantity: number;
  subtotal: number;
}

export interface RecipeRequest {
  name: string;
  elaboration?: string;
  presentation?: string;
  portions?: number;
  isHidden?: boolean;
  components: { productId: number; quantity: number }[];
  allergenIds?: number[];
}

export interface Allergen {
  id: number;
  name: string;
}


export interface CookRequest {
  recipeId: number;
  quantity: number;
  details: string;
}

export interface CookableRecipeComponent {
  productId: number;
  productName: string;
  unit: string;
  requiredQuantity: number;
  availableStock: number;
  reservedByOtherPlans?: number;
}

export interface CookableRecipe {
  id: number;
  name: string;
  portions?: number;
  cookableQuantity: number;
  cookable: boolean;
  components: CookableRecipeComponent[];
  allergens: Allergen[];
}
