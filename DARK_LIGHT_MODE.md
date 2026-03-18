# Smart Economato — Guía de Modo Oscuro & Propuesta Modo Claro

> Complemento al `STYLE_GUIDE.md`. Esta guía documenta el sistema de color oscuro implementado (basado en el sidebar refactorizado) y propone la paleta equivalente para modo claro. Ambos modos comparten la misma marca terracota `#B84B44` y mismos tokens estructurales; solo cambia la capa de superficie.

---

## 1. Principio de Diseño

### La regla de oro del color premium
El error más común en interfaces de marca es **saturar el fondo con el color de marca**. El resultado parece una plantilla genérica. La aproximación premium es la opuesta:

> **Fondo oscuro/neutro profundo → color de marca aplicado quirúrgicamente en accentos.**

Esto crea jerarquía visual: el ojo va directamente al color de marca porque aparece con escasez y precisión, no como ruido de fondo.

```
❌  Sidebar rojo saturado → todo compite → nada destaca
✓   Sidebar casi negro + borde brand 18% opacidad + active state brand → marca con autoridad
```

---

## 2. Modo Oscuro (Implementado)

### 2.1 Tokens de Color — Dark Mode

| Token | Valor | Uso |
| :--- | :--- | :--- |
| `--dm-bg-deep` | `#160C0B` | Base del sidebar (user), fondo de página en dark |
| `--dm-bg-admin` | `#080D1C` | Base del sidebar (admin) |
| `--dm-surface-1` | `rgba(255,255,255,0.03)` | Superficie de hover sobre fondo profundo |
| `--dm-surface-2` | `rgba(255,255,255,0.06)` | Superficie de cards secundarias |
| `--dm-surface-brand` | `rgba(184,75,68,0.16)` | Superficie de item activo (user) |
| `--dm-surface-admin` | `rgba(90,120,220,0.16)` | Superficie de item activo (admin) |
| `--dm-border-subtle` | `rgba(255,255,255,0.06)` | Divisores, bordes de sección |
| `--dm-border-brand` | `rgba(184,75,68,0.18)` | Bordes con tint de marca |
| `--dm-text-primary` | `#FFFFFF` | Texto principal, headings |
| `--dm-text-secondary` | `rgba(255,255,255,0.58)` | Texto de nav items en reposo |
| `--dm-text-muted` | `rgba(255,255,255,0.28)` | Labels de sección, texto auxiliar |
| `--dm-text-brand` | `#B84B44` | Role label, microacentos de marca |
| `--dm-accent-user` | `#E8756D` | Ícono activo (user mode) |
| `--dm-accent-admin` | `#9DB5FF` | Ícono activo (admin mode) |

### 2.2 Paleta Brand Invariante (misma en ambos modos)

| Token | Valor | Descripción |
| :--- | :--- | :--- |
| `--brand-primary` | `#B84B44` | Terracota principal |
| `--brand-dark` | `#8C2E28` | Variante oscura (hover, gradientes) |
| `--brand-light` | `#D4625A` | Variante clara (highlights, top accent) |
| `--brand-glow` | `rgba(184,75,68,0.35)` | Box-shadow / glow brand |
| `--admin-primary` | `#5A78DC` | Azul admin principal |
| `--admin-light` | `#7A96F0` | Azul admin claro (active border) |
| `--admin-bright` | `#9DB5FF` | Azul admin bright (active icon) |

### 2.3 Anatomía del Sidebar Oscuro

```
┌─────────────────────────────────────────┐
│ ← Línea accent top: gradient brand 2px  │  #160C0B (base)
│                                         │
│  [AV]  Nombre Usuario                   │  Avatar: brand ring + glow
│        Administrador                    │  Role: #B84B44 exacto
│  ─────────────────────────────────────  │  Divider: rgba(fff, 6%)
│                                         │
│  GESTIÓN                                │  Section: rgba(fff, 28%)
│  ▌ Vista General      [icon]            │  Active: brand bg 16% + border 2px
│    Usuarios           [icon]            │  Inactive: rgba(fff, 58%)
│    Recetas            [icon]            │  Hover: rgba(fff, 5%) + border ghost
│                                         │
│  ─────────────────────────────────────  │
│    Cerrar sesión      [icon]            │  Logout: rgba(fff, 35%) → rojo on hover
└─────────────────────────────────────────┘
```

### 2.4 Reglas de aplicación — Dark Mode

1. **Ningún fondo de componente supera `rgba(255,255,255,0.08)`** en opacidad base. El color de marca solo aparece en active states.
2. **Dos niveles de profundidad** de fondo: `deep` para layout shell, `surface` para cards/modales flotantes encima.
3. **Gradiente de tinta brand** en esquina superior del sidebar: `linear-gradient(135deg, rgba(184,75,68,0.07) 0%, transparent 55%)` — perceptible al segundo vistazo, no al primero.
4. **Línea accent de 2px** en el borde superior (`::before` pseudo-element): gradiente horizontal que aparece/desaparece, da sensación de presencia sin agresividad.
5. **Transiciones: `cubic-bezier(0.4, 0, 0.2, 1)`** con `220–300ms`. Nunca `ease` o `linear` en UI premium.
6. **Íconos en reposo: 45% opacidad** → en hover: 75% → en active: color accent explícito. Tres estados, nunca dos.

---

## 3. Modo Claro — Propuesta

### Filosofía del modo claro
El light mode de una app premium **no es blanco puro**. Es un conjunto de blancos cálidos y grises levemente teñidos que crean profundidad sin sombras pesadas. El color de marca aparece con la misma escasez que en dark.

> Referencia visual: apps como Linear (light), Craft, o el sistema de diseño de Stripe en claro.

### 3.1 Tokens de Color — Light Mode

| Token | Valor | Uso |
| :--- | :--- | :--- |
| `--lm-bg-page` | `#F5F0EF` | Fondo de página: blanco cálido teñido |
| `--lm-bg-sidebar` | `#FDFBFA` | Base del sidebar (user): casi blanco, warm |
| `--lm-bg-sidebar-admin` | `#F7F8FD` | Base del sidebar (admin): blanco con tint frío |
| `--lm-surface-1` | `#FFFFFF` | Cards y modales flotantes |
| `--lm-surface-2` | `#F0EBEA` | Fondos secundarios, inputs |
| `--lm-surface-brand` | `rgba(184,75,68,0.08)` | Item activo (user) |
| `--lm-surface-admin` | `rgba(90,120,220,0.08)` | Item activo (admin) |
| `--lm-border-subtle` | `rgba(0,0,0,0.06)` | Divisores, bordes de sección |
| `--lm-border-brand` | `rgba(184,75,68,0.20)` | Bordes con tint de marca |
| `--lm-border-card` | `rgba(0,0,0,0.08)` | Bordes de cards, inputs |
| `--lm-text-primary` | `#1A0E0D` | Texto principal (warm black) |
| `--lm-text-secondary` | `rgba(26,14,13,0.55)` | Texto de nav items en reposo |
| `--lm-text-muted` | `rgba(26,14,13,0.35)` | Labels de sección, auxiliar |
| `--lm-text-brand` | `#B84B44` | Role label, microacentos — igual que dark |
| `--lm-shadow-card` | `0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.05)` | Elevación suave |
| `--lm-shadow-sidebar` | `1px 0 0 rgba(0,0,0,0.06), 4px 0 24px rgba(0,0,0,0.08)` | Sombra lateral sidebar |

### 3.2 Sidebar — Light Mode

El sidebar claro usa la **misma estructura** pero invierte la relación fondo/texto:

```css
/* Sidebar User — Light */
#sidebar {
  background:
    linear-gradient(135deg, rgba(184, 75, 68, 0.04) 0%, transparent 55%),
    #FDFBFA;
  border-right: 1px solid rgba(184, 75, 68, 0.14);
  box-shadow: 1px 0 0 rgba(0,0,0,0.05), 4px 0 24px rgba(0,0,0,0.08);
}

/* Sidebar Admin — Light */
#sidebar.admin-mode {
  background:
    linear-gradient(135deg, rgba(90, 120, 220, 0.04) 0%, transparent 55%),
    #F7F8FD;
  border-right-color: rgba(90, 120, 220, 0.14);
}

/* Nav links en reposo */
#sidebar a {
  color: rgba(26, 14, 13, 0.55);
}

/* Active state */
#sidebar ul li a.active {
  background: rgba(184, 75, 68, 0.08);
  border-left: 2px solid #B84B44;
  color: #B84B44;
}

/* Hover */
#sidebar a:hover {
  background: rgba(0, 0, 0, 0.03);
  color: rgba(26, 14, 13, 0.90);
  border-left-color: rgba(184, 75, 68, 0.30);
}
```

### 3.3 Cards — Light Mode

```css
.card-light {
  background: #FFFFFF;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 18px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.05);
  transition: all 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-light:hover {
  border-color: rgba(184, 75, 68, 0.25);
  box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(184,75,68,0.12);
  transform: translateY(-2px);
}
```

**Diferencia clave con dark**: En dark las cards usan `backdrop-filter: blur()`. En light, la profundidad viene de **sombras sutiles multi-capa**, no del blur.

### 3.4 Inputs — Light Mode

```css
input, select, textarea {
  background: #FFFFFF;
  border: 1.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 14px;
  color: #1A0E0D;
  height: 48px;
  padding: 0 16px;
}

input:focus {
  border-color: #B84B44;
  box-shadow: 0 0 0 3px rgba(184, 75, 68, 0.12);
  outline: none;
}

label {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: rgba(26, 14, 13, 0.50);
}
```

### 3.5 Botones — Light Mode

```css
/* Primary */
.btn-primary {
  background: linear-gradient(135deg, #B84B44, #8C2E28);
  color: #FFFFFF;
  border: none;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(184, 75, 68, 0.30);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(184, 75, 68, 0.40);
}

/* Secondary */
.btn-secondary {
  background: #FFFFFF;
  color: rgba(26, 14, 13, 0.75);
  border: 1.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
}

.btn-secondary:hover {
  background: #F5F0EF;
  border-color: rgba(0, 0, 0, 0.18);
}
```

---

## 4. Tabla Comparativa Dark vs Light

| Elemento | Dark Mode | Light Mode |
| :--- | :--- | :--- |
| Fondo sidebar (user) | `#160C0B` | `#FDFBFA` |
| Fondo sidebar (admin) | `#080D1C` | `#F7F8FD` |
| Tint brand en fondo | `rgba(184,75,68,0.07)` | `rgba(184,75,68,0.04)` |
| Active state bg | `rgba(184,75,68,0.16)` | `rgba(184,75,68,0.08)` |
| Active border | `#B84B44` (2px) | `#B84B44` (2px) — igual |
| Texto nav reposo | `rgba(fff,0.58)` | `rgba(26,14,13,0.55)` |
| Texto nav active | `#FFFFFF` | `#B84B44` |
| Divisores | `rgba(fff,0.06)` | `rgba(0,0,0,0.06)` |
| Card bg | `rgba(8,3,3,0.58) + blur` | `#FFFFFF + sombras` |
| Card border | `rgba(fff,0.14)` | `rgba(0,0,0,0.08)` |
| Input bg | `rgba(fff,0.04)` | `#FFFFFF` |
| Input border | `rgba(fff,0.14)` | `rgba(0,0,0,0.12)` |
| Fondo de página | `#0A0505` o foto dark | `#F5F0EF` |

---

## 5. Implementación con CSS Custom Properties

Para implementar el toggle de modo, la estructura recomendada es:

```css
/* styles.css */

:root {
  /* Brand (invariante) */
  --brand-primary:  #B84B44;
  --brand-dark:     #8C2E28;
  --brand-light:    #D4625A;
  --brand-glow:     rgba(184, 75, 68, 0.35);

  /* Dark mode — valores por defecto */
  --bg-page:        #0A0505;
  --bg-sidebar:     #160C0B;
  --surface-1:      rgba(255,255,255,0.04);
  --surface-brand:  rgba(184,75,68,0.16);
  --border-subtle:  rgba(255,255,255,0.06);
  --border-brand:   rgba(184,75,68,0.18);
  --text-primary:   #FFFFFF;
  --text-secondary: rgba(255,255,255,0.58);
  --text-muted:     rgba(255,255,255,0.28);
  --text-brand:     #B84B44;
}

/* Light mode override */
[data-theme="light"] {
  --bg-page:        #F5F0EF;
  --bg-sidebar:     #FDFBFA;
  --surface-1:      #FFFFFF;
  --surface-brand:  rgba(184,75,68,0.08);
  --border-subtle:  rgba(0,0,0,0.06);
  --border-brand:   rgba(184,75,68,0.14);
  --text-primary:   #1A0E0D;
  --text-secondary: rgba(26,14,13,0.55);
  --text-muted:     rgba(26,14,13,0.35);
  --text-brand:     #B84B44;          /* igual — marca no cambia */
}
```

En Angular, el toggle se aplica al `<html>` o `<body>`:

```typescript
// theme.service.ts
toggleTheme() {
  const isDark = document.documentElement.dataset['theme'] !== 'light';
  document.documentElement.dataset['theme'] = isDark ? 'light' : 'dark';
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
}
```

---

## 6. Checklist de Consistencia

Al implementar cualquier componente nuevo, verificar:

- [ ] ¿El fondo usa tokens (`--bg-*`, `--surface-*`) y no valores hardcodeados?
- [ ] ¿El color de marca aparece solo en: bordes activos, íconos activos, labels de rol, accent lines?
- [ ] ¿El texto respeta la jerarquía: `primary → secondary (55–60%) → muted (28–35%)`?
- [ ] ¿Los bordes usan `rgba` con opacidad baja, no colores sólidos?
- [ ] ¿Las sombras en dark son `rgba(0,0,0,X)` con X alto (0.4–0.65) y en light con X bajo (0.05–0.12)?
- [ ] ¿Las transiciones usan `cubic-bezier(0.4, 0, 0.2, 1)` con 200–300ms?
- [ ] ¿El componente mantiene contraste WCAG AA mínimo (4.5:1) en ambos modos?
