/** AI Chat related DTOs and models */

/** Provider types supported by backend */
export type AiProvider = 'OPENAI' | 'ANTHROPIC' | 'DEEPSEEK' | 'GOOGLE';

/** Chat status */
export type AiChatStatus = 'ACTIVE' | 'ARCHIVED';

/** Message role */
export type AiMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';

/** SSE Event types */
export type SseEventType = 'token' | 'done' | 'error' | 'tool' | 'tool_called' | 'thinking' | 'thinking_delta' | 'tool_result';

/**
 * Response DTO for listing chats
 */
export interface AiChatDto {
  id: number;
  title: string;
  status: AiChatStatus;
  activeProvider: AiProvider;
  userLanguage: string;
  createdAt: string; // ISO datetime
  lastMessageAt: string | null; // ISO datetime
  messageCount: number;
}

/**
 * Request DTO to create a new chat
 */
export interface AiChatCreateRequest {
  title?: string; // Optional, auto-generated if omitted
  provider: AiProvider;
}

/**
 * Request DTO to update a chat
 */
export interface AiChatUpdateRequest {
  title: string;
}

/**
 * Response DTO for a chat message
 */
export interface AiChatMessageDto {
  id: number;
  role: AiMessageRole;
  content: string;
  toolName?: string | null;
  toolCallId?: string | null;
  toolResult?: string | null;
  thinkingContent?: string | null;
  toolCalls?: ToolCall[] | null;
  inputTokens: number;
  outputTokens: number;
  createdAt: string; // ISO datetime
}

/**
 * Request DTO to send a message with streaming
 */
export interface AiChatMessageRequest {
  content: string; // Required, max 5000 chars
  language?: string; // Optional, default 'es'
}

/**
 * Request DTO to change provider for a chat
 */
export interface AiChangeProviderRequest {
  provider: AiProvider;
}

/**
 * SSE event container parsed from server
 */
export interface SseEvent {
  type: SseEventType;
  data: string; // Token text or tool name
  fullResponse?: string; // Complete response, only in 'done' event
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Tool call information object
 */
export interface ToolCall {
  toolName: string;
  toolCallId?: string;
  toolResult?: string;
}

/**
 * Accumulated streaming response result
 */
export interface StreamingResponse {
  tokens: string[]; // Accumulated tokens
  fullResponse: string; // Complete merged response
  inputTokens: number;
  outputTokens: number;
  completed: boolean;
  error?: string; // If error occurred
  toolName?: string; // If tool was called
  thinkingContent?: string; // AI reasoning/thinking trace
  toolCalls?: ToolCall[]; // List of tool invocations during response
}

/**
 * Paginated response from backend
 */
export interface Page<T> {
  content: T[];
  first: boolean;
  last: boolean;
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/**
 * Provider metadata from backend
 */
export interface AiProviderMetadata {
  name: AiProvider;
  enabled: boolean;
  displayName?: string;
  modelDefault?: string;
}
