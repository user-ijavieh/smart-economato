import { ChangeDetectorRef, Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { animate, style, transition, trigger } from '@angular/animations';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs';
import { MessageService } from '../../../core/services/message.service';
import { SystemConfigService } from '../../../core/services/system-config.service';
import { AiConfigurationService } from '../../../core/services/ai-configuration.service';
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
import {
  AiConfigurationDto,
  AiKeySaveRequest,
  AiKeyMetadata,
  AiProvider,
  AiChatTechnicalConfig,
  AiStreamingConfig
} from '../../../shared/models/ai-config.model';

type TabKey =
  | 'presence'
  | 'alerts'
  | 'predictions'
  | 'sessions'
  | 'security'
  | 'incidents'
  | 'notifications'
  | 'advanced'
  | 'ia'
  | 'audit';

type FileTypeOption = {
  key: string;
  label: string;
  mimes: string[];
};

@Component({
  selector: 'app-settings-management',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, TranslateModule],
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
export class SettingsManagementComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private systemConfigService = inject(SystemConfigService);
  private aiConfigService = inject(AiConfigurationService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);

  readonly tabs: Array<{ key: TabKey; labelKey: string }> = [
    { key: 'presence', labelKey: 'SETTINGS.TABS.PRESENCE' },
    { key: 'alerts', labelKey: 'SETTINGS.TABS.ALERTS' },
    { key: 'predictions', labelKey: 'SETTINGS.TABS.PREDICTIONS' },
    { key: 'sessions', labelKey: 'SETTINGS.TABS.SESSIONS' },
    { key: 'security', labelKey: 'SETTINGS.TABS.SECURITY' },
    { key: 'incidents', labelKey: 'SETTINGS.TABS.INCIDENTS' },
    { key: 'notifications', labelKey: 'SETTINGS.TABS.NOTIFICATIONS' },
    { key: 'advanced', labelKey: 'SETTINGS.TABS.ADVANCED' },
    { key: 'ia', labelKey: 'SETTINGS.TABS.IA' },
    { key: 'audit', labelKey: 'SETTINGS.TABS.AUDIT' }
  ];

  readonly fileTypeOptions: Array<{ key: string; labelKey: string; mimes: string[] }> = [
    {
      key: 'images',
      labelKey: 'SETTINGS.FILE_TYPES.IMAGES',
      mimes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    },
    {
      key: 'pdf',
      labelKey: 'SETTINGS.FILE_TYPES.PDF',
      mimes: ['application/pdf']
    },
    {
      key: 'word',
      labelKey: 'SETTINGS.FILE_TYPES.WORD',
      mimes: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    },
    {
      key: 'excel',
      labelKey: 'SETTINGS.FILE_TYPES.EXCEL',
      mimes: ['application/ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    },
    {
      key: 'video',
      labelKey: 'SETTINGS.FILE_TYPES.VIDEO',
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

  // AI Configuration
  aiConfig: AiConfigurationDto | null = null;
  aiKeys: AiKeyMetadata[] = [];
  aiLoading = false;
  aiNewKeyProvider: AiProvider | null = null;
  aiNewKeyValue = '';
  aiShowNewKeyForm = false;
  aiDeletingKeyProvider: AiProvider | null = null;
  aiSavingKey = false;

  // AI Technical Configuration
  aiChatConfig: AiChatTechnicalConfig = {
    defaultProvider: 'OPENAI',
    defaultLanguage: 'es',
    supportedLanguages: ['es', 'en', 'fr', 'de', 'it', 'pt', 'ca', 'eu', 'gl'],
    titleMaxLength: 200,
    maxConcurrentStreamsPerUser: 2,
    autoArchiveOnLimit: true,
    maxChatHistoryDays: 365
  };

  aiStreamingConfig: AiStreamingConfig = {
    enableThinkingStream: true,
    enableToolStream: true,
    chunkSize: 1024,
    flushIntervalMs: 100,
    maxStreamDurationMs: 120000
  };

  ngOnInit(): void {
    this.loadSnapshot();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
            this.messageService.showSuccess(this.translate.instant('SETTINGS.MESSAGES.RELOAD_SUCCESS'));
          }

          this.cdr.detectChanges();

        },
        error: () => {
          this.messageService.showError(this.translate.instant('SETTINGS.MESSAGES.LOAD_ERROR'));
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
    } else if (tab === 'ia') {
      this.loadAiConfiguration();
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
      case 'ia':
        // IA tab does not have a single save; individual saves handled separately
        this.saving = false;
        return;
      default:
        request$ = this.systemConfigService.getCurrent();
        break;
    }

    request$
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.messageService.showSuccess(this.translate.instant('SETTINGS.MESSAGES.SAVE_SUCCESS'));
          this.loadSnapshot();
        },
        error: () => this.messageService.showError(this.translate.instant('SETTINGS.MESSAGES.SAVE_ERROR'))
      });
  }

  // AI Configuration Methods

  loadAiConfiguration(): void {
    this.aiLoading = true;
    this.aiConfigService
      .getApiKeys()
      .pipe(finalize(() => {
        this.aiLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (keys) => {
          this.aiKeys = keys;
          this.aiConfig = {
            apiKeys: keys,
            modelConfigs: [],
            operationalLimits: {
              messagesPerMinute: 0,
              maxChatsPerUser: 0,
              maxMessagesPerChat: 0,
              maxApiKeysPerUser: 0,
              circuitBreakerThreshold: 0
            }
          };
          this.cdr.detectChanges();
        },
        error: (err: Error) => {
          this.messageService.showError(this.translate.instant('SETTINGS.IA.ERRORS.LOAD_ERROR', { error: err.message }));
          this.cdr.detectChanges();
        }
      });
  }

  showAiNewKeyForm(): void {
    this.aiShowNewKeyForm = true;
    this.aiNewKeyProvider = null;
    this.aiNewKeyValue = '';
    this.cdr.detectChanges();
  }

  saveAiKey(): void {
    if (!this.aiNewKeyProvider || !this.aiNewKeyValue.trim()) {
      this.messageService.showError(this.translate.instant('SETTINGS.IA.ERRORS.SELECT_PROVIDER_KEY'));
      return;
    }

    this.aiSavingKey = true;
    const request: AiKeySaveRequest = {
      provider: this.aiNewKeyProvider,
      apiKey: this.aiNewKeyValue
    };

    this.aiConfigService
      .saveApiKey(request)
      .pipe(finalize(() => {
        this.aiSavingKey = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (updated) => {
          const idx = this.aiKeys.findIndex(k => k.provider === updated.provider);
          if (idx >= 0) {
            this.aiKeys[idx] = updated;
          } else {
            this.aiKeys.push(updated);
          }
          this.aiShowNewKeyForm = false;
          this.aiNewKeyValue = '';
          this.messageService.showSuccess(this.translate.instant('SETTINGS.IA.MESSAGES.SAVE_SUCCESS', { provider: this.aiNewKeyProvider }));
          this.cdr.detectChanges();
        },
        error: (err: Error) => {
          this.messageService.showError(this.translate.instant('SETTINGS.IA.ERRORS.SAVE_ERROR', { error: err.message }));
        }
      });
  }

  deleteAiKey(provider: AiProvider): void {
    const key = this.aiKeys.find(k => k.provider === provider);
    if (!key) return;

    this.messageService
      .confirm(
        this.translate.instant('SETTINGS.IA.MESSAGES.DELETE_CONFIRM_TITLE'),
        this.translate.instant('SETTINGS.IA.MESSAGES.DELETE_CONFIRM_MSG', { provider }),
        this.translate.instant('SETTINGS.IA.ACTIONS.DELETE'),
        this.translate.instant('SETTINGS.IA.ACTIONS.CANCEL')
      )
      .then((confirmed) => {
        if (confirmed) {
          this.aiConfigService
            .deleteApiKey(provider)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                this.aiKeys = this.aiKeys.filter(k => k.provider !== provider);
                this.messageService.showSuccess(this.translate.instant('SETTINGS.IA.MESSAGES.DELETE_SUCCESS', { provider }));
                this.cdr.detectChanges();
              },
              error: (err: Error) => {
                this.messageService.showError(this.translate.instant('SETTINGS.IA.ERRORS.DELETE_ERROR', { error: err.message }));
              }
            });
        }
      });
  }


  async purgePresenceLogs(): Promise<void> {
    const confirmed = await this.messageService.confirm(
      this.translate.instant('SETTINGS.PURGE_PRESENCE.TITLE'),
      this.translate.instant('SETTINGS.PURGE_PRESENCE.MSG'),
      this.translate.instant('SETTINGS.LABELS.PURGE'),
      this.translate.instant('SETTINGS.LABELS.CANCEL')
    );
    if (!confirmed) {
      return;
    }

    this.systemConfigService.purgePresenceLogs().subscribe({
      next: result => {
        this.messageService.showSuccess(this.translate.instant('SETTINGS.MESSAGES.PURGE_PRESENCE_SUCCESS', { count: result.deletedCount }));
        this.loadSnapshot();
      },
      error: () => this.messageService.showError(this.translate.instant('SETTINGS.MESSAGES.PURGE_PRESENCE_ERROR'))
    });
  }

  async purgeNotificationLogs(): Promise<void> {
    const confirmed = await this.messageService.confirm(
      this.translate.instant('SETTINGS.PURGE_NOTIFICATIONS.TITLE'),
      this.translate.instant('SETTINGS.PURGE_NOTIFICATIONS.MSG'),
      this.translate.instant('SETTINGS.LABELS.PURGE'),
      this.translate.instant('SETTINGS.LABELS.CANCEL')
    );
    if (!confirmed) {
      return;
    }

    this.systemConfigService.purgeNotificationLogs().subscribe({
      next: result => {
        this.messageService.showSuccess(this.translate.instant('SETTINGS.MESSAGES.PURGE_NOTIFICATIONS_SUCCESS', { count: result.deletedCount }));
        this.loadSnapshot();
      },
      error: () => this.messageService.showError(this.translate.instant('SETTINGS.MESSAGES.PURGE_NOTIFICATIONS_ERROR'))
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
          this.messageService.showError(this.translate.instant('SETTINGS.MESSAGES.LOAD_AUDIT_ERROR'));
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
