Mejorar estilos del modo claro para calidad premium
Contexto
Repo: user-ijavieh/smart-economato (branch master)
Estado actual: Light mode funcional pero plano — tokens centralizados cubren lo básico, pero 34 de 38 componentes no tienen overrides específicos de light mode
Objetivo: Que el light mode se vea igual de premium que el dark mode, con glassmorphism claro, profundidad, y colores semánticos adaptados
FASE 1 — Nuevos tokens semánticos y overrides faltantes en styles.css
Archivo: src/styles.css
1.1 Añadir tokens semánticos de color en :root (dark mode)
Estos tokens representan colores semánticos que cambian entre temas:


:root {  
  /* ... tokens existentes ... */  
  
  /* Semantic colors — dark mode variants (designed for dark backgrounds) */  
  --color-success: #34d399;  
  --color-success-muted: #a7f3d0;  
  --color-success-bg: rgba(16, 185, 129, 0.15);  
  --color-success-border: rgba(16, 185, 129, 0.3);  
  --color-success-hover-bg: rgba(16, 185, 129, 0.25);  
  --color-success-hover-border: rgba(16, 185, 129, 0.5);  
  
  --color-danger: #f87171;  
  --color-danger-muted: #ff8a8a;  
  --color-danger-bg: rgba(239, 68, 68, 0.15);  
  --color-danger-border: rgba(239, 68, 68, 0.3);  
  --color-danger-hover-bg: rgba(239, 68, 68, 0.25);  
  --color-danger-hover-border: rgba(239, 68, 68, 0.5);  
  
  --color-warning: #fde047;  
  --color-warning-muted: #facc15;  
  --color-warning-bg: rgba(250, 204, 21, 0.15);  
  --color-warning-border: rgba(250, 204, 21, 0.3);  
  
  --color-info: #93c5fd;  
  --color-info-bg: rgba(59, 130, 246, 0.15);  
  --color-info-border: rgba(59, 130, 246, 0.3);  
  
  --color-accent-admin: #9DB5FF;  
  --color-accent-admin-bg: rgba(90, 120, 220, 0.15);  
  --color-accent-admin-border: rgba(90, 120, 220, 0.3);  
  --color-accent-admin-hover-bg: rgba(90, 120, 220, 0.25);  
  --color-accent-admin-hover-border: rgba(90, 120, 220, 0.4);  
  
  /* Section headers (table headers, modal headers, card headers) */  
  --theme-section-header-bg: rgba(0, 0, 0, 0.3);  
  --theme-section-header-bg-strong: rgba(0, 0, 0, 0.4);  
  
  /* Native inputs */  
  --theme-option-bg: #1e1e1e;  
  --theme-color-scheme: dark;  
  
  /* Text glow */  
  --theme-heading-glow: 0 0 10px var(--brand-glow);  
  --theme-heading-glow-admin: 0 0 10px rgba(90, 120, 220, 0.4);  
}
1.2 Overrides en [data-theme="light"]
Añadir al bloque [data-theme="light"] existente:


[data-theme="light"] {  
  /* ... overrides existentes ... */  
  
  /* Semantic colors — light mode (darker/more saturated for light backgrounds) */  
  --color-success: #059669;  
  --color-success-muted: #10b981;  
  --color-success-bg: rgba(5, 150, 105, 0.08);  
  --color-success-border: rgba(5, 150, 105, 0.20);  
  --color-success-hover-bg: rgba(5, 150, 105, 0.12);  
  --color-success-hover-border: rgba(5, 150, 105, 0.35);  
  
  --color-danger: #dc2626;  
  --color-danger-muted: #ef4444;  
  --color-danger-bg: rgba(220, 38, 38, 0.06);  
  --color-danger-border: rgba(220, 38, 38, 0.18);  
  --color-danger-hover-bg: rgba(220, 38, 38, 0.10);  
  --color-danger-hover-border: rgba(220, 38, 38, 0.30);  
  
  --color-warning: #d97706;  
  --color-warning-muted: #f59e0b;  
  --color-warning-bg: rgba(217, 119, 6, 0.06);  
  --color-warning-border: rgba(217, 119, 6, 0.18);  
  
  --color-info: #2563eb;  
  --color-info-bg: rgba(37, 99, 235, 0.06);  
  --color-info-border: rgba(37, 99, 235, 0.18);  
  
  --color-accent-admin: #3B82F6;  
  --color-accent-admin-bg: rgba(59, 130, 246, 0.06);  
  --color-accent-admin-border: rgba(59, 130, 246, 0.15);  
  --color-accent-admin-hover-bg: rgba(59, 130, 246, 0.10);  
  --color-accent-admin-hover-border: rgba(59, 130, 246, 0.25);  
  
  /* Section headers — light frosted instead of dark */  
  --theme-section-header-bg: rgba(0, 0, 0, 0.02);  
  --theme-section-header-bg-strong: rgba(0, 0, 0, 0.04);  
  
  /* Native inputs */  
  --theme-option-bg: #ffffff;  
  --theme-color-scheme: light;  
  
  /* Text glow — subtle or none in light mode */  
  --theme-heading-glow: none;  
  --theme-heading-glow-admin: none;  
  
  /* Missing overrides */  
  --theme-text-muted: rgba(0, 0, 0, 0.30);  
  --theme-border-subtle: rgba(0, 0, 0, 0.04);  
  
  /* Premium depth — multi-layer shadows for light mode */  
  --theme-shadow-card: 0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.03);  
  --theme-shadow-hover: 0 4px 12px rgba(15, 23, 42, 0.06), 0 12px 40px rgba(15, 23, 42, 0.10), 0 0 0 1px rgba(0, 0, 0, 0.04);  
}
1.3 Admin light mode overrides
Añadir al bloque [data-theme="light"] body.admin-theme existente:


[data-theme="light"] body.admin-theme,  
body.admin-theme[data-theme="light"],  
[data-theme="light"] .admin-theme {  
  /* ... overrides existentes ... */  
  
  --color-accent-admin: #2563eb;  
  --color-accent-admin-bg: rgba(37, 99, 235, 0.06);  
  --color-accent-admin-border: rgba(37, 99, 235, 0.12);  
  --theme-section-header-bg: rgba(37, 99, 235, 0.03);  
  --theme-section-header-bg-strong: rgba(37, 99, 235, 0.05);  
  --theme-heading-glow-admin: none;  
}
FASE 2 — Migrar fondos oscuros de secciones a tokens
Patrón a reemplazar en TODOS los componentes:
Valor hardcodeado	Token de reemplazo
background: rgba(0, 0, 0, 0.3) (modal/section headers)	background: var(--theme-section-header-bg)
background: rgba(0, 0, 0, 0.4) (table headers th)	background: var(--theme-section-header-bg-strong)
background: rgba(0, 0, 0, 0.2) (card headers, overlays ligeros)	background: var(--theme-section-header-bg)
background: rgba(0, 0, 0, 0.7) (modal overlays)	background: var(--theme-overlay-bg) (ya existe)
Archivos afectados (buscar y reemplazar):
Páginas admin (12 archivos — th con rgba(0,0,0,0.4) y modal headers con rgba(0,0,0,0.3)):

allergens-management.component.css — líneas 306, 553
products-management.component.css — líneas 403, 713, 754, 871, 878
recipes-management.component.css — buscar rgba(0, 0, 0, 0.3) y rgba(0, 0, 0, 0.4)
kitchen-management.component.css
stock-management.component.css
traceability-management.component.css
users-management.component.css
orders-management.component.css
batches-management.component.css
suppliers-management.component.css
user-form-modal.component.css
supplier-form-modal.component.css
Páginas general (8 archivos):

inventory.component.css — línea 423 (.panel-header)
orders.component.css — línea 202 (.order-card-header)
profile.component.css — línea 131, 168
reception.component.css
recipes.component.css
Modales: product-detail-modal, recipe-detail-modal, order-details-modal, etc.
Nota: NO reemplazar rgba(0, 0, 0, 0.7) en overlays de modales — usar var(--theme-overlay-bg) que ya tiene override en light mode.

FASE 3 — Migrar colores semánticos hardcodeados a tokens
3.1 Colores de texto/badges semánticos
Buscar y reemplazar en TODOS los archivos CSS:

Valor hardcodeado	Token	Contexto
color: #ff8a8a	color: var(--color-danger-muted)	Texto de peligro/error
color: #f87171	color: var(--color-danger)	Texto de peligro/acción
color: #fca5a5	color: var(--color-danger-muted)	Stock bajo
color: #34d399	color: var(--color-success)	Texto de éxito
color: #a7f3d0	color: var(--color-success-muted)	Texto de éxito suave
color: #6ee7b7	color: var(--color-success-muted)	Excel/export
color: #86efac	color: var(--color-success-muted)	Cantidad positiva
color: #fde047	color: var(--color-warning)	Advertencia
color: #facc15	color: var(--color-warning-muted)	Caducidad próxima
color: #fbbf24	color: var(--color-warning-muted)	Badge elevated
color: #9DB5FF	color: var(--color-accent-admin)	Precio, iconos admin
color: #93c5fd	color: var(--color-info)	Badge info/role
3.2 Fondos de badges semánticos
Valor hardcodeado	Token
background: rgba(16, 185, 129, 0.15)	background: var(--color-success-bg)
border-color: rgba(16, 185, 129, 0.3)	border-color: var(--color-success-border)
background: rgba(239, 68, 68, 0.15)	background: var(--color-danger-bg)
border-color: rgba(239, 68, 68, 0.3)	border-color: var(--color-danger-border)
background: rgba(250, 204, 21, 0.15)	background: var(--color-warning-bg)
border-color: rgba(250, 204, 21, 0.3)	border-color: var(--color-warning-border)
background: rgba(90, 120, 220, 0.15)	background: var(--color-accent-admin-bg)
border-color: rgba(90, 120, 220, 0.3)	border-color: var(--color-accent-admin-border)
background: rgba(90, 120, 220, 0.2)	background: var(--color-accent-admin-bg)
border-color: rgba(90, 120, 220, 0.4)	border-color: var(--color-accent-admin-border)
3.3 Hover states de badges
Valor hardcodeado	Token
background: rgba(16, 185, 129, 0.25)	background: var(--color-success-hover-bg)
border-color: rgba(16, 185, 129, 0.5)	border-color: var(--color-success-hover-border)
background: rgba(239, 68, 68, 0.25)	background: var(--color-danger-hover-bg)
border-color: rgba(239, 68, 68, 0.5)	border-color: var(--color-danger-hover-border)
background: rgba(90, 120, 220, 0.25)	background: var(--color-accent-admin-hover-bg)
border-color: rgba(90, 120, 220, 0.4)	border-color: var(--color-accent-admin-hover-border)
IMPORTANTE: Hay ~500 ocurrencias en 33 archivos. Hacer el reemplazo con cuidado — algunos colores como #4caf50 y #ef4444 en sort indicators (th.sortable::after) son puramente decorativos y pueden mantenerse, ya que son pequeños indicadores que funcionan en ambos temas.

FASE 4 — Dropdowns nativos y date inputs
4.1 Select option backgrounds
Buscar option { background: #1e1e1e en todos los archivos y reemplazar por:


option { background: var(--theme-option-bg); color: var(--theme-text-primary); }
Archivos afectados:

products-management.component.css (línea 182)
inventory.component.css (línea 382)
Cualquier otro componente con <select>
4.2 Date inputs color-scheme
Buscar color-scheme: dark y reemplazar por:


color-scheme: var(--theme-color-scheme);
Archivos afectados:

products-management.component.css (línea 207)
recipes-management.component.css
batch-expiration-modal.component.css
FASE 5 — Text shadows y glows de headings
5.1 Páginas general (glow rojo)
Buscar text-shadow: 0 0 10px var(--brand-glow) en:

inventory.component.css
orders.component.css
reception.component.css
recipes.component.css
profile.component.css
Reemplazar por:


text-shadow: var(--theme-heading-glow);
5.2 Páginas admin (glow azul)
Buscar text-shadow: 0 0 10px rgba(90, 120, 220, 0.4) en:

products-management.component.css
allergens-management.component.css
Todos los demás componentes admin
Reemplazar por:


text-shadow: var(--theme-heading-glow-admin);
FASE 6 — Profundidad premium en light mode
6.1 Glassmorphism claro para cards y contenedores
Añadir al final de styles.css un bloque global de overrides para light mode que aplique a todos los componentes a través de la herencia de tokens:


/* Premium light mode depth enhancements */  
[data-theme="light"] {  
  /* Glass surfaces get a subtle inner glow */  
  --theme-surface-glass: rgba(255, 255, 255, 0.80);  
  /* Slightly stronger blur for frosted glass effect */  
  --theme-effect-glass: blur(28px);  
}
6.2 Stat cards con borde superior coloreado
Los stat cards usan border-top: 2px solid var(--theme-border-medium). En light mode, --theme-border-medium es rgba(0,0,0,0.12) que es gris. Esto está bien — los bordes de color semántico (.stat-card.stat-visible { border-top-color: rgba(74, 222, 128, 0.8); }) necesitan adaptarse:

Crear tokens:


:root {  
  --color-success-accent: rgba(74, 222, 128, 0.8);  
  --color-warning-accent: rgba(250, 204, 21, 0.8);  
  --color-admin-accent: rgba(90, 120, 220, 0.8);  
}  
  
[data-theme="light"] {  
  --color-success-accent: rgba(5, 150, 105, 0.6);  
  --color-warning-accent: rgba(217, 119, 6, 0.6);  
  --color-admin-accent: rgba(37, 99, 235, 0.6);  
}
Y reemplazar en los componentes:

.stat-card.stat-visible { border-top-color: var(--color-success-accent); }
.stat-card.stat-value { border-top-color: var(--color-warning-accent); }
.stat-card.stat-cost { border-top-color: var(--color-admin-accent); }
6.3 Modal overlay más suave en light mode
El token --theme-overlay-bg ya se overridea a rgba(0, 0, 0, 0.45) en light mode. Verificar que TODOS los modal overlays usen var(--theme-overlay-bg) en vez de rgba(0, 0, 0, 0.7) hardcodeado.

Archivos con rgba(0, 0, 0, 0.7) en overlays:

products-management.component.css (.audit-modal-overlay)
allergens-management.component.css (.allergen-modal-overlay)
Todos los demás modales admin y general
Reemplazar por var(--theme-overlay-bg).

## FASE 7 (continuación) — Overrides por componente

### 7.3 Aplicar patrón repetible a TODAS las páginas admin

Los 10 componentes admin (`allergens`, `batches`, `kitchen`, `orders`, `products`, `recipes`, `stock`, `suppliers`, `traceability`, `users`) comparten exactamente el mismo patrón de estilos. Para cada uno, añadir al final de su `.component.css`:

```css
/* ===== LIGHT MODE ===== */
:host-context([data-theme="light"]) .header-recetas h1,
:host-context([data-theme="light"]) .header-stock h1 {
  text-shadow: none;
  color: #1E293B;
}

:host-context([data-theme="light"]) .tab-btn.active::after {
  background: linear-gradient(135deg, #3B82F6, #60A5FA);
}

:host-context([data-theme="light"]) th {
  background: rgba(0, 0, 0, 0.03);
}

:host-context([data-theme="light"]) tfoot td {
  background: rgba(0, 0, 0, 0.02);
}

:host-context([data-theme="light"]) th.sortable[data-sort-dir='asc']::after {
  color: #059669;
}

:host-context([data-theme="light"]) th.sortable[data-sort-dir='desc']::after {
  color: #DC2626;
}
```

**Archivos** (añadir al final de cada uno):
- `src/app/features/admin/allergens-management/allergens-management.component.css`
- `src/app/features/admin/batches-management/batches-management.component.css`
- `src/app/features/admin/kitchen-management/kitchen-management.component.css`
- `src/app/features/admin/orders-management/orders-management.component.css`
- `src/app/features/admin/products-management/products-management.component.css`
- `src/app/features/admin/recipes-management/recipes-management.component.css`
- `src/app/features/admin/stock-management/stock-management.component.css`
- `src/app/features/admin/suppliers-management/suppliers-management.component.css`
- `src/app/features/admin/traceability-management/traceability-management.component.css`
- `src/app/features/admin/users-management/users-management.component.css`

### 7.4 Colores semánticos — Crear tokens en `styles.css`

Antes de los overrides por componente, añadir estos tokens semánticos en `:root` y `[data-theme="light"]` de `styles.css`:

**En `:root` (dark mode):**
```css
/* Semantic status colors */
--color-success: #34d399;
--color-success-soft: #a7f3d0;
--color-success-bg: rgba(52, 211, 153, 0.12);
--color-success-border: rgba(52, 211, 153, 0.3);
--color-danger: #ff8a8a;
--color-danger-soft: #fca5a5;
--color-danger-bg: rgba(239, 68, 68, 0.12);
--color-warning: #fbbf24;
--color-warning-soft: #fde68a;
--color-warning-bg: rgba(251, 191, 36, 0.12);
--color-warning-border: rgba(251, 191, 36, 0.3);
--color-info: #60a5fa;
--color-info-bg: rgba(96, 165, 250, 0.12);
--color-accent-admin: #9DB5FF;
--color-accent-admin-bg: rgba(90, 120, 220, 0.12);
--color-accent-admin-border: rgba(90, 120, 220, 0.3);
```

**En `[data-theme="light"]`:**
```css
/* Semantic status colors — light mode */
--color-success: #059669;
--color-success-soft: #10b981;
--color-success-bg: rgba(5, 150, 105, 0.08);
--color-success-border: rgba(5, 150, 105, 0.2);
--color-danger: #DC2626;
--color-danger-soft: #EF4444;
--color-danger-bg: rgba(220, 38, 38, 0.06);
--color-warning: #D97706;
--color-warning-soft: #F59E0B;
--color-warning-bg: rgba(217, 119, 6, 0.08);
--color-warning-border: rgba(217, 119, 6, 0.2);
--color-info: #2563EB;
--color-info-bg: rgba(37, 99, 235, 0.06);
--color-accent-admin: #3B82F6;
--color-accent-admin-bg: rgba(59, 130, 246, 0.06);
--color-accent-admin-border: rgba(59, 130, 246, 0.15);
```

### 7.5 Migrar colores semánticos hardcodeados en los 10 componentes admin

En CADA componente admin, buscar y reemplazar:

| Valor hardcodeado | Reemplazo |
|---|---|
| `color: #34d399` | `color: var(--color-success)` |
| `color: #a7f3d0` | `color: var(--color-success-soft)` |
| `color: #86efac` | `color: var(--color-success)` |
| `color: #ff8a8a` | `color: var(--color-danger)` |
| `color: #f87171` | `color: var(--color-danger)` |
| `color: #fca5a5` | `color: var(--color-danger-soft)` |
| `color: #fbbf24` | `color: var(--color-warning)` |
| `color: #fde68a` | `color: var(--color-warning-soft)` |
| `color: #9DB5FF` | `color: var(--color-accent-admin)` |
| `background: rgba(52, 211, 153, 0.1X)` | `background: var(--color-success-bg)` |
| `background: rgba(239, 68, 68, 0.1X)` | `background: var(--color-danger-bg)` |
| `background: rgba(251, 191, 36, 0.1X)` | `background: var(--color-warning-bg)` |

**Archivos afectados** (los mismos 10 admin + sus sub-modales):
- `stock-management.component.css` (56 ocurrencias — el más afectado)
- `recipes-management.component.css` (30)
- `products-management.component.css` (28)
- `traceability-management.component.css` (26)
- `kitchen-management.component.css` (20)
- `orders-management.component.css` (20)
- `batches-management.component.css` (18)
- `users-management.component.css` (14)
- `allergens-management.component.css` (10)
- `suppliers-management.component.css` (10)

### 7.6 Migrar colores semánticos en componentes general

Misma tabla de reemplazos para:
- `inventory.component.css` (12 ocurrencias)
- `product-detail-modal.component.css` (18)
- `orders.component.css` (7)
- `order-modal.component.css` (14)
- `order-details-modal.component.css` (6)
- `recipes.component.css` (4)
- `recipe-create-modal.component.css` (12)
- `recipe-detail-modal.component.css` (12)
- `recipe-edit-modal.component.css` (11)
- `reception.component.css` (6)
- `order-reception-modal.component.css` (4)
- `barcode-scanner.component.css` (6)
- `profile.component.css` (6)
- `product-create-modal.component.css` (10)
- `product-edit-modal.component.css` (8)

---

## FASE 8 — `select option` y `color-scheme`

### 8.1 Migrar `select option { background: #1e1e1e }`

En los 10 archivos que tienen este patrón, añadir un override light mode:

```css
:host-context([data-theme="light"]) .action-select option,
:host-context([data-theme="light"]) select option {
  background: #FFFFFF;
  color: #1E293B;
}
```

**Archivos**: `products-management`, `recipes-management`, `batches-management`, `kitchen-management`, `orders-management`, `users-management`, `user-form-modal`, `inventory/product-create-modal`, `inventory/product-edit-modal`, `recipes/recipes.component.css`

### 8.2 Migrar `color-scheme: dark`

En los 3 archivos que tienen `color-scheme: dark`, añadir:

```css
:host-context([data-theme="light"]) input[type="date"],
:host-context([data-theme="light"]) input[type="number"],
:host-context([data-theme="light"]) select {
  color-scheme: light;
}
```

**Archivos**: `products-management.component.css`, `recipes-management.component.css`, `batch-expiration-modal.component.css`

---

## FASE 9 — `text-shadow` glow

### 9.1 Admin headers

Los 10 componentes admin tienen `text-shadow: 0 0 10px rgba(90, 120, 220, 0.4)` en sus `h1`. Ya cubierto en 7.3 con `text-shadow: none` en light mode.

### 9.2 General headers

Los 5 componentes general (`inventory`, `orders`, `reception`, `recipes`, `profile`) tienen `text-shadow: 0 0 10px var(--brand-glow)`. Añadir al final de cada uno:

```css
:host-context([data-theme="light"]) .header-inventario h1,
:host-context([data-theme="light"]) .header-pedidos h1,
:host-context([data-theme="light"]) .reception-header h1,
:host-context([data-theme="light"]) .header-recetas h1,
:host-context([data-theme="light"]) .header-perfil h1 {
  text-shadow: none;
  color: #1E293B;
}
```

(Usar el selector correcto de cada componente — `.header-inventario`, `.header-pedidos`, `.reception-header`, `.header-recetas`, `.header-perfil`)

---

## FASE 10 — Admin Panel (caso especial)

### Archivo: `src/app/features/admin/admin-panel/admin-panel.component.css`

Este componente tiene un diseño completamente diferente (welcome card con gradientes azules). Tiene 12 ocurrencias de `rgba(30, 40, 80, ...)` y `#1a1a2e` hardcodeados.

Añadir al final:

```css
/* ===== LIGHT MODE ===== */
:host-context([data-theme="light"]) .welcome-card {
  background: rgba(255, 255, 255, 0.85);
  border-color: rgba(59, 130, 246, 0.12);
  box-shadow: 0 8px 32px rgba(15, 23, 42, 0.08);
}

:host-context([data-theme="light"]) .admin-icon {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.15));
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.12);
}

@keyframes pulse-light {
  0%, 100% { box-shadow: 0 4px 20px rgba(59, 130, 246, 0.12); }
  50% { box-shadow: 0 4px 30px rgba(59, 130, 246, 0.25); }
}

:host-context([data-theme="light"]) .admin-icon {
  animation-name: pulse-light;
}

:host-context([data-theme="light"]) .welcome-title {
  color: #1E293B;
}

:host-context([data-theme="light"]) .welcome-subtitle {
  color: #64748B;
}

:host-context([data-theme="light"]) .master-data-header {
  color: #94A3B8;
}

:host-context([data-theme="light"]) .master-data-header svg {
  color: #94A3B8;
}

:host-context([data-theme="light"]) .master-card {
  background: rgba(255, 255, 255, 0.75);
  border-color: rgba(59, 130, 246, 0.10);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
}

:host-context([data-theme="light"]) a.master-card:hover {
  background: rgba(255, 255, 255, 0.90);
  border-color: rgba(59, 130, 246, 0.20);
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.08);
}

:host-context([data-theme="light"]) .master-card--disabled {
  background: rgba(0, 0, 0, 0.03) !important;
  border-color: rgba(0, 0, 0, 0.06) !important;
}

:host-context([data-theme="light"]) .master-card-badge {
  background: rgba(245, 158, 11, 0.08);
  color: #D97706;
  border-color: rgba(245, 158, 11, 0.15);
}
```

---

## FASE 11 — Stock Update Modal (caso especial)

### Archivo: `src/app/features/general/inventory/stock-update-modal/stock-update-modal.component.css`

Este modal usa un diseño completamente diferente al resto — tiene `background: white`, colores como `#f9fafb`, `#e5e7eb`, `#374151`, `#4b5563`, `#6b7280`. Irónicamente, este modal ya se ve bien en light mode pero MAL en dark mode (texto oscuro sobre fondo blanco dentro de una app oscura).

**Decisión de diseño**: Este modal debería adaptarse al tema. Hay dos opciones:
1. Convertirlo al estilo glassmorphism como el resto de modales (más trabajo, más consistente)
2. Dejarlo como está (ya funciona en light mode, se ve raro en dark mode)

**Recomendación**: Opción 1 — convertirlo al estilo glassmorphism. Reemplazar:

```css
/* Cambiar valores hardcodeados a tokens */
.modal-content {
  background: var(--theme-modal-glass);  /* era: white */
  backdrop-filter: var(--theme-effect-glass);
  border: 1px solid var(--theme-border-glass);
}

.product-info {
  background: var(--theme-surface-glass-hover);  /* era: #f9fafb */
  border-color: var(--theme-border-glass);  /* era: #e5e7eb */
}

.product-info p { color: var(--theme-text-secondary); }  /* era: #4b5563 */
.product-info strong { color: var(--theme-text-primary); }  /* era: #374151 */
.form-group label { color: var(--theme-text-primary); }  /* era: #374151 */
.unit-label { color: var(--theme-text-secondary); }  /* era: #6b7280 */
.hint { color: var(--theme-text-secondary); }  /* era: #6b7280 */

input {
  border-color: var(--theme-border-glass);  /* era: #e5e7eb */
  background: var(--theme-input-bg);
  color: var(--theme-text-primary);
}

.modal-footer {
  border-top-color: var(--theme-border-glass);  /* era: #e5e7eb */
  background: var(--theme-surface-glass-hover);  /* era: #f9fafb */
}

.btn-cancel {
  background: var(--theme-surface-glass-active);  /* era: #6b7280 */
  color: var(--theme-text-primary);
}

.btn-save:disabled {
  background: var(--theme-surface-glass-hover);  /* era: #ccc */
  color: var(--theme-text-secondary);
}
```

También migrar los `.admin-mode` overrides de `rgba(30, 40, 80, ...)` a tokens admin.

---

## FASE 12 — Scrollbars en light mode

### 12.1 Admin scrollbars en componentes

Los 10 componentes admin definen sus propios scrollbar styles con `var(--admin-scrollbar-*)` y fallbacks hardcodeados. Añadir overrides light mode:

**En `styles.css`**, dentro de `[data-theme="light"]`:
```css
--admin-scrollbar-track: rgba(0, 0, 0, 0.03);
--admin-scrollbar-thumb: linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(96, 165, 250, 0.25));
--admin-scrollbar-thumb-hover: linear-gradient(135deg, rgba(59, 130, 246, 0.45), rgba(96, 165, 250, 0.45));
```

### 12.2 General scrollbars

En `reception.component.css`, el scrollbar thumb usa `rgba(184, 75, 68, 0.3)` hardcodeado. Añadir:

```css
:host-context([data-theme="light"]) ::-webkit-scrollbar-thumb {
  background: rgba(184, 75, 68, 0.2);
}
:host-context([data-theme="light"]) ::-webkit-scrollbar-thumb:hover {
  background: rgba(184, 75, 68, 0.35);
}
```

---

## FASE 13 — Change Password (caso especial)

### Archivo: `src/app/features/general/change-password/change-password.component.css`

Este componente tiene un `:host` que redefine tokens con valores hardcodeados:
```css
--theme-text-primary: #FFFFFF;
--theme-text-secondary: #A1A1A1;
```

Esto sobreescribe los tokens centralizados y rompe el light mode. **Eliminar** estas líneas del `:host` — los tokens heredados de `:root` / `[data-theme="light"]` son suficientes.

También tiene `background-image` con overlay oscuro hardcodeado. Añadir:

```css
:host-context([data-theme="light"]) .change-password-wrapper {
  background-image: linear-gradient(155deg, rgba(255,255,255,0.85) 0%, rgba(184,75,68,0.12) 48%, rgba(255,255,255,0.88) 100%), url('/assets/img/loginBackground.jpg');
}

:host-context([data-theme="light"]) .lock-icon {
  background: rgba(184, 75, 68, 0.08);
}

:host-context([data-theme="light"]) .req-list li.valid {
  color: #059669;
}

:host-context([data-theme="light"]) .req-list li.valid svg {
  color: #059669;
}
```

---

## FASE 14 — `rgba(30, 40, 80, ...)` hardcodeados

Estos valores aparecen en 15 archivos y son colores admin oscuros. Migrar a tokens:

| Valor | Reemplazo |
|---|---|
| `background: rgba(30, 40, 80, 0.55)` | `background: var(--theme-surface-glass)` |
| `background: rgba(30, 40, 80, 0.7)` (hover) | `background: var(--theme-surface-glass-active)` |
| `border: ... rgba(100, 140, 255, 0.15)` | `border: ... var(--theme-border-glass)` |
| `border: ... rgba(100, 140, 255, 0.3)` (hover) | `border: ... var(--theme-border-hover)` |
| `box-shadow: ... rgba(100, 140, 255, 0.3)` | `box-shadow: ... var(--color-accent-admin-bg)` |

**Archivos principales**: `admin-panel.component.css`, `stock-update-modal.component.css`, `orders-management.component.css`, `kitchen-management.component.css`, `allergens-management.component.css`, `batch-expiration-modal.component.css`, `supplier-form-modal.component.css`, y todos los modales de general (product-create, product-edit, product-detail, order-modal, recipe-create, recipe-detail, recipe-edit).

---

## FASE 15 — `rgba(0, 0, 0, 0.2-0.5)` para fondos

Estos valores se usan para table headers, footers, y fondos de secciones. En dark mode se ven bien (oscurecen el fondo), pero en light mode crean manchas oscuras.

### 15.1 Table headers: `background: rgba(0, 0, 0, 0.4)` → `var(--theme-table-header-bg)`

Ya existe el token `--theme-table-header-bg` (dark: `rgba(0,0,0,0.4)`, light: `rgba(0,0,0,0.03)`). Buscar y reemplazar en todos los componentes que tengan `th { background: rgba(0, 0, 0, 0.4) }`:

**Archivos**: `allergens-management`, `batches-management`, `kitchen-management`, `orders-management`, `products-management`, `recipes-management`, `stock-management`, `suppliers-management`, `traceability-management`, `users-management`, `inventory`

### 15.2 Table footers: `background: rgba(0, 0, 0, 0.2-0.3)` → `var(--theme-table-header-bg)`

**Archivos**: `inventory.component.css` (tfoot td), `allergens-management.component.css`

### 15.3 Modal overlays: `background: rgba(0, 0, 0, 0.5-0.7)` → `var(--theme-overlay-bg)`

Ya existe el token. Buscar en todos los modales.

---

## FASE 16 — Validación y QA

### 16.1 Grep de verificación

Ejecutar estos greps y verificar que los resultados restantes son intencionales:

```bash
# Colores semánticos hardcodeados (debería ser 0 o solo en definiciones de tokens)
grep -rn "#ff8a8a\|#f87171\|#34d399\|#a7f3d0\|#9DB5FF\|#fca5a5\|#86efac" src/ --include="*.css" | grep -v "styles.css"

# Fondos oscuros hardcodeados
grep -rn "rgba(30, 40, 80" src/ --include="*.css" | grep -v "styles.css"
grep -rn "#1a1a2e" src/ --include="*.css"

# select option con fondo oscuro
grep -rn "background: #1e1e1e" src/ --include="*.css"

# color-scheme: dark sin override light
grep -rn "color-scheme: dark" src/ --include="*.css"

# text-shadow glow sin override
grep -rn "text-shadow: 0 0 10px" src/ --include="*.css"

# th con background rgba(0,0,0,0.4) sin token
grep -rn "background: rgba(0, 0, 0, 0.4)" src/ --include="*.css" | grep -v "styles.css"
```

### 16.2 Test visual completo

Verificar CADA página en ambos modos:

**Light mode checklist por página:**
- [ ] Login — fondo claro, card legible, inputs visibles
- [ ] Welcome — typewriter legible, fondo adaptado
- [ ] Inventario — tabla legible, headers claros, badges de stock visibles
- [ ] Pedidos — cards de pedido legibles, badges de estado con colores correctos
- [ ] Recepción — formulario legible, estados de pedido visibles
- [ ] Recetas — cards legibles, ingredientes visibles
- [ ] Perfil — card de usuario legible, lista de alumnos visible
- [ ] Barcode Scanner — viewport oscuro (correcto), resultado legible
- [ ] Admin Panel — welcome card elegante, master cards legibles
- [ ] Alérgenos — tabla legible, formulario visible
- [ ] Lotes — tabla legible, fechas de expiración con colores correctos
- [ ] Cocina — cards de recetas legibles
- [ ] Pedidos Admin — tabla legible, estados con colores correctos
- [ ] Productos — tabla legible, auditorías legibles, diff highlights visibles
- [ ] Recetas Admin — tabla legible
- [ ] Stock — alertas legibles, predicciones visibles, gráficos legibles
- [ ] Proveedores — tabla legible
- [ ] Trazabilidad — timeline legible
- [ ] Usuarios — tabla legible, modal de edición legible
- [ ] Change Password — formulario legible sobre fondo claro

**Dark mode checklist:**
- [ ] Verificar que NADA cambió visualmente respecto al estado anterior
- [ ] Stock Update Modal — si se migró a glassmorphism, verificar que se ve bien en dark mode