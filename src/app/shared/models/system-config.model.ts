export type ConfigCategory =
  | 'presence'
  | 'alerts'
  | 'predictions'
  | 'sessions'
  | 'security'
  | 'incidents'
  | 'notifications'
  | 'advanced';

export interface PresenceConfigResponseDTO {
  presenceAuditEnabled: boolean;
  presenceAutoCleanupEnabled: boolean;
  presenceAutoCleanupDays: number | null;
  totalLogCount: number;
}

export interface AlertsConfigResponseDTO {
  alertThresholdOkDays: number;
  alertThresholdLowDays: number;
  alertThresholdMediumDays: number;
  alertThresholdHighDays: number;
  expirationCriticalDays: number;
  expirationHighDays: number;
  expirationMediumDays: number;
  forecastHorizonDays: number;
  forecastHistoryWeeks: number;
}

export interface PredictionsConfigResponseDTO {
  predictionRefreshEnabled: boolean;
  predictionRefreshIntervalHours: number;
  predictionHistoryDays: number;
  predictionBatchSize: number;
}

export interface SessionsConfigResponseDTO {
  staleSessionTimeoutSeconds: number;
}

export interface SecurityConfigResponseDTO {
  jwtExpirationMs: number;
  minPasswordLength: number;
  maxEscalationMinutes: number;
}

export interface IncidentsConfigResponseDTO {
  maxChatMessageLength: number;
  maxAdminAttachableAudits: number;
  maxUploadFileSizeBytes: number;
  allowedFileTypes: string;
}

export interface NotificationsConfigResponseDTO {
  notifyWeeklyPlanCreated: boolean;
  notifyWeeklyPlanActivated: boolean;
  notifyWeeklyPlanSlotConfirmed: boolean;
  notifyWeeklyPlanDayConfirmed: boolean;
  notifyWeeklyPlanCompleted: boolean;
  notifyWeeklyPlanCancelled: boolean;
  notifyFoodCrisisActivated: boolean;
  notifyFoodCrisisLifted: boolean;
  notifyStockPredictionTriggered: boolean;
  notifyIncidentCreated: boolean;
  notifyIncidentOpened: boolean;
  notifyIncidentClosed: boolean;
  notifyIncidentChatMessage: boolean;
  notificationRetentionDays: number | null;
  notificationAutoCleanupEnabled: boolean;
  totalNotificationCount: number;
}

export interface AdvancedConfigResponseDTO {
  outboxProcessingIntervalMs: number;
  outboxBatchSize: number;
  outboxMaxConsecutiveFailures: number;
  kafkaSendTimeoutSeconds: number;
}

export interface SystemConfigSnapshotResponseDTO {
  presence: PresenceConfigResponseDTO;
  alerts: AlertsConfigResponseDTO;
  predictions: PredictionsConfigResponseDTO;
  sessions: SessionsConfigResponseDTO;
  security: SecurityConfigResponseDTO;
  incidents: IncidentsConfigResponseDTO;
  notifications: NotificationsConfigResponseDTO;
  advanced: AdvancedConfigResponseDTO;
  updatedBy: string | null;
  updatedAt: string | null;
}

export type PresenceConfigRequestDTO = Omit<PresenceConfigResponseDTO, 'totalLogCount'>;
export type AlertsConfigRequestDTO = AlertsConfigResponseDTO;
export type PredictionsConfigRequestDTO = PredictionsConfigResponseDTO;
export type SessionsConfigRequestDTO = SessionsConfigResponseDTO;
export type SecurityConfigRequestDTO = SecurityConfigResponseDTO;
export type IncidentsConfigRequestDTO = IncidentsConfigResponseDTO;
export type NotificationsConfigRequestDTO = Omit<NotificationsConfigResponseDTO, 'totalNotificationCount'>;
export type AdvancedConfigRequestDTO = AdvancedConfigResponseDTO;

export interface ConfigAuditLogResponseDTO {
  username: string | null;
  category: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
}

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface PurgeResultResponseDTO {
  deletedCount: number;
}
