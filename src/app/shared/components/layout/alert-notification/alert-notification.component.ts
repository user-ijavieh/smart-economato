import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlertMessage, WebSocketService } from '../../../../core/services/websocket.service';

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
  DB_FAILURE: 'Sistema caído: la base de datos principal no está disponible.',
  REDIS_FAILURE: 'Sistema parcialmente caído: el servicio de caché no está disponible.',
  KAFKA_FAILURE: 'Sistema parcialmente caído: el servicio de mensajería no está disponible.',
  REPLICA_FAILURE: 'Sistema parcialmente caído: la réplica de datos no está disponible.',
  DB_RECOVERED: 'La base de datos se ha restablecido.',
  REDIS_RECOVERED: 'El servicio de caché se ha restablecido.',
  KAFKA_RECOVERED: 'El servicio de mensajería se ha restablecido.',
  REPLICA_RECOVERED: 'La réplica de datos se ha restablecido.'
};

const SERVICE_NAMES: Record<string, string> = {
  REDIS: 'Servicio de caché',
  KAFKA: 'Servicio de mensajería',
  REPLICA: 'Réplica de datos'
};

@Component({
  selector: 'app-alert-notification',
  imports: [DatePipe],
  templateUrl: './alert-notification.component.html',
  styleUrl: './alert-notification.component.css'
})
export class AlertNotificationComponent {
  private readonly webSocketService = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly activeFailures = signal<Record<string, AlertViewModel>>({});
  private readonly recoveredAlerts = signal<AlertViewModel[]>([]);

  readonly failures = this.activeFailures.asReadonly();
  readonly recoveries = this.recoveredAlerts.asReadonly();

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
        return SERVICE_NAMES[serviceKey] || serviceKey;
      });
      const latestTimestamp = Math.max(...partialFailures.map(f => f.timestamp));
      
      const mergedAlert: AlertViewModel = {
        id: 'merged-partial-failure',
        code: 'MERGED_PARTIAL_FAILURE',
        title: 'Sistema parcialmente caído',
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

  getFailureClass(alert: AlertViewModel): string {
    return alert.severity === 'critical' ? 'alert-failure-critical' : 'alert-failure-partial';
  }

  private handleAlert(alert: AlertMessage): void {
    const normalizedCode = alert.code?.toUpperCase?.() ?? '';
    const title = ALERT_TEXT[normalizedCode] ?? 'Estado de servicio actualizado.';
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
