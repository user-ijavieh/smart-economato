import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { LoggerService } from './logger.service';
import { environment } from '../../../environments/environment';
import {
  AiChatDto,
  AiChatCreateRequest,
  AiChatUpdateRequest,
  AiChatMessageDto,
  AiChatMessageRequest,
  AiChangeProviderRequest,
  AiProviderMetadata,
  Page,
  ToolCall
} from '../../shared/models/ai-chat.model';

@Injectable({
  providedIn: 'root'
})
export class AiChatService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly logger = inject(LoggerService);
  private readonly apiUrl = environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/api/chat`;
  private readonly requestTimeoutMs = 30000; // 30s for non-streaming requests

  /**
   * List all chats for current user
   */
  listChats(): Observable<AiChatDto[]> {
    return this.http
      .get<any[]>(`${this.baseUrl}/chats`)
      .pipe(
        timeout(this.requestTimeoutMs),
        map(chats => chats.map(c => this.mapChatDto(c))),
        catchError(err => this.handleError(err))
      );
  }

  /**
   * Create a new chat conversation
   */
  createChat(request: AiChatCreateRequest): Observable<AiChatDto> {
    return this.http
      .post<any>(`${this.baseUrl}/chats`, request)
      .pipe(
        timeout(this.requestTimeoutMs),
        map(c => this.mapChatDto(c)),
        catchError(err => this.handleError(err))
      );
  }

  /**
   * Get chat history messages (non-paged for MVP, can be improved)
   */
  getChatMessages(chatId: number): Observable<AiChatMessageDto[]> {
    return this.http
      .get<any[]>(`${this.baseUrl}/chats/${chatId}/messages`)
      .pipe(
        timeout(this.requestTimeoutMs),
        map(messages => messages.map(m => this.mapMessageDto(m))),
        catchError(err => this.handleError(err))
      );
  }

  getChatMessagesPage(chatId: number, page = 0, size = 30): Observable<Page<AiChatMessageDto>> {
    return this.http
      .get<any>(`${this.baseUrl}/chats/${chatId}/messages/page`, {
        params: {
          page,
          size
        }
      })
      .pipe(
        timeout(this.requestTimeoutMs),
        map(response => ({
          ...response,
          content: (response?.content || []).map((m: any) => this.mapMessageDto(m))
        } as Page<AiChatMessageDto>)),
        catchError(err => this.handleError(err))
      );
  }

  /**
   * Send a message to chat with streaming response
   * Returns a ReadableStream for manual consumption
   */
  sendChatMessageStream(
    chatId: number,
    request: AiChatMessageRequest,
    abortSignal?: AbortSignal
  ): Observable<ReadableStream<Uint8Array> | null> {
    return new Observable(observer => {
      const token = this.authService.getToken() || '';
      fetch(`${this.baseUrl}/chats/${chatId}/messages/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(request),
        signal: abortSignal
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          observer.next(response.body);
          observer.complete();
        })
        .catch(error => {
          observer.error(error);
        });
    });
  }

  /**
   * Change active provider for a chat
   */
  changeProvider(chatId: number, request: AiChangeProviderRequest): Observable<AiChatDto> {
    return this.http
      .patch<any>(`${this.baseUrl}/chats/${chatId}/provider`, request)
      .pipe(
        timeout(this.requestTimeoutMs),
        map(c => this.mapChatDto(c)),
        catchError(err => this.handleError(err))
      );
  }

  updateChat(chatId: number, request: AiChatUpdateRequest): Observable<AiChatDto> {
    return this.http
      .patch<any>(`${this.baseUrl}/chats/${chatId}`, request)
      .pipe(
        timeout(this.requestTimeoutMs),
        map(c => this.mapChatDto(c)),
        catchError(err => this.handleError(err))
      );
  }

  /**
   * Delete a chat (archive)
   */
  deleteChat(chatId: number): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/chats/${chatId}`)
      .pipe(
        timeout(this.requestTimeoutMs),
        catchError(err => this.handleError(err))
      );
  }

  /**
   * List available AI providers
   */
  getProviders(): Observable<AiProviderMetadata[]> {
    return this.http
      .get<Array<Record<string, string>>>(`${this.baseUrl}/providers`)
      .pipe(
        timeout(this.requestTimeoutMs),
        catchError(err => this.handleError(err)),
        map((providers) => providers.map(item => ({
          name: item['name'] as AiProviderMetadata['name'],
          displayName: item['displayName'] || item['name'],
          modelDefault: item['modelDefault'],
          enabled: true
        })))
      );
  }

  private mapChatDto(backend: any): AiChatDto {
    return {
      id: backend.id,
      title: backend.title,
      status: backend.status,
      activeProvider: backend.activeProvider,
      userLanguage: backend.userLanguage,
      createdAt: this.toIsoString(backend.createdAt),
      lastMessageAt: backend.lastMessageAt ? this.toIsoString(backend.lastMessageAt) : null,
      messageCount: backend.messageCount || 0
    };
  }

  private mapMessageDto(backend: any): AiChatMessageDto {
    const toolCalls = this.parseToolCalls(backend.toolCalls);

    return {
      id: backend.id,
      role: backend.role,
      content: backend.content,
      toolName: backend.toolName || null,
      toolCallId: backend.toolCallId || null,
      toolResult: backend.toolResult || null,
      thinkingContent: backend.thinkingContent ?? backend.thinking_content ?? null,
      toolCalls,
      inputTokens: backend.inputTokens || 0,
      outputTokens: backend.outputTokens || 0,
      createdAt: this.toIsoString(backend.createdAt)
    };
  }

  private parseToolCalls(rawToolCalls: unknown): ToolCall[] | null {
    if (!rawToolCalls) {
      return null;
    }

    if (Array.isArray(rawToolCalls)) {
      return rawToolCalls as ToolCall[];
    }

    if (typeof rawToolCalls === 'string') {
      try {
        const parsed = JSON.parse(rawToolCalls);
        return Array.isArray(parsed) ? (parsed as ToolCall[]) : null;
      } catch {
        return null;
      }
    }

    return null;
  }

  private toIsoString(dateValue: any): string {
    if (!dateValue) {
      return new Date().toISOString();
    }
    // Si es un array (Java LocalDateTime: [año, mes, día, hora, min, seg, nanos])
    if (Array.isArray(dateValue)) {
      const [year, month, day, hour, min, sec] = dateValue;
      return new Date(year, month - 1, day, hour, min, sec).toISOString();
    }
    // Si es un string ISO ya
    if (typeof dateValue === 'string') {
      return dateValue;
    }
    // Si es un objeto Date
    if (dateValue instanceof Date) {
      return dateValue.toISOString();
    }
    // Fallback
    return new Date(dateValue).toISOString();
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'Error en servicio de chat IA';

    if (error instanceof HttpErrorResponse) {
      if (error.status === 200) {
        errorMessage = 'Respuesta inválida del backend (HTTP 200). Revisa el formato JSON devuelto por el servicio.';
        this.logger.error('AiChatService parse error:', error);
        return throwError(() => new Error(errorMessage));
      }

      switch (error.status) {
        case 400:
          errorMessage = 'Solicitud inválida: ' + (error.error?.message || 'datos incorrectos');
          break;
        case 401:
          errorMessage = 'No autorizado. Inicia sesión nuevamente.';
          break;
        case 404:
          errorMessage = 'Chat no encontrado.';
          break;
        case 422:
          errorMessage = 'Configuración de IA no disponible.';
          break;
        case 429:
          errorMessage = 'Límite de solicitudes excedido. Reintentar en unos segundos.';
          break;
        case 502:
          errorMessage = 'Servicio de IA no disponible. Reintentar más tarde.';
          break;
        default:
          errorMessage = `Error: ${error.status} ${error.statusText}`;
      }
    } else if (error.name === 'TimeoutError') {
      errorMessage = 'Tiempo de espera agotado. Reintentar.';
    }

    this.logger.error('AiChatService error:', error);
    return throwError(() => new Error(errorMessage));
  }
}
