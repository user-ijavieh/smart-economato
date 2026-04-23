import { Injectable } from '@angular/core';

export type StorageBackend = 'session' | 'local';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private get sessionBackend(): Storage {
    return sessionStorage;
  }

  private get localBackend(): Storage {
    return localStorage;
  }

  private resolveBackend(backend: StorageBackend): Storage {
    return backend === 'session' ? this.sessionBackend : this.localBackend;
  }

  get(key: string, backend: StorageBackend = 'session'): string | null {
    return this.resolveBackend(backend).getItem(key);
  }

  set(key: string, value: string, backend: StorageBackend = 'session'): void {
    this.resolveBackend(backend).setItem(key, value);
  }

  remove(key: string, backend: StorageBackend = 'session'): void {
    this.resolveBackend(backend).removeItem(key);
  }
}
