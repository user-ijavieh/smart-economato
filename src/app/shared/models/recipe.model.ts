export interface Recipe {
  id: number;
  name: string;
  elaboration?: string;
  presentation?: string;
  totalCost: number;
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
