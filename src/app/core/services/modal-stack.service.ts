import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ModalStackService {
  private stack: string[] = [];
  private readonly baseZIndex = 60000;
  private readonly zIndexStep = 20;
  private readonly stackCountSubject = new BehaviorSubject(0);

  readonly stackCount$ = this.stackCountSubject.asObservable();

  register(id: string): void {
    if (this.stack.includes(id)) {
      return;
    }

    this.stack.push(id);
    this.stackCountSubject.next(this.stack.length);
  }

  unregister(id: string): void {
    this.stack = this.stack.filter(item => item !== id);
    this.stackCountSubject.next(this.stack.length);
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

  hasActiveModals(): boolean {
    return this.stack.length > 0;
  }
}
