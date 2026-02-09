// 1. Definición de tipos para mayor seguridad
export type Role = 'ADMIN' | 'CHEF' | 'USER';

// 2. Estructura de permisos centralizada
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  CHEF: [
    "POST /api/allergens",
    "PUT /api/allergens/{id}",
    "POST /api/order-details",
    "PUT /api/order-details/{orderId}/{productId}",
    "POST /api/products",
    "PUT /api/products/{id}",
    "POST /api/recipes",
    "PUT /api/recipes/{id}",
    "POST /api/recipes/cook",
    "POST /api/recipe-components/recipe/{recipeId}",
    "PUT /api/recipe-components/{id}",
    "POST /api/recipe-allergens",
    "DELETE /api/recipe-allergens/recipe/{recipeId}/allergen/{allergenId}",
    "POST /api/orders",
    "PUT /api/orders/{id}",
    "POST /api/orders/reception",
    "GET /api/orders/reception/pending"
  ],
  ADMIN: [
    "POST /api/allergens",
    "PUT /api/allergens/{id}",
    "DELETE /api/allergens/{id}",
    "POST /api/order-details",
    "PUT /api/order-details/{orderId}/{productId}",
    "POST /api/products",
    "PUT /api/products/{id}",
    "DELETE /api/products/{id}",
    "POST /api/recipes",
    "PUT /api/recipes/{id}",
    "DELETE /api/recipes/{id}",
    "POST /api/recipes/cook",
    "POST /api/recipe-components/recipe/{recipeId}",
    "PUT /api/recipe-components/{id}",
    "DELETE /api/recipe-components/{id}",
    "POST /api/recipe-allergens",
    "DELETE /api/recipe-allergens/{id}",
    "DELETE /api/recipe-allergens/recipe/{recipeId}/allergen/{allergenId}",
    "POST /api/orders",
    "PUT /api/orders/{id}",
    "POST /api/orders/reception",
    "GET /api/orders/reception/pending",
    "POST /api/suppliers",
    "PUT /api/suppliers/{id}",
    "DELETE /api/suppliers/{id}",
    "POST /api/users",
    "PUT /api/users/{id}",
    "DELETE /api/users/{id}"
  ],
  USER: [
    "GET /api/products",
    "GET /api/products/{id}",
    "GET /api/products/codebar/{codebar}",
    "GET /api/recipes",
    "GET /api/recipes/{id}",
    "GET /api/recipe-components",
    "GET /api/recipe-components/{id}",
    "GET /api/recipe-components/recipe/{recipeId}",
    "GET /api/recipe-allergens",
    "GET /api/recipe-allergens/{id}",
    "GET /api/recipe-allergens/recipe/{recipeId}",
    "GET /api/recipe-allergens/allergen/{allergenId}",
    "GET /api/allergens",
    "GET /api/suppliers",
    "GET /api/orders/{id}"
  ]
};

// 3. Funciones de utilidad para verificar permisos
export function hasPermission(userRole: Role, method: string, url: string): boolean {
  const permissions = ROLE_PERMISSIONS[userRole];
  if (!permissions) return false;

  // Construir el patrón de permiso para verificar
  const permissionPattern = `${method} ${url}`;
  
  // Verificar si tiene el permiso exacto o si coincide con un patrón
  return permissions.some(permission => {
    // Verificación exacta
    if (permission === permissionPattern) return true;
    
    // Verificación con parámetros dinámicos (ej: {id})
    const regex = new RegExp(
      '^' + permission.replace(/\{[^}]+\}/g, '[^/]+') + '$'
    );
    return regex.test(permissionPattern);
  });
}

export function getUrlPattern(url: string): string {
  // Convierte URLs con IDs numéricos a patrones con {id}
  return url.replace(/\/\d+/g, '/{id}');
}