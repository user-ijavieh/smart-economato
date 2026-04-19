import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ModalStackService {
  private stack: string[] = [];
  private readonly baseZIndex = 60000;
  private readonly zIndexStep = 20;

  register(id: string): void {
    if (this.stack.includes(id)) {
      return;
    }

    this.stack.push(id);
  }

  unregister(id: string): void {
    this.stack = this.stack.filter(item => item !== id);
  }

  isTop(id: string): boolean {
    if (this.stack.length === 0) {
      return false;
    }

    return this.stack[this.stack.length - 1] === id;
  }

  getZIndex(id: string): number {
    const index = this.stack.indexOf(id);
    if (index === -1) {
      return this.baseZIndex;
    }

    return this.baseZIndex + index * this.zIndexStep;
  }
}
