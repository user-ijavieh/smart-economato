**Diagnóstico de consistencia:** Las páginas comparten la paleta terracota (#B84B44), pero divergen en estilos estructurales funcionales (Login usa esquinas excesivamente amplias de 28px y sombras básicas; Welcome emplea glassmorfismo premium oscuro con blur a 24px y radios en 18px). Escalaremos el sistema basándonos en el enfoque *Dark Glassmorphism Premium* del Welcome, al ser de mayor nivel de diseño y escalabilidad.

---

# Smart Economato — Design System (Single Source of Truth)

## 1. Design Tokens

### 1.1 Colors (Brand & Semantic)
| Token Name | Value | Usage |
| :--- | :--- | :--- |
| `color-bg-base` | `rgba(8, 3, 3, 0.72)` | Deep background, overlays and layout bases |
| `color-brand-primary` | `#B84B44` | Accents, primary buttons, borders on focus/hover |
| `color-brand-dark` | `#8C2E28` | Hover states for primary actions, decorative gradients |
| `color-brand-glow` | `rgba(184, 75, 68, 0.35)` | Box-shadows for active/hover states |
| `color-surface-glass` | `rgba(8, 3, 3, 0.58)` | Standard cards, modals, dropdowns |
| `color-border-glass` | `rgba(255, 255, 255, 0.14)`| Default card borders, dividers |
| `color-text-primary` | `#FFFFFF` | Headlines, primary text on glass surfaces |
| `color-text-secondary`| `#A1A1A1` | Labels, placeholders, descriptive text |
| `color-danger-bg` | `rgba(239, 68, 68, 0.08)` | Error banners, destructive buttons |
| `color-danger-border`| `rgba(239, 68, 68, 0.35)` | Error inputs, destructive action borders |

### 1.2 Typography
*Core rule: Interlineados ajustados para UI (1.25) y mayores para lectura (1.5).*
| Token Name | Scope | Properties |
| :--- | :--- | :--- |
| `font-heading-lg` | Page Titles | `size: 2.3rem` / `weight: 600` / `letter-spacing: 5px` / `uppercase` |
| `font-heading-md` | Card/Modal Titles| `size: 1.4rem` / `weight: 600` / `letter-spacing: 0.5px` |
| `font-body-base` | Text & Buttons | `size: 0.98rem` / `weight: 400-600` / `letter-spacing: 0.5px` |
| `font-label-sm` | Inputs & Eyebrows| `size: 0.8rem` / `weight: 300` / `uppercase` / `letter-spacing: 0.06em` |

### 1.3 Spacing & Layout
*Escala de 4px / 8px.*
| Token Name | Value | Usage |
| :--- | :--- | :--- |
| `space-xs` | `6px` | Gap within simple components (icon & text, label & input) |
| `space-sm` | `14px` | Padding within cards, input field height (48px) |
| `space-md` | `24px` | Gaps between grid cards, distinct logical sections |
| `space-lg` | `48px` | Main layout paddings, space between title and content |

### 1.4 Corner Radii & Effects
| Token Name | Value | Usage |
| :--- | :--- | :--- |
| `radius-card` | `18px` | Main cards, modals, floating glass blocks |
| `radius-input`| `14px` | Inputs, dropdown fields, utility buttons |
| `radius-btn` | `12px` | Standard buttons (Confirmers/Cancellers) |
| `effect-glass`| `blur(24px)` | Background blur applied to all `color-surface-glass` |
| `shadow-card` | `0 4px 24px rgba(0,0,0,0.50)`| Resting elevation for all cards |
| `shadow-hover`| `0 22px 55px rgba(0,0,0,0.65)`| Hover elevation (paired with scale `1.03`) |

---

## 2. UI Components

### 2.1 Buttons
- **Primary / Submit:**
  - Background: Gradient `linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-dark))`
  - Border: None
  - State (Hover): `transform: translateY(-2px)` with `box-shadow: 0 8px 28px var(--color-brand-glow)`
  - Radius: `12px` (modals) / `14px` (forms)
- **Secondary / Cancel:**
  - Background: Solid white/light grey (`#f9fafb`) or translucent transparent glass depending on context.
  - Border: `1.5px solid rgba(255,255,255, 0.2)`
  - Text Color: Context dependent (white on glass, dark on solid cards).
  - Hover: Background shift to more opacity (e.g. `rgba(255,255,255,0.1)`)

### 2.2 Inputs & Forms
- **Container:** Gap de `6px` entre `<label>` y `<input>`.
- **Label:** `font-label-sm` (`uppercase`, `300` weight).
- **Field Base:**
  - Height: `48px`.
  - Padding: `0 16px`.
  - Border: `1.5px solid var(--color-border-glass)`.
  - Radius: `14px`.
- **Focus State:** Modificar el borde a `var(--color-brand-primary)` y añadir ring de sombra.
- **Error State:** Borde de `var(--color-danger-border)` con `box-shadow` del ring en rojo. Todo input con error exige texto descriptivo abajo en `0.75rem`.

### 2.3 Cards (Glassmorphism Patter)
Todo contenedor de datos o navegación usa el estándar de cristal.
```css
.card-standard {
  background: var(--color-surface-glass);
  backdrop-filter: var(--effect-glass);
  border: 1px solid var(--color-border-glass);
  border-radius: var(--radius-card); /* 18px */
  box-shadow: var(--shadow-card);
  transition: all 0.36s cubic-bezier(0.4, 0, 0.2, 1);
}
.card-standard:hover {
  transform: translateY(-9px) scale(1.03);
  box-shadow: var(--shadow-hover);
  border-color: var(--color-brand-primary); /* optional for interaction cards */
}
```

---

## 3. Layout Patterns

### 3.1 Main Screens & Overlays
- **Fondos Fotográficos/Dinámicos:** Obligatorio usar un overlay oscuro sobre la imagen para asegurar ratio de contraste del texto (min `WCAG AA 4.5:1` recomendando `linear-gradient(155deg, rgba(10,3,3,0.78) 0%, rgba(184,75,68,0.32) 48%, rgba(10,3,3,0.82) 100%)`).
- **Centrado de Layout:** Elementos principales posicionados con Flex: `align-items: center; justify-content: center` para centrado vertical estricto o un `margin: 0 auto` con `grid` responsivo.

### 3.2 Modals (Centrados)
- Max-width: `400px` o auto adaptativo.
- Padding interno elevado: mínimo `40px 36px 32px` (`space-lg`).
- Elementos alineados al centro del contenedor (título `font-heading-md`, párrafo de `line-height 1.65` abajo, acciones dispuestas en Flex / Grid 1fr).

### 3.3 Grids y Listados de Botones/Cards
- Utilizar CSS Grid dinámico: `grid-template-columns: repeat(auto-fit, minmax(172px, 1fr))`.
- Gap `space-md` (24px).
- Justificado de items al centro para máxima legibilidad.
