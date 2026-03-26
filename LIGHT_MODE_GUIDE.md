# Guía de Implementación: Modo Claro (Light Mode)
## Smart Economato — Premium Light Glassmorphism

Esta guía detalla cómo transformar el actual sistema de diseño "Dark Glassmorphism" en un "Light Glassmorphism" manteniendo la elegancia, profundidad y consistencia visual.

---

## 1. Estrategia de Implementación

Para una gestión eficiente, utilizaremos **CSS Variables** vinculadas a un atributo en el `<body>` o `<html>`.

### Estructura de Clases
```css
/* Valores por defecto (Modo Oscuro) */
:root {
  --bg-base: #080D1C;
  --surface-glass: rgba(12, 16, 28, 0.65);
  --border-glass: rgba(255, 255, 255, 0.1);
  --text-primary: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.6);
  --shadow-card: 0 8px 32px rgba(0, 0, 0, 0.4);
}

/* Sobrescritura para Modo Claro */
[data-theme='light'] {
  --bg-base: #F8FAFC; /* Slate 50 */
  --surface-glass: rgba(255, 255, 255, 0.7);
  --border-glass: rgba(0, 0, 0, 0.06);
  --text-primary: #0F172A; /* Slate 900 */
  --text-secondary: #64748B; /* Slate 500 */
  --shadow-card: 0 8px 32px rgba(15, 23, 42, 0.08);
}
```

---

## 2. Paleta de Colores (Tokens de Reemplazo)

| Token | Modo Oscuro (Actual) | Modo Claro (Propuesto) | Razón |
| :--- | :--- | :--- | :--- |
| `bg-base` | `#080D1C` | `#F1F5F9` | Fondo suave para evitar fatiga visual. |
| `surface-glass` | `rgba(12, 16, 28, 0.65)` | `rgba(255, 255, 255, 0.7)` | Cristal blanco esmerilado. |
| `text-primary` | `#FFFFFF` | `#1E293B` | Alto contraste sobre fondo claro. |
| `text-secondary`| `rgba(255,255,255,0.6)`| `#64748B` | Color Slate para etiquetas y metadatos. |
| `border-glass` | `rgba(255,255,255,0.1)`| `rgba(0,0,0,0.08)` | Borde oscuro muy sutil para definir formas. |
| `accent-primary` | `rgb(90, 120, 220)` | `rgb(59, 130, 246)` | Azul más saturado para destacar en blanco. |

---

## 3. Ajustes de Glassmorfismo

### Profundidad y Sombras
En modo oscuro, el brillo (glow) define los bordes. En modo claro, la **sombra (shadow)** es la clave:
- **Oscuro**: Sombra negra pesada (`rgba(0,0,0,0.5)`).
- **Claro**: Sombra muy difuminada y azulada (`rgba(15, 23, 42, 0.08)`).

### Blur (Efecto Esmerilado)
Mantenemos el `backdrop-filter: blur(24px)`. En fondos claros, este efecto es más visible y aporta una sensación de "limpieza" y "frescura" al UI.

---

## 4. Ejemplo de Código: Componente Dual

Si usas el sistema de variables correctamente, tus componentes no necesitan cambiar su CSS interno:

```css
.card-premium {
  background: var(--surface-glass);
  backdrop-filter: blur(24px);
  border: 1px solid var(--border-glass);
  border-radius: 20px;
  color: var(--text-primary);
  box-shadow: var(--shadow-card);
}
```

---

## 5. Tips para la Transición
1. **Iconografía**: Asegúrate de que los SVGs usen `currentColor` para que cambien automáticamente de blanco a Slate 900.
2. **Scrollbars**: Cambia los colores del scrollbar a tonos grises sutiles en lugar del azul/rojo intenso para no romper la estética minimalista del modo claro.
3. **Imágenes de fondo**: Si usas imágenes, añade un overlay blanco translúcido (`rgba(248, 250, 252, 0.8)`) en lugar del gradiente oscuro actual.

---
> [!TIP]
> Para el Smart Economato, recomendamos usar un **Modo Claro "Soft"** (basado en Slate/Gray) en lugar de un blanco puro (#FFFFFF) para mantener la sensación "Premium".
