# Plan de Migración a Modo Claro Global

Para implementar el Modo Claro a lo largo de *toda* la aplicación (Login, Welcome, Sidebar y páginas de Administración), se requiere un cambio estratégico: pasar de colores *hardcodeados* (escritos directamente en cada archivo) a **Variables Globales de Tema**.

## Fase 1: Variables Globales (Completado)
Ya he introducido en `styles.css` el diccionario base de variables que manejan tanto el Modo Oscuro por defecto como las modificaciones bajo el atributo `[data-theme="light"]`. 

**Nuevas Variables Principales:**
- `--theme-bg-base`: Fondo general de la App.
- `--theme-surface-glass`: Color del "cristal" para tarjetas y modales.
- `--theme-border-glass`: Bordes sutiles diferenciados por tema.
- `--theme-text-primary`: Texto de alto contraste (Blanco en Dark, Slate 900 en Light).
- `--theme-shadow-card`: Sombras intensas en Dark y sombras difuminadas suaves en Light.

## Fase 2: Refactorización Estructural Global (Siguiente Paso)
Para que toda la aplicación reaccione al Modo Claro, **debemos reemplazar** los valores fijos en cada componente por sus equivalentes variables.

### Cambios a realizar por componente:
1. **App y Sidebar (`app.component.html`/`css`, `sidebar.component.css`)**
   - Asegurar que la lógica del toggle de tema modifique el atributo `data-theme` del `body`.
   - Reemplazar colores de fondo estáticos por `var(--theme-bg-base)`.

2. **Login y Welcome (`login.component.css`, `welcome.component.css`)**
   - Las tarjetas translúcidas dejarán de usar `rgba(...)` fijo para usar `var(--theme-surface-glass)`.
   - Cambiar sombras duras a `var(--theme-shadow-card)`.
   - Asegurarse de que cualquier texto blanco fijo pase a `var(--theme-text-primary)`.

3. **Páginas General y Admin (`features/admin/...`)**
   - He utilizado un patrón muy consistente en todas las páginas de Admin (`orders`, `stock`, `traceability`, etc.).
   - Hay que hacer un buscar y reemplazar masivo (o progresivo) en todos los `<page>.component.css`:
     - `var(--color-surface-glass)` -> `var(--theme-surface-glass)`
     - `var(--color-border-glass)` -> `var(--theme-border-glass)`
     - `rgba(0,0,0,0.4)` (fondos de tabla) -> `var(--theme-table-header-bg)`
     - `rgba(255,255,255,0.05)` (hovers) -> `var(--theme-surface-glass-hover)`
     - Color `white` / `#ffffff` puro -> `var(--theme-text-primary)`

## Fase 3: Componente Toggle de Tema
Crear o modificar un componente (como un botón en el Sidebar o Navbar) con la lógica para cambiar el tema:

```javascript
toggleTheme() {
  const body = document.body;
  const currentTheme = body.getAttribute('data-theme');
  if (currentTheme === 'light') {
    body.removeAttribute('data-theme');
    localStorage.setItem('theme', 'dark');
  } else {
    body.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
  }
}
```

## Resumen de Esfuerzo Estratégico
El mayor trabajo radica en la Fase 2 (refactorización de archivos CSS individuales). Una vez hecho esto, cambiar entre un Modo Oscuro Premium y un Modo Claro Elegante será cuestión de un solo clic, permitiéndote iterar sobre colores sin tocar el código fuente de las pantallas.
