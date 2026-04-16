/** AI Configuration related models */

export type AiProvider = 'OPENAI' | 'ANTHROPIC' | 'DEEPSEEK' | 'GOOGLE';

/**
 * API Key metadata
 */
export interface AiKeyMetadata {
  id?: number;
  provider: AiProvider;
  keyPreview?: string; // Last 4 chars like "****...abcd"
  enabled: boolean;
  lastUpdatedAt?: string; // ISO datetime
  lastUpdatedBy?: string; // Username
}

/**
 * Request to save/update API key
 */
export interface AiKeySaveRequest {
  provider: AiProvider;
  apiKey: string;
}

/**
 * Model configuration for a provider
 */
export interface AiModelConfig {
  provider: AiProvider;
  modelId: string; // e.g., "gpt-4o", "claude-sonnet-4"
  temperature: number; // 0.0 - 2.0
  maxTokens: number; // Max output tokens
  topP?: number; // 0.0 - 1.0
  frequencyPenalty?: number; // -2.0 - 2.0
}

/**
 * Operational limits for AI service
 */
export interface AiOperationalLimits {
  messagesPerMinute: number; // Rate limit
  maxChatsPerUser: number;
  maxMessagesPerChat: number;
  maxApiKeysPerUser: number;
  circuitBreakerThreshold: number; // Failure threshold before opening circuit
}

/**
 * Complete AI configuration
 */
export interface AiConfigurationDto {
  apiKeys: AiKeyMetadata[]; // Current state of API keys
  modelConfigs: AiModelConfig[]; // Model settings per provider
  operationalLimits: AiOperationalLimits; // Rate limits and thresholds
  lastModifiedAt?: string;
  lastModifiedBy?: string;
}

/**
 * Error detail for IA configuration
 */
export interface AiConfigError {
  provider: AiProvider;
  errorCode: string;
  message: string;
}

/**
 * Audit log entry for IA configuration changes
 */
export interface AiConfigAuditLogEntry {
  id: number;
  action: string; // 'CREATE_KEY', 'UPDATE_KEY', 'DELETE_KEY', 'UPDATE_MODEL', 'UPDATE_LIMITS'
  provider: AiProvider;
  modifiedBy: string;
  modifiedAt: string; // ISO datetime
  details: string; // JSON or description
}

/**
 * Nest server technical configuration
 */
export interface AiNestServerConfig {
  baseUrl: string;
  serviceKey: string;
  allowedOrigin: string;
  streamTimeoutMs: number;
  connectionTimeoutMs: number;
  readTimeoutMs: number;
  maxRetries: number;
  completionEndpoint: string;
  mockEnabled: boolean;
}

/**
 * AI Chat technical configuration
 */
export interface AiChatTechnicalConfig {
  defaultProvider: AiProvider;
  defaultLanguage: string;
  supportedLanguages: string[];
  titleMaxLength: number;
  maxConcurrentStreamsPerUser: number;
  autoArchiveOnLimit: boolean;
  maxChatHistoryDays?: number;
}

/**
 * Streaming and output configuration
 */
export interface AiStreamingConfig {
  enableThinkingStream: boolean;
  enableToolStream: boolean;
  chunkSize: number;
  flushIntervalMs: number;
  maxStreamDurationMs: number;
}

/**
 * Complete technical AI configuration
 */
export interface AiTechnicalConfiguration {
  nestServer: AiNestServerConfig;
  chatConfig: AiChatTechnicalConfig;
  streaming: AiStreamingConfig;
  lastModifiedAt?: string;
  lastModifiedBy?: string;
}
