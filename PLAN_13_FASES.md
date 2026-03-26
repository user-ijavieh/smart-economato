# Plan de cambios en 13 fases

## Objetivo
Documentar y ejecutar de forma ordenada los cambios de la aplicación en 13 fases.

## Instrucciones generales
- Este documento se irá completando de forma incremental.
- Cada fase debe incluir: objetivo, tareas, archivos afectados, criterios de aceptación y notas.
- El orden de ejecución será secuencial (Fase 1 -> Fase 13), salvo que se indique lo contrario.

---

## Fase 1
### Titulo
Crear tokens adicionales en `styles.css`.

### Archivo
- `src/styles.css`

### Instrucciones
Anadir nuevos tokens en `:root` (dark mode) y en `[data-theme="light"]` para cubrir los patrones hardcodeados mas comunes.

Ubicacion: anadir DESPUES de los tokens existentes (despues de la linea 43, antes de los legacy tokens).

Nuevos tokens dark mode en `:root`:

```css
--theme-input-bg: rgba(255, 255, 255, 0.04);
--theme-border-hover: rgba(255, 255, 255, 0.3);
--theme-border-medium: rgba(255, 255, 255, 0.2);
--theme-border-light: rgba(255, 255, 255, 0.12);
--theme-border-card: rgba(255, 255, 255, 0.14);
--theme-overlay-bg: rgba(0, 0, 0, 0.75);
--theme-overlay-light: rgba(0, 0, 0, 0.15);
--theme-shadow-deep: 0 24px 60px rgba(0, 0, 0, 0.55);
--theme-text-link-inactive: rgba(255, 255, 255, 0.58);
--theme-text-link-hover: rgba(255, 255, 255, 0.90);
--theme-svg-inactive: rgba(255, 255, 255, 0.45);
--theme-svg-hover: rgba(255, 255, 255, 0.75);
--theme-modal-glass: rgba(12, 12, 12, 0.75);
--theme-modal-glass-alt: rgba(8, 3, 3, 0.7);
```

Overrides light mode en `[data-theme="light"]`:

```css
--theme-input-bg: rgba(0, 0, 0, 0.03);
--theme-border-hover: rgba(0, 0, 0, 0.15);
--theme-border-medium: rgba(0, 0, 0, 0.12);
--theme-border-light: rgba(0, 0, 0, 0.06);
--theme-border-card: rgba(0, 0, 0, 0.08);
--theme-overlay-bg: rgba(0, 0, 0, 0.45);
--theme-overlay-light: rgba(0, 0, 0, 0.04);
--theme-shadow-deep: 0 24px 60px rgba(15, 23, 42, 0.12);
--theme-text-link-inactive: #64748B;
--theme-text-link-hover: #1E293B;
--theme-svg-inactive: #94A3B8;
--theme-svg-hover: #475569;
--theme-modal-glass: rgba(255, 255, 255, 0.85);
--theme-modal-glass-alt: rgba(255, 255, 255, 0.80);
```

Tambien anadir overrides para `body.admin-theme` en light mode para los tokens que difieran (ejemplo: `--theme-input-bg` con un tint azul sutil).

## Fase 2
### Titulo
Corregir `var(--color-*)` en `users-management.component.css`.

### Archivo
- `src/app/features/admin/users-management/users-management.component.css`

### Instrucciones
Buscar y reemplazar las 22 ocurrencias de `var(--color-*)` por sus equivalentes `var(--theme-*)`:

- `var(--color-text-secondary)` -> `var(--theme-text-secondary)` (lineas 736, 763 y todas las demas)
- `var(--color-surface-glass)` -> `var(--theme-surface-glass)` (si existe)
- `var(--color-border-glass)` -> `var(--theme-border-glass)` (si existe)

Verificar que no quede ninguna ocurrencia de `var(--color-` en el archivo.

## Fase 3
### Titulo
Corregir `color: white` residuales.

### Archivos
- `src/styles.css`
- `src/app/shared/components/layout/confirm-dialog/confirm-dialog.component.css`

### Instrucciones
1. En `src/styles.css`:
	- Linea 319: `.modal-header-base` -> cambiar `color: white` a `color: var(--theme-text-on-brand)`.
	- Nota: este es texto sobre fondo de marca, siempre blanco, asi que `--theme-text-on-brand: #FFFFFF` es correcto y no necesita cambiar en light mode.

2. En `src/app/shared/components/layout/confirm-dialog/confirm-dialog.component.css`:
	- Linea 96: `.btn-confirm { color: white !important; }` -> cambiar a `color: var(--theme-text-on-brand) !important;`.
	- Nota: tambien es texto sobre fondo de marca.

## Fase 4
### Titulo
Migrar `rgba(255, 255, 255, 0.XX)` semanticos en componentes.

### Descripcion
Esta es la fase mas grande. Reemplazar los valores `rgba(255, 255, 255, ...)` que son semanticos (bordes, fondos de inputs, hovers) por los tokens creados en Fase 1.

No reemplazar los valores decorativos.

### Patrones de reemplazo (aplicar en todos los CSS de componente)

| Patron actual | Token de reemplazo | Contexto |
|---|---|---|
| `rgba(255, 255, 255, 0.04)` en background de inputs | `var(--theme-input-bg)` | Fondos de campos de texto |
| `rgba(255, 255, 255, 0.3)` en border-color hover | `var(--theme-border-hover)` | Bordes en estado hover |
| `rgba(255, 255, 255, 0.2)` en border | `var(--theme-border-medium)` | Bordes medios |
| `rgba(255, 255, 255, 0.12)` en border | `var(--theme-border-light)` | Bordes sutiles |
| `rgba(255, 255, 255, 0.14)` en border de cards | `var(--theme-border-card)` | Bordes de tarjetas/modales |
| `rgba(255, 255, 255, 0.06)` en border | `var(--theme-border-subtle)` | Ya existe este token |
| `rgba(255, 255, 255, 0.05)` en background hover | `var(--theme-surface-glass-hover)` | Ya existe |
| `rgba(255, 255, 255, 0.08)` en background active | `var(--theme-surface-glass-active)` | Ya existe |
| `rgba(255, 255, 255, 0.58)` en color de links | `var(--theme-text-link-inactive)` | Color de links inactivos |
| `rgba(255, 255, 255, 0.90)` en color hover | `var(--theme-text-link-hover)` | Color de links en hover |
| `rgba(255, 255, 255, 0.45)` en fill de SVGs | `var(--theme-svg-inactive)` | Color de iconos inactivos |
| `rgba(255, 255, 255, 0.75)` en fill hover | `var(--theme-svg-hover)` | Color de iconos en hover |
| `rgba(255, 255, 255, 0.6)` en color | `var(--theme-text-secondary)` | Ya existe |
| `rgba(255, 255, 255, 0.28)` en color | `var(--theme-text-muted)` | Ya existe |

### Archivos a procesar (orden de prioridad)

Admin pages (12 archivos):
1. `src/app/features/admin/users-management/users-management.component.css` (52)
2. `src/app/features/admin/orders-management/orders-management.component.css` (28)
3. `src/app/features/admin/kitchen-management/kitchen-management.component.css` (26)
4. `src/app/features/admin/stock-management/stock-management.component.css` (24)
5. `src/app/features/admin/allergens-management/allergens-management.component.css` (22)
6. `src/app/features/admin/batches-management/batches-management.component.css` (22)
7. `src/app/features/admin/products-management/products-management.component.css` (22)
8. `src/app/features/admin/recipes-management/recipes-management.component.css` (22)
9. `src/app/features/admin/traceability-management/traceability-management.component.css` (16)
10. `src/app/features/admin/suppliers-management/suppliers-management.component.css` (8)
11. `src/app/features/admin/admin-panel/admin-panel.component.css` (6)
12. `src/app/features/admin/users-management/user-form-modal/user-form-modal.component.css` (9)

General pages (13 archivos):
13. `src/app/features/general/inventory/inventory.component.css` (21)
14. `src/app/features/general/recipes/recipes.component.css` (21)
15. `src/app/features/general/reception/reception.component.css` (19)
16. `src/app/features/general/welcome/welcome.component.css` (16)
17. `src/app/features/general/profile/profile.component.css` (16)
18. `src/app/features/general/orders/order-details-modal/order-details-modal.component.css` (15)
19. `src/app/features/general/orders/order-modal/order-modal.component.css` (15)
20. `src/app/features/general/orders/orders.component.css` (14)
21. `src/app/features/general/recipes/recipe-create-modal/recipe-create-modal.component.css` (13)
22. `src/app/features/general/recipes/recipe-edit-modal/recipe-edit-modal.component.css` (13)
23. `src/app/features/general/login/login.component.css` (12)
24. `src/app/features/general/inventory/product-create-modal/product-create-modal.component.css` (9)
25. `src/app/features/general/inventory/product-edit-modal/product-edit-modal.component.css` (9)

Modales y shared (8 archivos):
26. `src/app/features/admin/stock-management/batch-expiration-modal/batch-expiration-modal.component.css` (10)
27. `src/app/features/admin/suppliers-management/supplier-form-modal/supplier-form-modal.component.css` (8)
28. `src/app/features/general/reception/order-reception-modal/order-reception-modal.component.css` (7)
29. `src/app/features/general/recipes/recipe-detail-modal/recipe-detail-modal.component.css` (7)
30. `src/app/features/general/inventory/product-detail-modal/product-detail-modal.component.css` (5)
31. `src/app/features/general/inventory/stock-update-modal/stock-update-modal.component.css` (4)
32. `src/app/shared/components/layout/alert-notification/alert-notification.component.css` (4)
33. `src/app/shared/components/layout/toast/toast.component.css` (2)

### Importante (exclusiones)
NO reemplazar `rgba(255, 255, 255, ...)` que aparezcan en:

- `text-shadow` (efecto decorativo)
- `inset box-shadow` para efecto glass
- `linear-gradient` para efecto de brillo/shimmer
- `::after` pseudo-elementos decorativos (como el shimmer del boton submit)

## Fase 5
### Titulo
Migrar `rgba(0, 0, 0, 0.XX)` semanticos.

### Patrones de reemplazo

| Patron actual | Token de reemplazo | Contexto |
|---|---|---|
| `rgba(0, 0, 0, 0.75)` en overlay de modales | `var(--theme-overlay-bg)` | Backdrop de modales |
| `rgba(0, 0, 0, 0.15)` en footer de modales | `var(--theme-overlay-light)` | Fondos sutiles |
| `rgba(0, 0, 0, 0.4)` en box-shadow | `var(--theme-shadow-card)` | Ya existe como token compuesto |
| `rgba(12, 12, 12, 0.75)` en modal glass | `var(--theme-modal-glass)` | Fondo de modales glass |
| `rgba(8, 3, 3, 0.7)` en dialog glass | `var(--theme-modal-glass-alt)` | Fondo de dialogos glass |

### Archivos principales a procesar
- `src/app/shared/components/layout/layout.component.css` - logout modal (lineas 100-112)
- `src/app/shared/components/layout/confirm-dialog/confirm-dialog.component.css` - dialog (lineas 18-67)
- `src/app/features/admin/users-management/users-management.component.css` - assignments actions bar (linea 1160)
- Todos los modales que tengan overlay con `rgba(0, 0, 0, 0.75)` o similar

### Importante (exclusiones)
NO reemplazar `rgba(0, 0, 0, ...)` que aparezcan en:

- `box-shadow` de profundidad (estos son correctos en ambos modos, solo mas sutiles en light)
- `text-shadow` decorativo
- Gradientes de overlay sobre imagenes (como el login background)

## Fase 6
### Titulo
Light mode para componentes shared.

### Archivo
- `src/app/shared/components/layout/layout.component.css`

### Instrucciones
Anadir bloque `:host-context([data-theme="light"])` para el logout modal:

- `.logout-modal`: `background` -> `var(--theme-modal-glass)`, `border` -> `var(--theme-border-card)`, shadow mas suave
- `.logout-modal p`: `color` -> `var(--theme-text-secondary)`
- `.btn-logout-cancel`: `color` -> `var(--theme-text-primary)`, border y background usando tokens
- `.btn-logout-confirm`: mantener colores de peligro (rojo) pero ajustar opacidades para fondo claro

### Archivo
- `src/app/shared/components/layout/confirm-dialog/confirm-dialog.component.css`

### Instrucciones
Anadir bloque `:host-context([data-theme="light"])`:

- `.dialog-content`: `background` -> `var(--theme-modal-glass-alt)`, `border` -> `var(--theme-border-card)`
- `.dialog-body p`: `color` -> `var(--theme-text-secondary)` (actualmente `#E0E0E0` hardcodeado)
- `.dialog-footer`: `background` -> `var(--theme-overlay-light)`
- `.btn-cancel:hover`: `background` -> `var(--theme-surface-glass-active)` en vez de `rgba(255,255,255,0.2)`

### Archivo
- `src/app/shared/components/layout/toast/toast.component.css`

### Instrucciones
Verificar si los toasts necesitan ajustes. El fondo `rgba(15, 15, 15, 0.85)` sera muy oscuro en light mode. Anadir override:

- `.toast`: `background` -> `rgba(255, 255, 255, 0.92)` en light mode, `border` -> `rgba(0, 0, 0, 0.08)`, shadow mas suave

### Archivo
- `src/app/shared/components/layout/alert-notification/alert-notification.component.css`

### Instrucciones
Verificar y anadir overrides si tiene fondos oscuros hardcodeados.

## Fase 7
### Titulo
Light mode para login.

### Archivo
- `src/app/features/general/login/login.component.css`

### Instrucciones
Anadir bloque `:host-context([data-theme="light"])`:

- `.login-wrapper::before` (overlay): cambiar gradiente oscuro a uno mas claro/translucido para que la imagen de fondo se vea mas clara.
	Ejemplo:

```css
background: linear-gradient(
	155deg,
	rgba(255,255,255,0.65) 0%,
	rgba(184,75,68,0.15) 48%,
	rgba(255,255,255,0.70) 100%
);
```

- `.card`: ya usa `var(--theme-surface-glass)` asi que cambiara automaticamente. Verificar que el contraste del texto sea suficiente.
- `.form-input`: `background rgba(255, 255, 255, 0.04)` -> `var(--theme-input-bg)` (ya migrado en Fase 4)
- `.form-input:-webkit-autofill`: cambiar `rgba(8, 3, 3, 0.95)` a un color claro para que el autofill no sea un parche oscuro
- `.form-input:focus`: verificar que el glow de `--brand-glow` sea visible en fondo claro

## Fase 8
### Titulo
Light mode para sidebar dark mode residual.

### Archivo
- `src/app/shared/components/layout/sidebar/sidebar.component.css`

### Instrucciones
El sidebar dark mode (lineas 3-22) aun usa colores hardcodeados. Migrar a tokens:

- Linea 10: `rgba(184, 75, 68, 0.07)` -> `var(--theme-sidebar-tint)`
- Linea 11: `#160C0B` y `#1E100E` -> `var(--theme-sidebar-bg)` (necesitara un gradiente con variante, o simplificar a un solo color con tint)
- Linea 12: `rgba(184, 75, 68, 0.18)` -> `var(--theme-sidebar-border)`
- Lineas 39-44 (admin mode): `rgba(90, 120, 220, 0.07)`, `#080D1C`, `#0D1228` -> usar tokens admin equivalentes

Tambien migrar los valores hardcodeados restantes en el sidebar:

- Linea 174: `.nav-section-label span { color: rgba(255, 255, 255, 0.28); }` -> `var(--theme-text-muted)`
- Linea 212: `#sidebar a { color: rgba(255, 255, 255, 0.58); }` -> `var(--theme-text-link-inactive)`
- Linea 223: `#sidebar svg { fill: rgba(255, 255, 255, 0.45); }` -> `var(--theme-svg-inactive)`
- Linea 236: hover color `rgba(255, 255, 255, 0.90)` -> `var(--theme-text-link-hover)`
- Linea 241: hover fill `rgba(255, 255, 255, 0.75)` -> `var(--theme-svg-hover)`
- Linea 257: `.theme-toggle-item { border-top: 1px solid rgba(255, 255, 255, 0.06); }` -> `var(--theme-border-subtle)`
- Linea 267: `.logout-item a { color: rgba(255, 255, 255, 0.35) !important; }` -> necesita token o override
- Linea 297: `#toggle-btn svg { fill: rgba(255, 255, 255, 0.40); }` -> `var(--theme-svg-inactive)`
- Linea 340: mobile `border-top: 1px solid rgba(255, 255, 255, 0.12)` -> `var(--theme-border-light)`

## Fase 9
### Titulo
Validacion visual completa (continuacion).

### Proceso de verificacion
1. Abrir la app en dark mode y verificar que nada cambio visualmente respecto al estado anterior.
2. Cambiar a light mode y verificar cada pagina una por una:
	- Login
	- Welcome
	- Inventario, Pedidos, Recepcion, Recetas, Perfil, Barcode Scanner (general)
	- Admin Panel, Alergenos, Lotes, Cocina, Pedidos, Productos, Recetas, Stock, Proveedores, Trazabilidad, Usuarios (admin)
	- Modales: crear/editar/detalle de producto, receta, pedido, stock, lote, proveedor, usuario, alergeno
	- Confirm dialog, toast notifications, alert notifications

3. En cada pagina, verificar:
	- Texto legible: ningun texto blanco sobre fondo claro ni texto oscuro sobre fondo oscuro
	- Bordes visibles: los bordes `rgba(255,255,255,...)` deben haberse convertido a bordes oscuros sutiles
	- Hovers funcionales: pasar el raton por botones, filas de tabla, links; deben tener feedback visual
	- Inputs visibles: campos de formulario con fondo, borde y placeholder distinguibles
	- SVGs visibles: todos los iconos deben ser visibles en ambos modos
	- Scrollbars: deben adaptarse al tema (no scrollbar blanco sobre fondo blanco)
	- Sombras: en dark mode sombras pesadas, en light mode sombras difuminadas suaves
	- Glassmorphism: el efecto blur debe verse elegante en ambos modos

### Checklist de elementos criticos por pagina
Login:
- Overlay sobre imagen de fondo: oscuro en dark, claro/translucido en light
- Card glass: contraste suficiente en ambos modos
- Inputs: fondo, borde, placeholder, texto, autofill
- Boton submit: visible y con contraste
- Logos institucionales: visibles en ambos fondos
- Toggle de tema: icono correcto (sol/luna), posicion correcta

Welcome:
- Fondo animado: gradientes adaptados
- Cards de navegacion: glass effect visible, texto legible
- Titulo con efecto typewriter: color adaptado
- Hover en cards: efecto visible

Sidebar (desktop):
- Fondo cambia de oscuro a claro
- Iconos SVG visibles en ambos modos
- Item activo: indicador visible
- Hover: feedback visual
- Toggle de tema: icono correcto, tooltip
- Logout: texto y icono visibles
- Avatar: contraste del texto de iniciales
- Modo colapsado: todo sigue funcionando
- Admin mode: colores azules adaptados

Sidebar (mobile):
- Bottom bar: fondo adaptado
- Iconos visibles
- Item activo: borde inferior visible
- Toggle mobile (top-right): visible y funcional

Tablas (inventario, pedidos, productos, etc.):
- Header de tabla: fondo distinguible
- Filas alternas: diferencia sutil visible
- Hover en filas: feedback visual
- Texto en celdas: legible
- Badges de estado: colores correctos
- Paginacion: botones visibles

Modales:
- Overlay: oscurece/aclara el fondo
- Card del modal: glass effect, bordes, sombra
- Inputs dentro del modal: visibles y funcionales
- Botones: confirm (azul/brand), cancel (neutro), danger (rojo)

Toasts:
- Fondo glass adaptado
- Barra lateral de color por tipo (success, error, warning, info)
- Texto legible
- Barra de progreso visible

### Herramientas de verificacion
- Usar DevTools -> Elements -> buscar `data-theme` en `<html>` para confirmar que el toggle funciona
- Usar DevTools -> Computed Styles para verificar que las variables se resuelven correctamente
- Usar Lighthouse para verificar contraste WCAG AA en ambos modos

## Fase 10
### Titulo
Welcome page light mode.

### Archivo
- `src/app/features/general/welcome/welcome.component.css`

### Descripcion
El welcome es el componente mas especial. Tiene su propia paleta de tokens internos (`--accent`, `--white-08`, etc.) y animaciones complejas, por lo que necesita tratamiento individual.

### Instrucciones
Anadir bloque `:host-context([data-theme="light"])` al final del archivo.

Fondo de pagina:
- `.welcome-container`: el fondo actual usa gradientes oscuros (`radial-gradient(... rgba(184, 75, 68, 0.08) ...)` sobre `var(--theme-bg-page)`).
- En light mode, cambiar los gradientes decorativos a versiones mas sutiles con opacidades menores, o reemplazar por un gradiente claro suave.
- Ejemplo: `radial-gradient(ellipse at 20% 50%, rgba(184, 75, 68, 0.06), transparent 60%)`

Cards de navegacion:
- `.card-glass`: actualmente usa `var(--theme-surface-glass)` (ya migrado), pero verificar que el hover (`translateY(-9px) scale(1.03)`) siga viendose bien con sombras claras
- `.card-glass::before` (shimmer/glow effect): en dark mode es un brillo blanco sutil; en light mode deberia ser un brillo mas tenue o desactivarse
- `.card-icon`: si usa `color: white` o similar, migrar a `var(--theme-text-primary)`

Titulo con typewriter:
- `.typing-title`: verificar que color use `var(--theme-text-primary)` y que el `text-shadow` con `var(--brand-glow)` sea visible pero no excesivo en fondo claro
- `.typing-title .caret`: el borde del cursor debe ser visible en ambos modos

Header:
- `.welcome-header`: verificar gradientes y shimmer animation (`shimmerRed`). En light mode el shimmer puede ser demasiado sutil o invisible; ajustar opacidad

Subtitulo y textos:
- Verificar que todos los textos secundarios usen `var(--theme-text-secondary)` y no `rgba(255,255,255,...)`

Logo:
- `.logo-container img`: verificar que el logo sea visible en fondo claro (si es un logo blanco, necesitara un `filter: invert()` o una version alternativa)

## Fase 11
### Titulo
Modales de features (light mode overrides).

### Descripcion
Los modales de features (`product-create`, `product-edit`, `product-detail`, `recipe-create`, `recipe-edit`, `recipe-detail`, `order-detail`, `order-modal`, `stock-update`, `batch-expiration`, `supplier-form`, `user-form`) comparten un patron similar.

Objetivo: verificar que todos usen tokens centralizados y anadir overrides donde sea necesario.

### Archivos a verificar (todos en `src/app/features/`)
General:
- `general/inventory/product-create-modal/product-create-modal.component.css`
- `general/inventory/product-detail-modal/product-detail-modal.component.css`
- `general/inventory/product-edit-modal/product-edit-modal.component.css`
- `general/inventory/stock-update-modal/stock-update-modal.component.css`
- `general/orders/order-detail-modal/order-detail-modal.component.css`
- `general/orders/order-modal/order-modal.component.css`
- `general/reception/order-reception-modal/order-reception-modal.component.css`
- `general/recipes/recipe-create-modal/recipe-create-modal.component.css`
- `general/recipes/recipe-detail-modal/recipe-detail-modal.component.css`
- `general/recipes/recipe-edit-modal/recipe-edit-modal.component.css`

Admin:
- `admin/batches-management/batch-expiration-modal/batch-expiration-modal.component.css`
- `admin/suppliers-management/supplier-form-modal/supplier-form-modal.component.css`
- `admin/users-management/user-form-modal/user-form-modal.component.css`

### Patron de verificacion para cada modal
- Overlay (`.modal-overlay` o similar): debe usar `var(--theme-surface-glass)` o un overlay adaptativo.
- Overlay esperado: en dark mode `rgba(0,0,0,0.5)`; en light mode `rgba(0,0,0,0.3)` o similar.
- Card del modal: `background` debe usar `var(--theme-surface-glass)` con `backdrop-filter: var(--theme-effect-glass)`.
- Verificar que no haya `rgba(8, 3, 3, ...)` o `rgba(12, 12, 12, ...)` hardcodeado.
- Bordes: deben usar `var(--theme-border-glass)`.
- Inputs: `background` -> `var(--theme-input-bg)` (token nuevo de Fase 1), `border` -> `var(--theme-input-border)`, `color` -> `var(--theme-text-primary)`.
- Botones: verificar que las acciones (`guardar`, `cancelar`, `eliminar`) tengan contraste suficiente en ambos modos.
- Textos: todo `color: white` y `color: rgba(255,255,255,...)` debe migrarse a `var(--theme-text-primary)` o `var(--theme-text-secondary)`.
- Scrollbar dentro del modal: si hay scroll interno, verificar adaptacion por tema.

### Si hay hardcodeados residuales
- Reemplazar siguiendo la tabla de mapeo de Fases 2-4.
- NO anadir `:host-context([data-theme="light"])` a cada modal.
- Los tokens centralizados deben ser suficientes si todos los valores estan migrados.

## Fase 12
### Titulo
Toast y Alert Notification light mode.

### Archivo
- `src/app/shared/components/layout/toast/toast.component.css`

### Contexto
El toast usa `background: rgba(15, 15, 15, 0.85)` con blur. En light mode seguira siendo oscuro, lo cual puede ser intencional.

### Decision de diseno
Opcion A (recomendada): mantener toasts oscuros en ambos modos.
- Es un patron comun (Vercel, Linear, GitHub).
- No requiere cambios estructurales.

Opcion B: adaptar toasts a light mode.
- Requiere anadir:

```css
:host-context([data-theme="light"]) .toast {
	background: rgba(255, 255, 255, 0.92);
	color: #1E293B;
	border-color: rgba(0, 0, 0, 0.08);
}
```

- Cambiar colores de la barra lateral por tipo a versiones mas saturadas para contraste sobre blanco.
- Cambiar `fill` de iconos SVG a colores mas oscuros.

### Nota critica si se elige Opcion A
Verificar que el toast no use textos internos ligados a tokens que cambian en light mode y que podrian quedar oscuros sobre fondo oscuro.

Solucion recomendada:
- Dentro del toast, usar `color: #ffffff` hardcodeado; o
- Crear token especifico `--toast-text: #ffffff` que NO cambie con el tema.

### Archivo
- `src/app/shared/components/layout/alert-notification/alert-notification.component.css`

### Instrucciones
Aplicar el mismo analisis que en toast.
- Verificar si el alert usa tokens de tema que cambian en light mode y causan problemas de contraste.

## Fase 13
### Titulo
Grep final y limpieza.

### Verificaciones con grep (ejecutar en raiz del proyecto)

```bash
# 1. Buscar rgba(255, 255, 255) residuales (excluyendo comentarios y text-shadow decorativos)
grep -rn "rgba(255" src/ --include="*.css" | grep -v "text-shadow" | grep -v "/\*"

# 2. Buscar color: white residuales
grep -rn "color: white" src/ --include="*.css"
grep -rn "color: #fff" src/ --include="*.css"

# 3. Buscar fondos oscuros hardcodeados
grep -rn "rgba(8, 3, 3" src/ --include="*.css"
grep -rn "rgba(12, 12, 12" src/ --include="*.css"
grep -rn "rgba(12, 16, 28" src/ --include="*.css"
grep -rn "#0c0808" src/ --include="*.css"
grep -rn "#160C0B" src/ --include="*.css"

# 4. Buscar var(--color-*) antiguas (regresiones)
grep -rn "var(--color-" src/ --include="*.css"

# 5. Buscar fill="#e3e3e3" en HTMLs (SVGs no migrados)
grep -rn 'fill="#e3e3e3"' src/ --include="*.html"
grep -rn 'fill="#fff"' src/ --include="*.html"
grep -rn 'fill="white"' src/ --include="*.html"

# 6. Buscar residuos fff del find-and-replace anterior
grep -rn "theme-text-primary)f" src/ --include="*.css"
```

### Accion para cada resultado de grep
- Si es valor semantico (fondo, borde, color de texto, hover): reemplazar por el token `var(--theme-*)` correspondiente.
- Si es valor decorativo (`text-shadow` glow, `inset box-shadow` para glass, gradiente de brillo): dejar como esta o crear token especifico si se repite mucho.
- Si esta dentro de toast/alert y se decidio mantener oscuro: dejar como esta y documentar la decision.

### Limpieza final
- Eliminar variables antiguas de `styles.css` que ya no se usen.
	Ejemplos: `--primary-color`, `--secondary-color`, `--login-background-color`, `--base-clr`, `--line-clr`, `--hover-clr`, `--text-clr`, `--accent-clr`, `--secondary-text-clr`, `--content-bg`.
- Verificar primero que ningun archivo las referencie.
- Verificar que `body.admin-theme` en `styles.css` no tenga tokens que ya no existan.
- Verificar que `[data-theme="light"]` y `[data-theme="light"] body.admin-theme` cubran TODOS los tokens definidos en `:root`.

### Commit final
- `fix(styles): complete CSS token migration and light mode compatibility`
