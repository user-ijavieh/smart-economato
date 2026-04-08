import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { OfflineSyncService } from '../../../core/services/offline-sync.service';

/**
 * PWA Offline Status Component
 * 
 * Muestra el estado de conectividad y sincronización.
 * Útil para informar al usuario cuando está offline o sincronizando.
 * 
 * Uso en app.component:
 * <app-pwa-offline-status></app-pwa-offline-status>
 */
@Component({
  selector: 'app-pwa-offline-status',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="!isOnline" class="offline-badge">
      <span class="icon">📡</span>
      <span class="text">Modo Offline</span>
      <span *ngIf="queuedCount > 0" class="badge">{{ queuedCount }}</span>
      <button 
        *ngIf="queuedCount > 0 && !isSyncing" 
        class="sync-btn"
        (click)="manualSync()"
        title="Sincronizar ahora">
        ↻
      </button>
      <span *ngIf="isSyncing" class="syncing">Sincronizando...</span>
    </div>
  `,
  styles: [`
    .offline-badge {
      position: fixed;
      top: 1rem;
      right: 1rem;
      background: linear-gradient(135deg, #ff9500 0%, #ff7500 100%);
      color: white;
      padding: 0.75rem 1rem;
      border-radius: 24px;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      box-shadow: 0 4px 12px rgba(255, 149, 0, 0.3);
      font-size: 0.875rem;
      font-weight: 500;
      z-index: 999;
      animation: slideInDown 0.3s ease-out;
    }

    @keyframes slideInDown {
      from {
        transform: translateY(-100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .icon {
      font-size: 1.2rem;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }

    .badge {
      background: #ff4444;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      min-width: 20px;
      text-align: center;
    }

    .sync-btn {
      background: rgba(255, 255, 255, 0.3);
      color: white;
      border: none;
      border-radius: 50%;
      width: 28px;
      height: 28px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      font-size: 1rem;
      padding: 0;
    }

    .sync-btn:hover {
      background: rgba(255, 255, 255, 0.5);
      transform: rotate(180deg);
    }

    .syncing {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
    }

    .syncing::after {
      content: '';
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255, 255, 255, 0.6);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (max-width: 768px) {
      .offline-badge {
        top: auto;
        bottom: 6rem;
        right: 1rem;
        left: auto;
        flex-wrap: wrap;
        max-width: calc(100vw - 2rem);
      }

      .sync-btn {
        width: 24px;
        height: 24px;
        font-size: 0.875rem;
      }
    }
  `]
})
export class PwaOfflineStatusComponent implements OnInit, OnDestroy {
  isOnline = true;
  queuedCount = 0;
  isSyncing = false;

  private destroy$ = new Subject<void>();

  constructor(private offlineSync: OfflineSyncService) {}

  ngOnInit() {
    // Monitor online status
    this.offlineSync
      .isOnline()
      .pipe(takeUntil(this.destroy$))
      .subscribe((online: boolean) => {
        this.isOnline = online;
      });

    // Monitor queued requests
    this.offlineSync
      .getQueuedRequests()
      .pipe(takeUntil(this.destroy$))
      .subscribe((queue: any[]) => {
        this.queuedCount = queue.length;
      });

    // Monitor sync progress
    this.offlineSync
      .isSyncInProgress()
      .pipe(takeUntil(this.destroy$))
      .subscribe((syncing: boolean) => {
        this.isSyncing = syncing;
      });
  }

  async manualSync() {
    await this.offlineSync.syncQueuedRequests();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
