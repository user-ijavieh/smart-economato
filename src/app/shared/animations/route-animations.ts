import { trigger, transition, style, query, animateChild, group, animate } from '@angular/animations';

export const slideInAnimation = trigger('routeAnimations', [
  transition(':increment', [
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
      style({ transform: '{{enterTransform}}', opacity: 0 })
    ], { optional: true }),
    query(':leave', animateChild(), { optional: true }),
    group([
      query(':leave', [
        animate('350ms cubic-bezier(0.25, 0.8, 0.25, 1)', style({ transform: '{{leaveTransform}}', opacity: 0, scale: 0.95 }))
      ], { optional: true }),
      query(':enter', [
        animate('350ms cubic-bezier(0.25, 0.8, 0.25, 1)', style({ transform: 'none', opacity: 1 }))
      ], { optional: true })
    ]),
    query(':enter', animateChild(), { optional: true })
  ], { params: { enterTransform: 'translateY(100%)', leaveTransform: 'translateY(-10%)' } }),

  transition(':decrement', [
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
      style({ transform: '{{enterTransformDec}}', opacity: 0 })
    ], { optional: true }),
    query(':leave', animateChild(), { optional: true }),
    group([
      query(':leave', [
        animate('250ms cubic-bezier(0.25, 0.8, 0.25, 1)', style({ transform: '{{leaveTransformDec}}', opacity: 0, scale: 0.95 }))
      ], { optional: true }),
      query(':enter', [
        animate('250ms cubic-bezier(0.25, 0.8, 0.25, 1)', style({ transform: 'none', opacity: 1 }))
      ], { optional: true })
    ]),
    query(':enter', animateChild(), { optional: true })
  ], { params: { enterTransformDec: 'translateY(-100%)', leaveTransformDec: 'translateY(10%)' } })
]);
