import { trigger, transition, style, query, animateChild, group, animate } from '@angular/animations';

export const slideInAnimation = trigger('routeAnimations', [
  transition(':increment', [
    // La nueva ruta está "debajo" (mayor índice).
    // => La nueva entra desde abajo (top: 100%), la vieja sale hacia arriba (top: -100%).
    style({ position: 'relative' }),
    query(':enter, :leave', [
      style({
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%'
      })
    ], { optional: true }),
    query(':enter', [
      style({ top: '100%', opacity: 0 })
    ], { optional: true }),
    query(':leave', animateChild(), { optional: true }),
    group([
      query(':leave', [
        animate('500ms cubic-bezier(0.25, 0.8, 0.25, 1)', style({ top: '-10% !important', opacity: 0, scale: 0.95 }))
      ], { optional: true }),
      query(':enter', [
        animate('500ms cubic-bezier(0.25, 0.8, 0.25, 1)', style({ top: '0%', opacity: 1, scale: 1 }))
      ], { optional: true })
    ]),
    query(':enter', animateChild(), { optional: true })
  ]),
  transition(':decrement', [
    // La nueva ruta está "arriba" (menor índice).
    // => La nueva entra desde arriba (top: -100%), la vieja sale hacia abajo (top: 100%).
    style({ position: 'relative' }),
    query(':enter, :leave', [
      style({
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%'
      })
    ], { optional: true }),
    query(':enter', [
      style({ top: '-100%', opacity: 0 })
    ], { optional: true }),
    query(':leave', animateChild(), { optional: true }),
    group([
      query(':leave', [
        animate('500ms cubic-bezier(0.25, 0.8, 0.25, 1)', style({ top: '10% !important', opacity: 0, scale: 0.95 }))
      ], { optional: true }),
      query(':enter', [
        animate('500ms cubic-bezier(0.25, 0.8, 0.25, 1)', style({ top: '0%', opacity: 1, scale: 1 }))
      ], { optional: true })
    ]),
    query(':enter', animateChild(), { optional: true })
  ])
]);
