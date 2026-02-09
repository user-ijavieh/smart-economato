export interface Recipe {
  id: number;
  name: string;
  description?: string;
  cost: number;
  components: RecipeComponent[];
  allergens?: Allergen[];
}

export interface RecipeComponent {
  id: number;
  product: { id: number; name: string };
  quantity: number;
  unit: string;
}

export interface RecipeRequest {
  name: string;
  description?: string;
  components: { productId: number; quantity: number; unit: string }[];
}

export interface Allergen {
  id: number;
  name: string;
}
