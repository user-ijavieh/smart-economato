export interface RecipeAudit {
    id_recipe: number;
    id_user: number;
    action: string;
    details: string;
    auditDate: string;
}

export interface RecipeCookingAudit {
    id: number;
    recipeId: number;
    recipeName: string;
    userId: number;
    userName: string;
    quantityCooked: number;
    details: string;
    cookingDate: string;
}
