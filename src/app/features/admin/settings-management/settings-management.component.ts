import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { animate, style, transition, trigger } from '@angular/animations';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs';
import { MessageService } from '../../../core/services/message.service';
import { SystemConfigService } from '../../../core/services/system-config.service';
import {
  AdvancedConfigRequestDTO,
  AlertsConfigRequestDTO,
  ConfigAuditLogResponseDTO,
  IncidentsConfigRequestDTO,
  NotificationsConfigRequestDTO,
  PredictionsConfigRequestDTO,
  PresenceConfigRequestDTO,
  SecurityConfigRequestDTO,
  SessionsConfigRequestDTO,
  SystemConfigSnapshotResponseDTO
} from '../../../shared/models/system-config.model';

type TabKey =
  | 'presence'
  | 'alerts'
  | 'predictions'
  | 'sessions'
  | 'security'
  | 'incidents'
  | 'notifications'
  | 'advanced'
  | 'audit';

type FileTypeOption = {
  key: string;
  label: string;
  mimes: string[];
};

@Component({
  selector: 'app-settings-management',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './settings-management.component.html',
  styleUrl: './settings-management.component.css',
  animations: [
    trigger('tabContent', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('220ms cubic-bezier(0.2, 0.9, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('140ms ease-in', style({ opacity: 0, transform: 'translateY(6px)' }))
      ])
    ])
  ]
})
export class SettingsManagementComponent implements OnInit {
  private systemConfigService = inject(SystemConfigService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

  readonly tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'presence', label: 'Presencia' },
    { key: 'alerts', label: 'Alertas' },
    { key: 'predictions', label: 'Predicciones' },
    { key: 'sessions', label: 'Sesiones' },
    { key: 'security', label: 'Seguridad' },
    { key: 'incidents', label: 'Incidencias' },
    { key: 'notifications', label: 'Notificaciones' },
    { key: 'advanced', label: 'Avanzado' },
    { key: 'audit', label: 'Auditoría' }
  ];

  readonly fileTypeOptions: FileTypeOption[] = [
    {
      key: 'images',
      label: 'Imágenes',
      mimes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    },
    {
      key: 'pdf',
      label: 'PDF',
      mimes: ['application/pdf']
    },
    {
      key: 'word',
      label: 'Word',
      mimes: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    },
    {
      key: 'excel',
      label: 'Excel',
      mimes: ['application/ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    },
    {
      key: 'video',
      label: 'Videos',
      mimes: ['video/mp4', 'video/webm', 'video/quicktime']
    }
  ];

  activeTab: TabKey = 'presence';

  loading = false;
  saving = false;
  auditLoading = false;

  snapshotMeta: Pick<SystemConfigSnapshotResponseDTO, 'updatedAt' | 'updatedBy'> = {
    updatedAt: null,
    updatedBy: null
  };

  presenceConfig: PresenceConfigRequestDTO = {
    presenceAuditEnabled: true,
    presenceAutoCleanupEnabled: false,
    presenceAutoCleanupDays: null
  };
  presenceTotalLogCount = 0;

  alertsConfig: AlertsConfigRequestDTO = {
    alertThresholdOkDays: 21,
    alertThresholdLowDays: 14,
    alertThresholdMediumDays: 7,
    alertThresholdHighDays: 3,
    expirationCriticalDays: 3,
    expirationHighDays: 7,
    expirationMediumDays: 14,
    forecastHorizonDays: 14,
    forecastHistoryWeeks: 12
  };

  predictionsConfig: PredictionsConfigRequestDTO = {
    predictionRefreshEnabled: true,
    predictionRefreshIntervalHours: 6,
    predictionHistoryDays: 90,
    predictionBatchSize: 20
  };

  sessionsConfig: SessionsConfigRequestDTO = {
    staleSessionTimeoutSeconds: 60
  };

  securityConfig: SecurityConfigRequestDTO = {
    jwtExpirationMs: 86400000,
    minPasswordLength: 6,
    maxEscalationMinutes: 1440
  };
  securityJwtExpirationHours = 24;

  incidentsConfig: IncidentsConfigRequestDTO = {
    maxChatMessageLength: 5000,
    maxAdminAttachableAudits: 200,
    maxUploadFileSizeBytes: 10485760,
    allowedFileTypes: 'image/jpeg,image/png,image/gif,image/webp,application/pdf'
  };
  incidentsMaxUploadSizeMB = 10;
  selectedIncidentFileTypes: string[] = ['images', 'pdf'];
  useCustomFileTypes = false;
  customIncidentMimeTypes = '';

  notificationsConfig: NotificationsConfigRequestDTO = {
    notifyWeeklyPlanCreated: true,
    notifyWeeklyPlanActivated: true,
    notifyWeeklyPlanSlotConfirmed: true,
    notifyWeeklyPlanDayConfirmed: true,
    notifyWeeklyPlanCompleted: true,
    notifyWeeklyPlanCancelled: true,
    notifyFoodCrisisActivated: true,
    notifyFoodCrisisLifted: true,
    notifyStockPredictionTriggered: true,
    notifyIncidentCreated: true,
    notifyIncidentOpened: true,
    notifyIncidentClosed: true,
    notifyIncidentChatMessage: true,
    notificationAutoCleanupEnabled: false,
    notificationRetentionDays: null
  };
  notificationsTotalCount = 0;

  advancedConfig: AdvancedConfigRequestDTO = {
    outboxProcessingIntervalMs: 5000,
    outboxBatchSize: 50,
    outboxMaxConsecutiveFailures: 3,
    kafkaSendTimeoutSeconds: 5
  };

  auditLogs: ConfigAuditLogResponseDTO[] = [];
  auditPage = 0;
  auditSize = 20;
  auditTotalPages = 0;

  ngOnInit(): void {
    this.loadSnapshot();
  }

  loadSnapshot(showSuccessMessage = false): void {
    this.loading = true;

    this.systemConfigService
      .getCurrent()
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: snapshot => {
          this.snapshotMeta.updatedAt = snapshot.updatedAt;
          this.snapshotMeta.updatedBy = snapshot.updatedBy;

          this.presenceConfig = {
            presenceAuditEnabled: snapshot.presence.presenceAuditEnabled,
            presenceAutoCleanupEnabled: snapshot.presence.presenceAutoCleanupEnabled,
            presenceAutoCleanupDays: snapshot.presence.presenceAutoCleanupDays
          };
          this.presenceTotalLogCount = snapshot.presence.totalLogCount;

          this.alertsConfig = { ...snapshot.alerts };
          this.predictionsConfig = { ...snapshot.predictions };
          this.sessionsConfig = { ...snapshot.sessions };
          this.securityConfig = { ...snapshot.security };
          this.securityJwtExpirationHours = this.roundToTwo(snapshot.security.jwtExpirationMs / 3600000);
          this.incidentsConfig = { ...snapshot.incidents };
          this.incidentsMaxUploadSizeMB = this.roundToTwo(snapshot.incidents.maxUploadFileSizeBytes / (1024 * 1024));
          this.hydrateIncidentFileTypes(snapshot.incidents.allowedFileTypes);

          this.notificationsConfig = {
            notifyWeeklyPlanCreated: snapshot.notifications.notifyWeeklyPlanCreated,
            notifyWeeklyPlanActivated: snapshot.notifications.notifyWeeklyPlanActivated,
            notifyWeeklyPlanSlotConfirmed: snapshot.notifications.notifyWeeklyPlanSlotConfirmed,
            notifyWeeklyPlanDayConfirmed: snapshot.notifications.notifyWeeklyPlanDayConfirmed,
            notifyWeeklyPlanCompleted: snapshot.notifications.notifyWeeklyPlanCompleted,
            notifyWeeklyPlanCancelled: snapshot.notifications.notifyWeeklyPlanCancelled,
            notifyFoodCrisisActivated: snapshot.notifications.notifyFoodCrisisActivated,
            notifyFoodCrisisLifted: snapshot.notifications.notifyFoodCrisisLifted,
            notifyStockPredictionTriggered: snapshot.notifications.notifyStockPredictionTriggered,
            notifyIncidentCreated: snapshot.notifications.notifyIncidentCreated,
            notifyIncidentOpened: snapshot.notifications.notifyIncidentOpened,
            notifyIncidentClosed: snapshot.notifications.notifyIncidentClosed,
            notifyIncidentChatMessage: snapshot.notifications.notifyIncidentChatMessage,
            notificationAutoCleanupEnabled: snapshot.notifications.notificationAutoCleanupEnabled,
            notificationRetentionDays: snapshot.notifications.notificationRetentionDays
          };
          this.notificationsTotalCount = snapshot.notifications.totalNotificationCount;

          this.advancedConfig = { ...snapshot.advanced };

          if (this.activeTab === 'audit') {
            this.loadAudit(this.auditPage);
          }

          if (showSuccessMessage) {
            this.messageService.showSuccess('Configuración recargada correctamente');
          }

          this.cdr.detectChanges();

        },
        error: () => {
          this.messageService.showError('No se pudo cargar la configuración del sistema');
          this.cdr.detectChanges();
        }
      });
  }

  reloadCurrentView(): void {
    if (this.loading || this.saving) {
      return;
    }
    this.loadSnapshot(true);
  }

  onTabChange(tab: TabKey): void {
    this.activeTab = tab;
    if (tab === 'audit') {
      this.loadAudit(0);
    }
  }

  saveActiveTab(): void {
    if (this.activeTab === 'audit') {
      return;
    }

    this.saving = true;

    let request$: Observable<unknown>;
    switch (this.activeTab) {
      case 'presence':
        request$ = this.systemConfigService.updatePresence(this.presenceConfig);
        break;
      case 'alerts':
        request$ = this.systemConfigService.updateAlerts(this.alertsConfig);
        break;
      case 'predictions':
        request$ = this.systemConfigService.updatePredictions(this.predictionsConfig);
        break;
      case 'sessions':
        request$ = this.systemConfigService.updateSessions(this.sessionsConfig);
        break;
      case 'security':
        this.securityConfig.jwtExpirationMs = Math.round(this.securityJwtExpirationHours * 3600000);
        request$ = this.systemConfigService.updateSecurity(this.securityConfig);
        break;
      case 'incidents':
        this.incidentsConfig.maxUploadFileSizeBytes = Math.round(this.incidentsMaxUploadSizeMB * 1024 * 1024);
        this.incidentsConfig.allowedFileTypes = this.buildAllowedMimeTypes();
        request$ = this.systemConfigService.updateIncidents(this.incidentsConfig);
        break;
      case 'notifications':
        request$ = this.systemConfigService.updateNotifications(this.notificationsConfig);
        break;
      case 'advanced':
        request$ = this.systemConfigService.updateAdvanced(this.advancedConfig);
        break;
      default:
        request$ = this.systemConfigService.getCurrent();
        break;
    }

    request$
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.messageService.showSuccess('Configuración actualizada correctamente');
          this.loadSnapshot();
        },
        error: () => this.messageService.showError('No se pudo guardar la configuración')
      });
  }

  async purgePresenceLogs(): Promise<void> {
    const confirmed = await this.messageService.confirm(
      'Purgar actividad de presencia',
      'Se eliminarán los registros de actividad de presencia seleccionados. Esta acción no se puede deshacer.',
      'Purgar',
      'Cancelar'
    );
    if (!confirmed) {
      return;
    }

    this.systemConfigService.purgePresenceLogs().subscribe({
      next: result => {
        this.messageService.showSuccess(`Se eliminaron ${result.deletedCount} logs de presencia`);
        this.loadSnapshot();
      },
      error: () => this.messageService.showError('No se pudo purgar el log de presencia')
    });
  }

  async purgeNotificationLogs(): Promise<void> {
    const confirmed = await this.messageService.confirm(
      'Purgar notificaciones leídas',
      'Se eliminarán las notificaciones leídas. Esta acción no se puede deshacer.',
      'Purgar',
      'Cancelar'
    );
    if (!confirmed) {
      return;
    }

    this.systemConfigService.purgeNotificationLogs().subscribe({
      next: result => {
        this.messageService.showSuccess(`Se eliminaron ${result.deletedCount} notificaciones`);
        this.loadSnapshot();
      },
      error: () => this.messageService.showError('No se pudo purgar el log de notificaciones')
    });
  }

  loadAudit(page: number): void {
    this.auditLoading = true;
    this.auditPage = page;

    this.systemConfigService
      .getGlobalAudit(this.auditPage, this.auditSize)
      .pipe(finalize(() => {
        this.auditLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: response => {
          this.auditLogs = response.content;
          this.auditTotalPages = response.totalPages;
          this.cdr.detectChanges();
        },
        error: () => {
          this.messageService.showError('No se pudo cargar la auditoría global');
          this.cdr.detectChanges();
        }
      });
  }

  onIncidentFileTypeToggle(optionKey: string, checked: boolean): void {
    if (checked) {
      if (!this.selectedIncidentFileTypes.includes(optionKey)) {
        this.selectedIncidentFileTypes.push(optionKey);
      }
      return;
    }

    this.selectedIncidentFileTypes = this.selectedIncidentFileTypes.filter(key => key !== optionKey);
  }

  private hydrateIncidentFileTypes(rawMimes: string): void {
    const mimeSet = new Set(
      (rawMimes || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
    );

    const selected: string[] = [];
    const knownMimes = new Set<string>();

    for (const option of this.fileTypeOptions) {
      const hasAnyMime = option.mimes.some(mime => mimeSet.has(mime));
      if (hasAnyMime) {
        selected.push(option.key);
      }
      for (const mime of option.mimes) {
        knownMimes.add(mime);
      }
    }

    const custom = Array.from(mimeSet).filter(mime => !knownMimes.has(mime));
    this.selectedIncidentFileTypes = selected;
    this.useCustomFileTypes = custom.length > 0;
    this.customIncidentMimeTypes = custom.join(', ');
  }

  private buildAllowedMimeTypes(): string {
    const selectedMimes = this.fileTypeOptions
      .filter(option => this.selectedIncidentFileTypes.includes(option.key))
      .flatMap(option => option.mimes);

    const customMimes = this.useCustomFileTypes
      ? this.customIncidentMimeTypes
          .split(',')
          .map(value => value.trim())
          .filter(Boolean)
      : [];

    const merged = Array.from(new Set([...selectedMimes, ...customMimes]));
    return merged.join(',');
  }

  private roundToTwo(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
