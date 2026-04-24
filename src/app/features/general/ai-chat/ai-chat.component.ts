import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { marked } from 'marked';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';
import {
  AiChangeProviderRequest,
  AiChatCreateRequest,
  AiChatDto,
  AiChatMessageDto,
  AiChatMessageRequest,
  AiChatUpdateRequest,
  AiProvider,
  AiProviderMetadata,
  AiMessageRole,
  StreamingResponse,
  ToolCall
} from '../../../shared/models/ai-chat.model';
import { AiChatService } from '../../../core/services/ai-chat.service';
import { MessageService } from '../../../core/services/message.service';
import { SseStreamService } from '../../../core/services/sse-stream.service';
import { AuthService } from '../../../core/services/auth.service';
import { StorageService } from '../../../core/services/storage.service';

type RetryableStatus = 429 | 502;

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseModalComponent, NgOptimizedImage],
  templateUrl: './ai-chat.component.html',
  styleUrl: './ai-chat.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiChatComponent implements OnInit, OnDestroy {
  private readonly aiChatService = inject(AiChatService);
  private readonly messageService = inject(MessageService);
  private readonly sseStreamService = inject(SseStreamService);
  private readonly authService = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly storageService = inject(StorageService);
  private readonly destroy$ = new Subject<void>();

  readonly chefPioAvatar = '/assets/img/chef-pio-avatar.png';

  @ViewChild('chatScroller') chatScroller?: ElementRef<HTMLDivElement>;

  chats: AiChatDto[] = [];
  messages: AiChatMessageDto[] = [];
  providers: AiProviderMetadata[] = [];

  selectedChatId: number | null = null;
  selectedChat: AiChatDto | null = null;

  loadingChats = false;
  loadingMessages = false;
  sendingMessage = false;
  showProviderModal = false;
  showRenameModal = false;
  showHistoryDrawer = false; // Nuevo estado para el Drawer

  searchTerm = '';
  messageInput = '';
  renameTitle = '';
  renameChatId: number | null = null;
  providerSelection: AiProvider = 'OPENAI';

  messagePage = 0;
  readonly messagePageSize = 30;
  hasOlderMessages = false;
  loadingOlderMessages = false;

  streamingPreview = '';
  streamingThinking = '';
  streamingToolCalls: any[] = [];
  private streamAbortController: AbortController | null = null;

  // Typing Effect Buffer
  private typingQueue: string[] = [];
  private isTypingLoopRunning = false;

  // Reasoning Expansion Map
  expandedReasoning: Record<number, boolean> = {};

  ngOnInit(): void {
    marked.setOptions({
      breaks: true,
      gfm: true
    });

    const cachedProvider = this.storageService.get('ai_last_provider', 'local') as AiProvider;
    if (cachedProvider) {
      this.providerSelection = cachedProvider;
    }
    this.loadProviders();

    const cachedChatId = this.storageService.get('ai_last_chat_id');
    if (cachedChatId) {
      this.selectedChatId = +cachedChatId;
    }
    this.loadChats(!!cachedChatId); 
  }

  ngOnDestroy(): void {
    this.streamAbortController?.abort();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get visibleChats(): AiChatDto[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.chats;
    }

    return this.chats.filter(chat =>
      chat.title?.toLowerCase().includes(term) ||
      String(chat.id).includes(term)
    );
  }

  get totalMessages(): number {
    return this.chats.reduce((total, chat) => total + (chat.messageCount || 0), 0);
  }

  get activeProvidersCount(): number {
    return new Set(this.chats.map(chat => chat.activeProvider)).size;
  }

  loadChats(selectLatest = true): void {
    if (this.loadingChats) {
      return;
    }

    this.loadingChats = true;
    this.aiChatService.listChats()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingChats = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: chats => {
          this.chats = chats;

          if (selectLatest) {
            if (this.selectedChatId) {
              const match = this.chats.find(chat => chat.id === this.selectedChatId);
              if (match) {
                this.selectedChat = match;
                this.loadMessages(match.id);
              } else {
                this.selectedChatId = null;
                this.selectedChat = null;
                this.messages = [];
              }
            } else if (this.chats.length > 0) {
              this.selectChat(this.chats[0].id);
            }
          }

          this.cdr.markForCheck();
        },
        error: (error: Error) => {
          this.messageService.showError(error.message);
        }
      });
  }

  loadProviders(): void {
    this.aiChatService.getProviders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: providers => {
          this.providers = providers;
          if (providers.length > 0 && !this.storageService.get('ai_last_provider', 'local')) {
            this.providerSelection = providers[0].name;
          }
          this.cdr.markForCheck();
        },
        error: (error: Error) => {
          this.messageService.showError(error.message);
        }
      });
  }

  startNewChat(): void {
    this.cancelStreaming();
    this.selectedChatId = null;
    this.selectedChat = null;
    this.storageService.remove('ai_last_chat_id');
    this.messages = [];
    this.streamingPreview = '';
    this.showHistoryDrawer = false;
    this.cdr.markForCheck();
  }

  selectChat(chatId: number): void {
    if (this.sendingMessage) {
      this.cancelStreaming();
    }

    this.selectedChatId = chatId;
    this.storageService.set('ai_last_chat_id', String(chatId));
    this.selectedChat = this.chats.find(chat => chat.id === chatId) || null;
    if (this.selectedChat) {
      this.providerSelection = this.selectedChat.activeProvider;
    }
    this.messages = [];
    this.streamingPreview = '';
    this.showHistoryDrawer = false;
    this.loadMessages(chatId);
    this.cdr.markForCheck();
  }

  loadMessages(chatId: number): void {
    this.loadingMessages = true;
    this.messagePage = 0;
    this.hasOlderMessages = false;

    this.aiChatService.getChatMessagesPage(chatId, 0, this.messagePageSize)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingMessages = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: page => {
          const sortedBatch = [...(page.content || [])].sort((a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          this.messages = this.normalizeMessagesForUi(sortedBatch);
          this.messagePage = page.number || 0;
          this.hasOlderMessages = !page.last;
          this.scrollToBottom('auto', true);
        },
        error: (error: Error) => {
          this.messageService.showError(error.message);
        }
      });
  }

  async sendMessage(): Promise<void> {
    if (!this.messageInput.trim() || this.sendingMessage) {
      return;
    }

    const userText = this.messageInput.trim();
    this.messageInput = '';
    this.sendingMessage = true;

    if (!this.selectedChatId) {
      // Lazy creation of the chat
      const request: AiChatCreateRequest = {
        title: undefined,
        provider: this.providerSelection
      };

      this.aiChatService.createChat(request)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: async (created) => {
            this.chats = [created, ...this.chats];
            this.selectedChatId = created.id;
            this.selectedChat = created;
            this.sendingMessage = false; 
            await this.performSendMessage(userText);
            this.cdr.markForCheck();
          },
          error: (error: Error) => {
            this.sendingMessage = false;
            this.messageService.showError(error.message);
            this.cdr.markForCheck();
          }
        });
    } else {
      await this.performSendMessage(userText);
    }
  }

  private async performSendMessage(userText: string): Promise<void> {
    if (!this.selectedChatId) return;

    this.sendingMessage = true;
    this.streamingPreview = '';

    const optimisticUserMessage: AiChatMessageDto = {
      id: Date.now() * -1,
      role: 'USER' as AiMessageRole,
      content: userText,
      toolName: null,
      toolResult: null,
      inputTokens: 0,
      outputTokens: 0,
      createdAt: new Date().toISOString()
    };
    this.messages = [...this.messages, optimisticUserMessage];
    this.scrollToBottom('smooth', true);

    const request: AiChatMessageRequest = { content: userText, language: 'es' };

    await this.trySendStream(this.selectedChatId, request, 0);
  }

  private async trySendStream(chatId: number, request: AiChatMessageRequest, retry: number): Promise<void> {
    this.streamAbortController = new AbortController();

    this.aiChatService.sendChatMessageStream(chatId, request, this.streamAbortController.signal)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          // Ya no desactivamos sendingMessage aquí, sino en el final del stream real o error
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: async (stream) => {
          try {
            const response = await this.sseStreamService.parseStream(
              stream,
              token => {
                // Distribute token into character queue
                this.typingQueue.push(...token.split(''));
                if (!this.isTypingLoopRunning) {
                  this.runTypingLoop();
                }
              },
              (finalResponse: StreamingResponse) => {
                if (finalResponse.fullResponse.trim()) {
                  const assistantMessage: AiChatMessageDto = {
                    id: Date.now(),
                    role: 'ASSISTANT' as AiMessageRole,
                    content: finalResponse.fullResponse,
                    toolName: null,
                    toolCallId: null,
                    toolResult: null,
                    thinkingContent: finalResponse.thinkingContent,
                    toolCalls: finalResponse.toolCalls,
                    inputTokens: finalResponse.inputTokens,
                    outputTokens: finalResponse.outputTokens,
                    createdAt: new Date().toISOString()
                  };
                  this.messages = [...this.messages, assistantMessage];
                }
                
                this.sendingMessage = false; // Desbloqueamos el input al final real
                // Ensure everything is typed out before finishing
                this.streamingPreview = '';
                this.typingQueue = [];
                this.isTypingLoopRunning = false;
                
                this.streamingThinking = '';
                this.streamingToolCalls = [];
                this.updateSelectedChatMeta();
                this.scrollToBottom('smooth', true);
                this.cdr.markForCheck();
              },
              error => {
                throw new Error(error);
              },
              thinking => {
                this.streamingThinking += thinking;
                this.scrollToBottom(); // Bajamos el scroll mientras la IA razona
                this.cdr.markForCheck();
              },
              toolCall => {
                this.streamingToolCalls = [...this.streamingToolCalls, toolCall];
                this.cdr.markForCheck();
              },
              this.streamAbortController?.signal
            );
          } catch (error) {
            await this.handleStreamFailure(chatId, request, retry, error);
          }
        },
        error: async (error: Error) => {
          await this.handleStreamFailure(chatId, request, retry, error);
        }
      });
  }

  toggleReasoning(messageId: number): void {
    const wasExpanded = !!this.expandedReasoning[messageId];
    this.expandedReasoning[messageId] = !wasExpanded;
    
    // Al expandir/contraer, si el usuario está al final, forzamos un scroll suave
    // para que el crecimiento del bloque empuje lo anterior hacia arriba.
    this.scrollToBottom('smooth');
    
    this.cdr.markForCheck();
  }



  private runTypingLoop(): void {
    if (this.typingQueue.length === 0) {
      this.isTypingLoopRunning = false;
      return;
    }

    this.isTypingLoopRunning = true;
    
    // Adaptive speed: faster if queue is large
    const queueLength = this.typingQueue.length;
    let delay = 30;
    
    if (queueLength > 50) delay = 12;
    if (queueLength > 150) delay = 4;
    if (queueLength > 300) delay = 1;

    // Human-like pseudo-randomness (only for slower speeds)
    const randomJitter = delay > 5 ? (Math.random() * 10 - 5) : 0;
    const finalDelay = Math.max(1, delay + randomJitter);

    const nextChar = this.typingQueue.shift();
    if (nextChar !== undefined) {
      this.streamingPreview += nextChar;
      this.scrollToBottom();
      this.cdr.markForCheck();
    }

    setTimeout(() => this.runTypingLoop(), finalDelay);
  }

  private async handleStreamFailure(
    chatId: number,
    request: AiChatMessageRequest,
    retry: number,
    error: unknown
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const retryable = this.isRetryableError(message);

    if (retryable && retry < 1) {
      this.messageService.showWarning('Se perdió el stream. Reintentando una vez...');
      await this.trySendStream(chatId, request, retry + 1);
      return;
    }

    this.streamingPreview = '';
    this.sendingMessage = false; // Desbloqueamos en caso de error
    this.messageService.showError(`No se pudo completar la respuesta IA: ${message}`);
    this.cdr.markForCheck();
  }

  private isRetryableError(rawMessage: string): boolean {
    const message = (rawMessage || '').toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('429') ||
      message.includes('502') ||
      message.includes('network')
    );
  }

  cancelStreaming(): void {
    this.streamAbortController?.abort();
    this.streamAbortController = null;
    this.sendingMessage = false;
    this.streamingPreview = '';
    this.cdr.markForCheck();
  }

  openProviderModal(chat: AiChatDto): void {
    this.selectedChatId = chat.id;
    this.selectedChat = chat;
    this.providerSelection = chat.activeProvider;
    this.showProviderModal = true;
    this.cdr.markForCheck();
  }

  changeProvider(): void {
    if (!this.selectedChatId) {
      this.storageService.set('ai_last_provider', this.providerSelection, 'local');
      this.showProviderModal = false;
      this.cdr.markForCheck();
      return;
    }

    const request: AiChangeProviderRequest = { provider: this.providerSelection };

    this.aiChatService.changeProvider(this.selectedChatId, request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: updated => {
          this.storageService.set('ai_last_provider', this.providerSelection, 'local');
          this.showProviderModal = false;
          this.chats = this.chats.map(chat => chat.id === updated.id ? updated : chat);
          this.selectedChat = updated;
          this.messageService.showSuccess('Proveedor actualizado');
          this.cdr.markForCheck();
        },
        error: (error: Error) => {
          this.messageService.showError(error.message);
        }
      });
  }

  archiveSelectedChat(): void {
    if (!this.selectedChat) {
      return;
    }

    this.archiveChat(this.selectedChat);
  }

  archiveChat(chat: AiChatDto): void {
    this.messageService
      .confirm(
        'Archivar chat',
        `Se archivará el chat "${chat.title}". ¿Deseas continuar?`,
        'Archivar',
        'Cancelar'
      )
      .then(confirmed => {
        if (!confirmed) {
          return;
        }

        this.aiChatService.deleteChat(chat.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.messageService.showSuccess('Chat archivado');
              this.chats = this.chats.filter(item => item.id !== chat.id);
              if (this.selectedChatId === chat.id) {
                this.selectedChatId = null;
                this.selectedChat = null;
                this.messages = [];
              }
              this.cdr.markForCheck();
            },
            error: (error: Error) => {
              this.messageService.showError(error.message);
            }
          });
      });
  }

  openRenameModal(chat: AiChatDto): void {
    this.renameChatId = chat.id;
    this.renameTitle = chat.title || `Chat #${chat.id}`;
    this.showRenameModal = true;
    this.cdr.markForCheck();
  }

  renameChat(): void {
    const chatId = this.renameChatId;
    const title = this.renameTitle.trim();
    if (!chatId || !title) {
      return;
    }

    const request: AiChatUpdateRequest = { title };
    this.aiChatService.updateChat(chatId, request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: updated => {
          this.showRenameModal = false;
          this.renameChatId = null;
          this.renameTitle = '';
          this.chats = this.chats.map(chat => chat.id === updated.id ? updated : chat);
          if (this.selectedChatId === updated.id) {
            this.selectedChat = updated;
          }
          this.messageService.showSuccess('Chat actualizado');
          this.cdr.markForCheck();
        },
        error: (error: Error) => {
          this.messageService.showError(error.message);
        }
      });
  }

  onThreadScroll(event: Event): void {
    const node = event.target as HTMLDivElement;
    if (!node || node.scrollTop > 120) {
      return;
    }
    this.loadOlderMessages();
  }

  toggleHistoryDrawer(): void {
    this.showHistoryDrawer = !this.showHistoryDrawer;
    this.cdr.markForCheck();
  }

  closeHistoryDrawer(): void {
    if (this.showHistoryDrawer) {
      this.showHistoryDrawer = false;
      this.cdr.markForCheck();
    }
  }

  private loadOlderMessages(): void {
    if (!this.selectedChatId || this.loadingMessages || this.loadingOlderMessages || !this.hasOlderMessages) {
      return;
    }

    const scroller = this.chatScroller?.nativeElement;
    const previousHeight = scroller?.scrollHeight || 0;
    const previousTop = scroller?.scrollTop || 0;
    const nextPage = this.messagePage + 1;

    this.loadingOlderMessages = true;
    this.aiChatService.getChatMessagesPage(this.selectedChatId, nextPage, this.messagePageSize)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingOlderMessages = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: page => {
          const sortedBatch = [...(page.content || [])].sort((a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          const olderMessages = this.normalizeMessagesForUi(sortedBatch);
          const existingIds = new Set(this.messages.map(message => message.id));
          const uniqueOlderMessages = olderMessages.filter(message => !existingIds.has(message.id));

          this.messages = [...uniqueOlderMessages, ...this.messages];
          this.messagePage = page.number || nextPage;
          this.hasOlderMessages = !page.last;

          setTimeout(() => {
            if (!scroller) {
              return;
            }
            const nextHeight = scroller.scrollHeight;
            scroller.scrollTop = nextHeight - previousHeight + previousTop;
          }, 0);
        },
        error: (error: Error) => {
          this.messageService.showError(error.message);
        }
      });
  }

  onMessageKeyDown(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      event.preventDefault();
      void this.sendMessage();
    }
  }

  trackByChatId(_: number, chat: AiChatDto): number {
    return chat.id;
  }

  trackByMessageId(_: number, message: AiChatMessageDto): number {
    return message.id;
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatRole(role: string): string {
    const roleLabels: Record<string, string> = {
      'USER': this.authService.getName() || 'Usuario',
      'ASSISTANT': 'Chef Pio',
      'SYSTEM': 'Sistema',
      'TOOL': '🔧 Herramienta'
    };
    return roleLabels[role] || role;
  }

  parseMarkdown(content: string): SafeHtml {
    if (!content) {
      return this.sanitizer.bypassSecurityTrustHtml('');
    }

    const html = marked.parse(content) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private updateSelectedChatMeta(): void {
    if (!this.selectedChat) {
      return;
    }

    const nowIso = new Date().toISOString();
    const updated = {
      ...this.selectedChat,
      lastMessageAt: nowIso,
      messageCount: (this.selectedChat.messageCount || 0) + 2
    };

    this.selectedChat = updated;
    this.chats = this.chats.map(chat => chat.id === updated.id ? updated : chat);
  }

  private scrollToBottom(behavior: ScrollBehavior = 'auto', force = false): void {
    // Usamos requestAnimationFrame + setTimeout(0) para asegurar que el DOM se haya renderizado 
    // completamente y el scrollHeight sea el definitivo.
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (!this.chatScroller?.nativeElement) return;
        
        const node = this.chatScroller.nativeElement;
        
        // Lógica de Sticky Scroll: solo bajamos automáticamente si el usuario está cerca del final 
        // o si pedimos explícitamente un scroll forzado (ej: al cargar el chat o enviar mensaje).
        const threshold = this.sendingMessage ? 400 : 150; 
        const isNearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < threshold;

        if (force || behavior === 'smooth' || isNearBottom) {
          node.scrollTo({
            top: node.scrollHeight,
            behavior: behavior
          });
        }
      }, 0);
    });
  }

  private normalizeMessagesForUi(messages: AiChatMessageDto[]): AiChatMessageDto[] {
    const normalized: AiChatMessageDto[] = [];

    for (const message of messages) {
      if (message.role === 'TOOL') {
        const toolCall: ToolCall = {
          toolName: message.toolName || 'tool',
          toolCallId: message.toolCallId || undefined,
          toolResult: message.toolResult || message.content || undefined
        };

        for (let index = normalized.length - 1; index >= 0; index -= 1) {
          if (normalized[index].role === 'ASSISTANT') {
            const assistantMessage = normalized[index];
            assistantMessage.toolCalls = [...(assistantMessage.toolCalls || []), toolCall];
            break;
          }
        }
        continue;
      }

      normalized.push({
        ...message,
        toolCalls: message.toolCalls ? [...message.toolCalls] : []
      });
    }

    return normalized;
  }
}
