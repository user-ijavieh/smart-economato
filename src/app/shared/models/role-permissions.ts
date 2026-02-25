// 1. Definición de tipos para mayor seguridad
export type Role = 'ADMIN' | 'CHEF' | 'USER';

// 2. Estructura de permisos centralizada
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  CHEF: [
    "GET /api/products",
    "GET /api/products/{id}",
    "GET /api/products/search",
    "GET /api/products/codebar/{codebar}",
    "GET /api/products/barcode/{barcode}",
    "GET /api/products/export/excel",
    "POST /api/products",
    "PUT /api/products/{id}",
    "PUT /api/products/{id}/stock-manual",
    "GET /api/allergens",
    "GET /api/allergens/search",
    "POST /api/allergens",
    "PUT /api/allergens/{id}",
    "GET /api/suppliers",
    "GET /api/suppliers/search",
    "GET /api/recipes",
    "GET /api/recipes/{id}",
    "GET /api/recipes/search",
    "GET /api/recipes/by-max-cost",
    "GET /api/recipes/{id}/pdf",
    "POST /api/recipes",
    "PUT /api/recipes/{id}",
    "POST /api/recipes/cook",
    "GET /api/recipe-components",
    "GET /api/recipe-components/{id}",
    "GET /api/recipe-components/recipe/{recipeId}",
    "POST /api/recipe-components/recipe/{recipeId}",
    "PUT /api/recipe-components/{id}",
    "GET /api/recipe-allergens",
    "GET /api/recipe-allergens/{id}",
    "GET /api/recipe-allergens/recipe/{recipeId}",
    "GET /api/recipe-allergens/allergen/{allergenId}",
    "POST /api/recipe-allergens",
    "DELETE /api/recipe-allergens/recipe/{recipeId}/allergen/{allergenId}",
    "GET /api/orders",
    "GET /api/orders/{id}",
    "GET /api/orders/user/{id}",
    "GET /api/orders/status/{status}",
    "GET /api/orders/by-date-range",
    "GET /api/orders/{id}/pdf",
    "GET /api/orders/reception/pending",
    "POST /api/orders",
    "PUT /api/orders/{id}",
    "PATCH /api/orders/{id}/status",
    "POST /api/orders/reception",
    "POST /api/order-details",
    "PUT /api/order-details/{orderId}/{productId}",
    "PATCH /api/users/{id}/password"
  ],
  ADMIN: [
    "GET /api/products",
    "GET /api/products/{id}",
    "GET /api/products/search",
    "GET /api/products/codebar/{codebar}",
    "GET /api/products/barcode/{barcode}",
    "GET /api/products/export/excel",
    "POST /api/products",
    "PUT /api/products/{id}",
    "PUT /api/products/{id}/stock-manual",
    "DELETE /api/products/{id}",
    "GET /api/allergens",
    "GET /api/allergens/search",
    "POST /api/allergens",
    "PUT /api/allergens/{id}",
    "DELETE /api/allergens/{id}",
    "GET /api/suppliers",
    "GET /api/suppliers/search",
    "GET /api/suppliers/{id}",
    "POST /api/suppliers",
    "PUT /api/suppliers/{id}",
    "DELETE /api/suppliers/{id}",
    "GET /api/recipes",
    "GET /api/recipes/{id}",
    "GET /api/recipes/search",
    "GET /api/recipes/by-max-cost",
    "GET /api/recipes/{id}/pdf",
    "POST /api/recipes",
    "PUT /api/recipes/{id}",
    "POST /api/recipes/cook",
    "DELETE /api/recipes/{id}",
    "GET /api/recipe-components",
    "GET /api/recipe-components/{id}",
    "GET /api/recipe-components/recipe/{recipeId}",
    "POST /api/recipe-components/recipe/{recipeId}",
    "PUT /api/recipe-components/{id}",
    "DELETE /api/recipe-components/{id}",
    "GET /api/recipe-allergens",
    "GET /api/recipe-allergens/{id}",
    "GET /api/recipe-allergens/recipe/{recipeId}",
    "GET /api/recipe-allergens/allergen/{allergenId}",
    "POST /api/recipe-allergens",
    "DELETE /api/recipe-allergens/{id}",
    "DELETE /api/recipe-allergens/recipe/{recipeId}/allergen/{allergenId}",
    "GET /api/orders",
    "GET /api/orders/{id}",
    "GET /api/orders/user/{id}",
    "GET /api/orders/status/{status}",
    "GET /api/orders/by-date-range",
    "GET /api/orders/{id}/pdf",
    "GET /api/orders/reception/pending",
    "POST /api/orders",
    "PUT /api/orders/{id}",
    "PATCH /api/orders/{id}/status",
    "DELETE /api/orders/{id}",
    "POST /api/orders/reception",
    "POST /api/order-details",
    "PUT /api/order-details/{orderId}/{productId}",
    "GET /api/users",
    "GET /api/users/{id}",
    "GET /api/users/hidden",
    "GET /api/users/by-role/{role}",
    "POST /api/users",
    "PUT /api/users/{id}",
    "DELETE /api/users/{id}",
    "PATCH /api/users/{id}/password",
    "PATCH /api/users/{id}/hidden",
    "GET /api/recipe-audits",
    "GET /api/recipe-audits/{id}",
    "GET /api/recipe-audits/by-user/{id}",
    "GET /api/recipe-audits/by-recipe/{id}",
    "GET /api/recipe-audits/by-date-range"
  ],
  USER: [
    "GET /api/products",
    "GET /api/products/{id}",
    "GET /api/products/search",
    "GET /api/products/codebar/{codebar}",
    "GET /api/products/barcode/{barcode}",
    "GET /api/products/export/excel",
    "GET /api/allergens",
    "GET /api/allergens/search",
    "GET /api/suppliers",
    "GET /api/suppliers/search",
    "GET /api/recipes",
    "GET /api/recipes/{id}",
    "GET /api/recipes/search",
    "GET /api/recipes/by-max-cost",
    "GET /api/recipes/{id}/pdf",
    "POST /api/recipes",
    "POST /api/recipes/cook",
    "GET /api/recipe-components",
    "GET /api/recipe-components/{id}",
    "GET /api/recipe-components/recipe/{recipeId}",
    "POST /api/recipe-components/recipe/{recipeId}",
    "GET /api/recipe-allergens",
    "GET /api/recipe-allergens/{id}",
    "GET /api/recipe-allergens/recipe/{recipeId}",
    "GET /api/recipe-allergens/allergen/{allergenId}",
    "POST /api/recipe-allergens",
    "GET /api/orders",
    "GET /api/orders/{id}",
    "GET /api/orders/user/{id}",
    "GET /api/orders/status/{status}",
    "GET /api/orders/by-date-range",
    "GET /api/orders/{id}/pdf",
    "PATCH /api/users/{id}/password"
  ]
};

// 3. Estructura de Árbol (Trie) para evaluación O(1) real de permisos
type TrieNode = {
  methods: Set<string>;
  children: Map<string, TrieNode>;
  wildcard?: TrieNode; // Para segmentos dinámicos como {id}, {codebar}, etc.
};

class PermissionTrie {
  root: TrieNode = { methods: new Set(), children: new Map() };

  add(permission: string) {
    const [method, path] = permission.split(' ');
    const segments = path.split('/').filter(Boolean);
    let current = this.root;

    for (const segment of segments) {
      // Si contiene {}, lo tratamos como un parámetro dinámico (wildcard)
      if (segment.startsWith('{') && segment.endsWith('}')) {
        if (!current.wildcard) {
          current.wildcard = { methods: new Set(), children: new Map() };
        }
        current = current.wildcard;
      } else {
        if (!current.children.has(segment)) {
          current.children.set(segment, { methods: new Set(), children: new Map() });
        }
        current = current.children.get(segment)!;
      }
    }
    current.methods.add(method);
  }

  // Complejidad O(K) donde K es la cantidad de fragmentos (/api/products/123 -> K=3)
  // Prácticamente equivalente a O(1) independiente del número total de permisos.
  check(method: string, path: string): boolean {
    const segments = path.split('/').filter(Boolean);

    // Búsqueda en el árbol
    const search = (node: TrieNode, index: number): boolean => {
      // Si hemos procesado todos los segmentos, verificamos que el método HTTP coincida
      if (index === segments.length) {
        return node.methods.has(method);
      }

      const segment = segments[index];

      // 1. Prioridad: Coincidencia de ruta exacta estática (ej: 'api', 'products')
      if (node.children.has(segment) && search(node.children.get(segment)!, index + 1)) {
        return true;
      }

      // 2. Fallback: Coincidencia con comodín (dinámicos como {id}, {status})
      if (node.wildcard && search(node.wildcard, index + 1)) {
        return true;
      }

      return false;
    };

    return search(this.root, 0);
  }
}

// 4. Precomputamos los árboles para cada rol en la inicialización (Solo se ejecuta 1 vez)
const roleTries = new Map<Role, PermissionTrie>();

export function initPermissions() {
  for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS) as [Role, string[]][]) {
    const trie = new PermissionTrie();
    for (const p of permissions) {
      trie.add(p);
    }
    roleTries.set(role, trie);
  }
}

// Inicializamos los árboles
initPermissions();

// 5. Funciones de utilidad para el interceptor
export function hasPermission(userRole: Role, method: string, url: string): boolean {
  const trie = roleTries.get(userRole);
  if (!trie) return false;

  return trie.check(method, url);
}

export function getUrlPattern(url: string): string {
  // Al usar un Trie, ya NO es necesario reemplazar strings arbitrarios (ej: usar RegExp /\d+/g a /{id}/).
  // El propio árbol sabe resolver por si solo TODOS LOS PARÁMETROS, numéricos y strings pasándolo a su nodo hijo comodín dinámicamente en tiempo de ejecución.
  // Solo devolvemos la URL limpia descartando los posibles query params de paginación o búsqueda
  return url.split('?')[0];
}