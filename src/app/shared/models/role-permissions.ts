// 1. Definición de tipos para mayor seguridad
export type Role = 'ADMIN' | 'CHEF' | 'ELEVATED' | 'USER';

// 2. Estructura de permisos centralizada (by GPT)
export const ROLE_PERMISSIONS: Record<Exclude<Role, 'ELEVATED'>, string[]> = {
  CHEF: [
    "GET /api/products/ledger-integrity",
    "GET /api/products/{id}/ledger/pdf",
    "GET /api/products",
    "GET /api/products/{id}",
    "GET /api/products/search",
    "GET /api/products/codebar/{codebar}",
    "GET /api/products/barcode/{barcode}",
    "GET /api/products/export/excel",
    "GET /api/stock-ledger/consumption/{productId}",
    "GET /api/stock-alerts/forecast/{productId}",
    "POST /api/products",
    "PUT /api/products/{id}",
    "PUT /api/products/{id}/stock-manual",
    "PATCH /api/products/{id}/toggle-hidden",
    "GET /api/allergens",
    "GET /api/allergens/search",
    "POST /api/allergens",
    "PUT /api/allergens/{id}",
    "GET /api/suppliers",
    "GET /api/suppliers/search",
    "GET /api/recipe-drafts",
    "GET /api/recipe-drafts/{id}",
    "GET /api/recipes",
    "GET /api/recipes/{id}",
    "GET /api/recipes/search",
    "GET /api/recipes/maxcost",
    "GET /api/recipes/{id}/pdf",
    "POST /api/recipes",
    "PUT /api/recipes/{id}",
    "POST /api/recipes/cook",
    "POST /api/recipes/cook/{auditId}/revert",
    "GET /api/products/batches/expiring",
    "GET /api/products/batches/expired",
    "GET /api/products/batches/product/{productId}",
    "POST /api/products/batches/{batchId}/withdraw",
    "PATCH /api/products/batches/{batchId}/expiration",
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
    "GET /api/orders/{id}/missing-items",
    "GET /api/orders/user/{id}",
    "GET /api/orders/status/{status}",
    "GET /api/orders/by-date-range",
    "GET /api/orders/{id}/pdf",
    "GET /api/orders/reception/pending",
    "POST /api/orders",
    "POST /api/orders/search-by-products",
    "PUT /api/orders/{id}",
    "PATCH /api/orders/{id}/status",
    "POST /api/orders/reception",
    "POST /api/order-details",
    "PUT /api/order-details/{orderId}/{productId}",
    "GET /api/order-audits",
    "GET /api/order-audits/{id}",
    "GET /api/order-audits/by-user/{id}",
    "GET /api/order-audits/by-order/{id}",
    "GET /api/order-audits/by-date-range",
    "GET /api/order-audits/confirmed",
    "PATCH /api/users/{id}/password",
    "GET /api/users",
    "GET /api/users/{id}",
    "GET /api/users/students",
    "GET /api/users/teachers",
    "GET /api/users/search",
    "GET /api/users/by-role/{role}",
    "POST /api/users/{id}/escalate",
    "POST /api/users/{id}/de-escalate",
    "GET /api/incident-types",
    "GET /api/incident-types/{id}",
    "GET /api/incidents",
    "GET /api/incidents/{id}",
    "POST /api/incidents",
    "PATCH /api/incidents/{id}/open",
    "PATCH /api/incidents/{id}/close",
    "GET /api/incidents/{id}/attachable-audits",
    "POST /api/incidents/{id}/audits",
    "POST /api/incidents/{id}/audits/{attachmentId}/revert",
    "GET /api/incidents/{id}/chat",
    "POST /api/incidents/{id}/chat",
    "GET /api/incidents/{id}/chat/attachments/{messageId}",
    "GET /api/incidents/{id}/export/pdf",
    "GET /api/chat/chats",
    "POST /api/chat/chats",
    "GET /api/chat/chats/{chatId}/messages",
    "GET /api/chat/chats/{chatId}/messages/page",
    "POST /api/chat/chats/{chatId}/messages/stream",
    "PATCH /api/chat/chats/{chatId}",
    "PATCH /api/chat/chats/{chatId}/provider",
    "DELETE /api/chat/chats/{chatId}",
    "GET /api/chat/providers",
    "GET /api/traceability/crisis",
    "GET /api/traceability/crisis/{crisisId}",
    "GET /api/traceability/forward",
    "GET /api/traceability/reverse/{cookingAuditId}",
    "GET /api/traceability/batch/{batchId}/cookings",
    "POST /api/weekly-plans",
    "PUT /api/weekly-plans/{id}",
    "PATCH /api/weekly-plans/{id}/activate",
    "PATCH /api/weekly-plans/{id}/deactivate",
    "PATCH /api/weekly-plans/{id}/slots/{slotId}/confirm",
    "PATCH /api/weekly-plans/{id}/slots/{slotId}/unconfirm",
    "PATCH /api/weekly-plans/{id}/days/{dayOfWeek}/confirm",
    "PATCH /api/weekly-plans/{id}/days/{dayOfWeek}/unconfirm",
    "GET /api/weekly-plans/{id}",
    "GET /api/weekly-plans",
    "GET /api/weekly-plans/current",
    "GET /api/weekly-plans/{id}/stock-requirements",
    "PATCH /api/weekly-plans/{id}/slots/{slotId}/cancel",
    "PATCH /api/weekly-plans/{id}/slots/{slotId}/students/{studentId}/cancel",
    "PATCH /api/weekly-plans/{id}/days/{dayOfWeek}/students/{studentId}/cancel",
    "GET /api/weekly-plans/metrics/students",
    "GET /api/notifications",
    "PATCH /api/notifications/{id}/read",
    "PATCH /api/notifications/read-all",
    "GET /api/user-activity/my-students"
  ],
  ADMIN: [
    "GET /api/products/with-ledger",
    "GET /api/products/ledger-integrity",
    "GET /api/products/{id}/ledger/pdf",
    "GET /api/products",
    "GET /api/products/{id}",
    "GET /api/products/batches/product/{productId}",
    "GET /api/products/batches/expiring",
    "GET /api/products/batches/expired",
    "POST /api/products/batches/{batchId}/withdraw",
    "PATCH /api/products/batches/{batchId}/expiration",
    "GET /api/products/hidden",
    "GET /api/products/search",
    "GET /api/products/codebar/{codebar}",
    "GET /api/products/barcode/{barcode}",
    "GET /api/products/export/excel",
    "POST /api/products",
    "PUT /api/products/{id}",
    "PUT /api/products/{id}/stock-manual",
    "PATCH /api/products/{id}/toggle-hidden",
    "DELETE /api/products/{id}",
    "GET /api/allergens",
    "GET /api/allergens/search",
    "POST /api/allergens",
    "PUT /api/allergens/{id}",
    "DELETE /api/allergens/{id}",
    "GET /api/suppliers",
    "GET /api/suppliers/search",
    "GET /api/suppliers/{id}",
    "GET /api/recipe-drafts",
    "GET /api/recipe-drafts/{id}",
    "PATCH /api/recipe-drafts/{id}/approve",
    "PATCH /api/recipe-drafts/{id}/reject",
    "POST /api/suppliers",
    "PUT /api/suppliers/{id}",
    "DELETE /api/suppliers/{id}",
    "GET /api/recipes",
    "GET /api/recipes/{id}",
    "GET /api/recipes/search",
    "GET /api/recipes/maxcost", // Updated from by-max-cost
    "GET /api/recipes/{id}/pdf",
    "POST /api/recipes",
    "PUT /api/recipes/{id}",
    "POST /api/recipes/cook",
    "POST /api/recipes/cook/{auditId}/revert", // Added for ADMIN
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
    "GET /api/orders/{id}/missing-items",
    "GET /api/orders/user/{id}",
    "GET /api/orders/status/{status}",
    "GET /api/orders/by-date-range",
    "GET /api/orders/{id}/pdf",
    "GET /api/orders/reception/pending",
    "POST /api/orders",
    "POST /api/orders/search-by-products",
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
    "GET /api/users/students",
    "GET /api/users/teachers",
    "POST /api/users/{id}/escalate",
    "POST /api/users/{id}/de-escalate",
    "PATCH /api/users/{id}/teacher",
    "GET /api/users/students/unassigned",
    "PATCH /api/users/batch/teacher",
    "GET /api/incident-types",
    "GET /api/incident-types/all",
    "GET /api/incident-types/{id}",
    "POST /api/incident-types",
    "PUT /api/incident-types/{id}",
    "PATCH /api/incident-types/{id}/toggle-active",
    "GET /api/incidents",
    "GET /api/incidents/{id}",
    "POST /api/incidents",
    "PATCH /api/incidents/{id}/open",
    "PATCH /api/incidents/{id}/close",
    "GET /api/incidents/{id}/attachable-audits",
    "POST /api/incidents/{id}/audits",
    "POST /api/incidents/{id}/audits/{attachmentId}/revert",
    "GET /api/incidents/{id}/chat",
    "POST /api/incidents/{id}/chat",
    "GET /api/incidents/{id}/chat/attachments/{messageId}",
    "GET /api/incidents/{id}/export/pdf",
    "GET /api/chat/chats",
    "POST /api/chat/chats",
    "GET /api/chat/chats/{chatId}/messages",
    "GET /api/chat/chats/{chatId}/messages/page",
    "POST /api/chat/chats/{chatId}/messages/stream",
    "PATCH /api/chat/chats/{chatId}",
    "PATCH /api/chat/chats/{chatId}/provider",
    "DELETE /api/chat/chats/{chatId}",
    "GET /api/chat/providers",
    "GET /api/recipe-audits",
    "GET /api/recipe-audits/{id}",
    "GET /api/recipe-audits/by-user/{id}",
    "GET /api/recipe-audits/by-recipe/{id}",
    "GET /api/recipe-audits/by-date-range",
    "GET /api/recipe-cooking-audits",
    "GET /api/recipe-cooking-audits/recipe/{id}",
    "GET /api/recipe-cooking-audits/user/{id}",
    "GET /api/recipe-cooking-audits/date-range",
    "GET /api/recipe-cooking-audits/search",
    "GET /api/recipe-cooking-audit",
    "GET /api/recipe-cooking-audit/recipe/{id}",
    "GET /api/recipe-cooking-audit/user/{id}",
    "GET /api/recipe-cooking-audit/date-range",
    "GET /api/recipe-cooking-audit/search",
    "GET /api/order-audits",
    "GET /api/order-audits/{id}",
    "GET /api/order-audits/by-user/{id}",
    "GET /api/order-audits/by-order/{id}",
    "GET /api/order-audits/by-date-range",
    "POST /api/stock-ledger/manual-adjustment",
    "POST /api/stock-ledger/batch",
    "GET /api/stock-ledger/consumption/{productId}",
    "GET /api/stock-ledger/history/{productId}",
    "GET /api/stock-ledger/verify/{productId}",
    "GET /api/stock-ledger/verify-all",
    "GET /api/stock-ledger/snapshot/{productId}",
    "GET /api/admin/blockchain/stats",
    "GET /api/admin/blockchain/verify",
    "GET /api/admin/blockchain/blocks",
    "GET /api/admin/blockchain/blocks/{blockNumber}",
    "GET /api/admin/blockchain/mempool",
    "DELETE /api/stock-ledger/reset/{productId}",
    "GET /api/kitchen-reports",
    "GET /api/kitchen-reports/export/pdf",
    "GET /api/stock-alerts",
    "GET /api/stock-alerts/{productId}",
    "POST /api/stock-alerts/batch",
    "GET /api/stock-alerts/predictions",
    "GET /api/stock-alerts/forecast",
    "GET /api/stock-alerts/forecast/{productId}",
    "POST /api/traceability/crisis/activate",
    "GET /api/traceability/crisis",
    "GET /api/traceability/crisis/{crisisId}",
    "POST /api/traceability/crisis/lift",
    "GET /api/traceability/crisis/{crisisId}/report/download",
    "GET /api/traceability/forward",
    "GET /api/traceability/reverse/{cookingAuditId}",
    "GET /api/traceability/batch/{batchId}/cookings",
    "POST /api/notifications/role/{role}",
    "POST /api/notifications/user/{username}",
    "GET /api/stats/recipes",
    "GET /api/stats/recipes/with-allergens/count",
    "GET /api/stats/recipes/without-allergens/count",
    "GET /api/stats/recipes/average-cost",
    "GET /api/stats/products",
    "GET /api/inventory-audits",
    "GET /api/inventory-audits/{id}",
    "GET /api/inventory-audits/type/{type}",
    "GET /api/inventory-audits/by-date-range",
    "POST /api/weekly-plans",
    "PUT /api/weekly-plans/{id}",
    "PATCH /api/weekly-plans/{id}/activate",
    "PATCH /api/weekly-plans/{id}/deactivate",
    "PATCH /api/weekly-plans/{id}/slots/{slotId}/confirm",
    "PATCH /api/weekly-plans/{id}/slots/{slotId}/unconfirm",
    "PATCH /api/weekly-plans/{id}/days/{dayOfWeek}/confirm",
    "PATCH /api/weekly-plans/{id}/days/{dayOfWeek}/unconfirm",
    "GET /api/weekly-plans/{id}",
    "GET /api/weekly-plans",
    "GET /api/weekly-plans/current",
    "GET /api/weekly-plans/{id}/stock-requirements",
    "PATCH /api/weekly-plans/{id}/slots/{slotId}/cancel",
    "PATCH /api/weekly-plans/{id}/slots/{slotId}/students/{studentId}/cancel",
    "PATCH /api/weekly-plans/{id}/days/{dayOfWeek}/students/{studentId}/cancel",
    "GET /api/weekly-plans/metrics/students",
    "GET /api/notifications",
    "PATCH /api/notifications/{id}/read",
    "PATCH /api/notifications/read-all",
    "GET /api/config/current",
    "GET /api/config/audit-log/",
    "GET /api/config/presence/",
    "PUT /api/config/presence/",
    "DELETE /api/config/presence/logs",
    "GET /api/config/presence/audit-log",
    "GET /api/config/alerts/",
    "PUT /api/config/alerts/",
    "GET /api/config/alerts/audit-log",
    "GET /api/config/predictions/",
    "PUT /api/config/predictions/",
    "GET /api/config/predictions/audit-log",
    "GET /api/config/sessions/",
    "PUT /api/config/sessions/",
    "GET /api/config/sessions/audit-log",
    "GET /api/config/security/",
    "PUT /api/config/security/",
    "GET /api/config/security/audit-log",
    "GET /api/config/incidents/",
    "PUT /api/config/incidents/",
    "GET /api/config/incidents/audit-log",
    "GET /api/config/notifications/",
    "PUT /api/config/notifications/",
    "DELETE /api/config/notifications/logs",
    "GET /api/config/notifications/audit-log",
    "GET /api/config/advanced/",
    "PUT /api/config/advanced/",
    "GET /api/config/advanced/audit-log",
    "GET /api/config/ai-keys/",
    "POST /api/config/ai-keys/",
    "PUT /api/config/ai-keys/",
    "DELETE /api/config/ai-keys/{provider}",
    "GET /api/users/search",
    "GET /api/user-activity",
    "GET /api/user-activity/user/{userId}",
    "GET /api/user-activity/my-students"
  ],
  USER: [
    "GET /api/products/with-ledger",
    "GET /api/products",
    "GET /api/products/{id}",
    "GET /api/products/search",
    "GET /api/products/codebar/{codebar}",
    "GET /api/products/barcode/{barcode}",
    "GET /api/products/export/excel",
    "GET /api/products/batches/expiring",
    "GET /api/products/batches/expired",
    "GET /api/products/batches/product/{productId}",
    "GET /api/allergens",
    "GET /api/allergens/search",
    "GET /api/suppliers",
    "GET /api/recipe-drafts/mine",
    "GET /api/recipe-drafts/{id}",
    "POST /api/recipe-drafts",
    "PUT /api/recipe-drafts/{id}",
    "DELETE /api/recipe-drafts/{id}",
    "GET /api/recipes",
    "GET /api/recipes/{id}",
    "GET /api/recipes/search",
    "GET /api/recipes/maxcost",
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
    "PATCH /api/users/{id}/password",
    "GET /api/notifications",
    "PATCH /api/notifications/{id}/read",
    "PATCH /api/notifications/read-all"
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
  for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS) as [Exclude<Role, 'ELEVATED'>, string[]][]) {
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
  const normalizedRole = userRole === 'ELEVATED' ? 'CHEF' : userRole;
  const trie = roleTries.get(normalizedRole as Role);
  if (!trie) return false;

  return trie.check(method, url);
}

export function getUrlPattern(url: string): string {
  return url.split('?')[0];
}