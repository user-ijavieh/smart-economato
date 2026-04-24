import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { AlertMessage, WebSocketService } from '../../../../core/services/websocket.service';
import { ModalStackService } from '../../../../core/services/modal-stack.service';
import { StorageService } from '../../../../core/services/storage.service';

interface AlertViewModel {
  id: string;
  code: string;
  title: string;
  timestamp: number;
  kind: 'failure' | 'recovered';
  severity: 'critical' | 'partial' | 'recovered';
  services?: string[];
}

const ALERT_TEXT: Record<string, string> = {
  DB_FAILURE: 'ALERTS.DB_FAILURE',
  REDIS_FAILURE: 'ALERTS.REDIS_FAILURE',
  KAFKA_FAILURE: 'ALERTS.KAFKA_FAILURE',
  REPLICA_FAILURE: 'ALERTS.REPLICA_FAILURE',
  DB_RECOVERED: 'ALERTS.DB_RECOVERED',
  REDIS_RECOVERED: 'ALERTS.REDIS_RECOVERED',
  KAFKA_RECOVERED: 'ALERTS.KAFKA_RECOVERED',
  REPLICA_RECOVERED: 'ALERTS.REPLICA_RECOVERED'
};

const SERVICE_NAMES: Record<string, string> = {
  REDIS: 'ALERTS.REDIS',
  KAFKA: 'ALERTS.KAFKA',
  REPLICA: 'ALERTS.REPLICA'
};

@Component({
  selector: 'app-alert-notification',
  standalone: true,
  imports: [DatePipe, TranslateModule],
  templateUrl: './alert-notification.component.html',
  styleUrl: './alert-notification.component.css'
})
export class AlertNotificationComponent {
  private readonly webSocketService = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly modalStack = inject(ModalStackService);
  private readonly translate = inject(TranslateService);
  private readonly storageService = inject(StorageService);

  private readonly activeFailures = signal<Record<string, AlertViewModel>>({});
  private readonly recoveredAlerts = signal<AlertViewModel[]>([]);
  private readonly modalStackCount = toSignal(this.modalStack.stackCount$, {
    initialValue: this.modalStack.hasActiveModals() ? 1 : 0
  });

  readonly failures = this.activeFailures.asReadonly();
  readonly recoveries = this.recoveredAlerts.asReadonly();
  readonly showAlerts = signal<boolean>(this.storageService.get('layout_alerts_visible', 'local') !== 'false');
  readonly zIndex = computed(() => (this.modalStackCount() > 0 ? 80010 : 32000));
  readonly hasAlerts = computed(() => Object.keys(this.activeFailures()).length > 0 || this.recoveredAlerts().length > 0);

  constructor() {
    this.webSocketService.alerts$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(alert => this.handleAlert(alert));
  }

  getFailureList(): AlertViewModel[] {
    const failures = Object.values(this.failures());
    const partialFailures = failures.filter(f => f.severity === 'partial');
    const criticalFailures = failures.filter(f => f.severity === 'critical');

    // If there are multiple partial failures, merge them into one
    if (partialFailures.length > 1) {
      const services = partialFailures.map(f => {
        const serviceKey = f.code.replace('_FAILURE', '');
        const translationKey = SERVICE_NAMES[serviceKey];
        return translationKey ? this.translate.instant(translationKey) : serviceKey;
      });
      const latestTimestamp = Math.max(...partialFailures.map(f => f.timestamp));

      const mergedAlert: AlertViewModel = {
        id: 'merged-partial-failure',
        code: 'MERGED_PARTIAL_FAILURE',
        title: this.translate.instant('ALERTS.SYSTEM_PARTIALLY_DOWN'),
        timestamp: latestTimestamp,
        kind: 'failure',
        severity: 'partial',
        services
      };

      return [...criticalFailures, mergedAlert].sort((a, b) => b.timestamp - a.timestamp);
    }

    return failures.sort((a, b) => b.timestamp - a.timestamp);
  }

  getRecoveryList(): AlertViewModel[] {
    return this.recoveries();
  }

  getCollapsedBadgeCount(): number {
    return this.getFailureList().length + this.getRecoveryList().length;
  }

  toggleAlerts(event: MouseEvent): void {
    event.stopPropagation();
    const newValue = !this.showAlerts();
    this.showAlerts.set(newValue);
    this.storageService.set('layout_alerts_visible', String(newValue), 'local');
  }

  stopPropagation(event: MouseEvent): void {
    event.stopPropagation();
  }

  getFailureClass(alert: AlertViewModel): string {
    return alert.severity === 'critical' ? 'alert-failure-critical' : 'alert-failure-partial';
  }

  private handleAlert(alert: AlertMessage): void {
    const normalizedCode = alert.code?.toUpperCase?.() ?? '';
    const translationKey = ALERT_TEXT[normalizedCode];
    const title = translationKey ? this.translate.instant(translationKey) : this.translate.instant('ALERTS.SERVICE_STATUS_UPDATED');
    const groupCode = normalizedCode.replace(/_(FAILURE|RECOVERED)$/, '');

    if (normalizedCode.endsWith('_FAILURE')) {
      const severity: AlertViewModel['severity'] = normalizedCode === 'DB_FAILURE' ? 'critical' : 'partial';

      this.activeFailures.update(current => ({
        ...current,
        [groupCode]: {
          id: `${groupCode}-failure`,
          code: normalizedCode,
          title,
          timestamp: alert.timestamp,
          kind: 'failure',
          severity
        }
      }));
      return;
    }

    if (normalizedCode.endsWith('_RECOVERED')) {
      this.activeFailures.update(current => {
        const { [groupCode]: _removed, ...rest } = current;
        return rest;
      });

      const recoveryAlert: AlertViewModel = {
        id: `${groupCode}-recovered-${alert.timestamp}`,
        code: normalizedCode,
        title,
        timestamp: alert.timestamp,
        kind: 'recovered',
        severity: 'recovered'
      };

      this.recoveredAlerts.update(current => [recoveryAlert, ...current]);

      setTimeout(() => {
        this.recoveredAlerts.update(current => current.filter(item => item.id !== recoveryAlert.id));
      }, 6000);
    }
  }
}
