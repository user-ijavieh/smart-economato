import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ScrollService {
  private document = inject(DOCUMENT);

  scrollToTop(): void {
    const container = this.document.querySelector<HTMLElement>('.scrollable-content')
      ?? this.document.querySelector<HTMLElement>('.contenedor-principal');

    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    this.document.defaultView?.scrollTo({ top: 0, behavior: 'smooth' });
  }
}