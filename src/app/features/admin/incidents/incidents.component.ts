import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, forkJoin, finalize, takeUntil } from 'rxjs';
import { Client, IMessage, ReconnectionTimeMode, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthService } from '../../../core/services/auth.service';
import { IncidentService } from '../../../core/services/incident.service';
import { MessageService } from '../../../core/services/message.service';
import { UserService } from '../../../core/services/user.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SyncCacheInvalidationService } from '../../../core/services/sync-cache-invalidation.service';
import { BaseModalComponent } from '../../../shared/components/base-modal/base-modal.component';
import {
  AttachAuditRequest,
  IncidentChatReadReceipt,
  CloseIncidentRequest,
  CreateIncidentRequest,
  IncidentAuditAttachment,
  IncidentChatMessage,
  IncidentChatTypingResponse,
  IncidentDetail,
  IncidentFilters,
  IncidentListItem,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  IncidentTypeRequest,
  OpenIncidentRequest,
  RecipeCookingAudit,
  RevertAuditFromIncidentRequest,
  INCIDENT_SEVERITY_OPTIONS,
  INCIDENT_STATUS_OPTIONS,
  incidentTypeIsActive,
  isIncidentClosed
} from '../../../shared/models/incident.model';
import { Page } from '../../../shared/models/page.model';
import { User } from '../../../shared/models/user.model';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { SEARCH_DEBOUNCE_MS } from '../../../core/constants/search.constants';
import { LoggerService } from '../../../core/services/logger.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

type IncidentTab = 'incidents' | 'types';
type DetailTab = 'summary' | 'chat' | 'audits';

interface IncidentFormState {
  incidentTypeId: number | '';
  title: string;
  description: string;
}

interface TypeFormState {
  name: string;
  description: string;
}

@Component({
  selector: 'app-incidents',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseModalComponent, TranslateModule],
  templateUrl: './incidents.component.html',
  styleUrl: './incidents.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IncidentsComponent implements OnInit, OnDestroy, AfterViewInit {
  private logger = inject(LoggerService);
  private readonly authService = inject(AuthService);
  private readonly incidentService = inject(IncidentService);
  private readonly userService = inject(UserService);
  private readonly messageService = inject(MessageService);
  private readonly notificationService = inject(NotificationService);
  private readonly syncCacheInvalidationService = inject(SyncCacheInvalidationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();
  private chatRealtimeClient?: Client;
  private chatRealtimeConnected = false;
  private readonly chatRealtimeSubscriptions: StompSubscription[] = [];
  private subscribedIncidentId: number | null = null;
  private pendingIncidentSubscriptionId: number | null = null;
  private typingStopTimeout: number | null = null;
  private typingLocallyActive = false;
  private readonly remoteTypingTimeoutByUser = new Map<number, number>();
  private readonly remoteTypingUsersMap = new Map<number, IncidentChatTypingResponse>();
  private readonly remoteTypingVisibilityMs = 3200;
  private readonly typingDebounceMs = 2400;
  private readonly readReceiptDebounceMs = 120;
  private markReadTimeout: number | null = null;
  private readonly currentUserId = this.authService.getUserId();
  private pendingScrollToMessageId: number | null = null;
  @ViewChildren('chatMessageItem') private chatMessageItems!: QueryList<ElementRef<HTMLElement>>;
  readonly statusOptions = INCIDENT_STATUS_OPTIONS;
  readonly severityOptions = INCIDENT_SEVERITY_OPTIONS;

  readonly canCreateIncidents = ['ADMIN', 'CHEF', 'ELEVATED'].includes(this.authService.getRole() || '');
  readonly isAdminUser = this.authService.getRole() === 'ADMIN';
  readonly isAdminArea = this.router.url.startsWith('/admin-panel');

  activeTab: IncidentTab = 'incidents';
  detailTab: DetailTab = 'summary';

  incidentsPage: Page<IncidentListItem> | null = null;
  incidents: IncidentListItem[] = [];
  visibleIncidents: IncidentListItem[] = [];
  loadingIncidents = false;
  incidentSearch = '';
  showFilters = false;
  incidentFilters: IncidentFilters = {
    status: '',
    severity: '',
    incidentTypeId: '',
    createdById: '',
    from: '',
    to: '',
    page: 0,
    size: 12,
    sort: ['createdAt,desc']
  };

  incidentTypes: IncidentType[] = [];
  loadingTypes = false;

  get activeIncidentTypes(): IncidentType[] {
    return this.incidentTypes.filter(type => this.incidentTypeActive(type));
  }

  users: User[] = [];

  showCreateModal = false;
  creatingIncident = false;
  incidentForm: IncidentFormState = {
    incidentTypeId: '',
    title: '',
    description: ''
  };

  showTypeModal = false;
  savingType = false;
  editingType: IncidentType | null = null;
  typeForm: TypeFormState = {
    name: '',
    description: ''
  };

  showIncidentDetailModal = false;
  loadingIncidentDetail = false;
  selectedIncident: IncidentDetail | null = null;
  selectedIncidentId: number | null = null;
  selectedIncidentAttachments: IncidentAuditAttachment[] = [];
  chatMessages: IncidentChatMessage[] = [];
  chatImagePreviews = new Map<number, string>();
  loadingChatImageIds = new Set<number>();
  zoomImageUrl: string | null = null;
  zoomImageAlt = '';
  loadingChat = false;
  sendingChat = false;
  compressingChatFile = false;
  chatContent = '';
  chatFile: File | null = null;
  chatFilePreviewUrl: string | null = null;
  latestChatMessageId: number | null = null;
  typingUsers: IncidentChatTypingResponse[] = [];
  private newMessageHighlightTimeout: number | null = null;

  showOpenModal = false;
  openingIncident = false;
  openSeverity: IncidentSeverity = 'MEDIA';

  showCloseModal = false;
  closingIncident = false;
  closeHasResolution = true;
  closeResolution = '';

  showAttachModal = false;
  loadingAttachableAudits = false;
  attachableAudits: RecipeCookingAudit[] = [];
  selectedAttachAuditIds = new Set<number>();
  attachingAudits = false;

  showRevertModal = false;
  revertingAudit = false;
  auditToRevert: IncidentAuditAttachment | null = null;
  revertReason = '';

  ngOnInit(): void {
    this.activeTab = 'incidents';
    this.showFilters = false;
    this.loadUsers();
    this.loadIncidentTypes();
    this.loadIncidents();

    this.notificationService.incoming$
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntil(this.destroy$))
      .subscribe(() => {
        this.refreshFromRealtimeEvent();
      });

    this.syncCacheInvalidationService.invalidatedDomains$
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntil(this.destroy$))
      .subscribe(({ domains }) => {
        const hasIncidentImpact = domains.includes('incident');
        const hasBatchImpact = domains.includes('batch') || domains.includes('product');

        if (!hasIncidentImpact && !hasBatchImpact) {
          return;
        }

        this.refreshFromRealtimeEvent();
      });
  }

  ngAfterViewInit(): void {
    this.chatMessageItems.changes
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.scrollToPendingMessageIfNeeded();
      });
  }

  ngOnDestroy(): void {
    this.emitTypingState(false);
    this.clearTypingStopTimeout();
    this.clearMarkReadTimeout();
    this.clearRemoteTypingUsers();
    this.unsubscribeIncidentRealtimeTopics();
    this.disconnectChatRealtime();
    if (this.newMessageHighlightTimeout !== null) {
      window.clearTimeout(this.newMessageHighlightTimeout);
    }
    this.revokeChatImagePreviews();
    this.destroy$.next();
    this.destroy$.complete();
  }

  switchTab(tab: IncidentTab): void {
    this.activeTab = tab;
    if (tab === 'types') {
      this.showFilters = false;
    }
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  loadIncidents(resetPage = false): void {
    if (resetPage) {
      this.incidentFilters.page = 0;
    }

    this.loadingIncidents = true;
    const filters: IncidentFilters = {
      ...this.incidentFilters,
      page: this.incidentFilters.page || 0,
      size: this.incidentFilters.size || 12,
      sort: this.incidentFilters.sort || ['createdAt,desc']
    };

    if (this.incidentSearch.trim()) {
      filters.from = filters.from || undefined;
    }

    this.incidentService.getIncidents(filters).pipe(
      finalize(() => {
        this.loadingIncidents = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: page => {
        this.incidentsPage = page;
        this.incidents = page.content || [];
        this.visibleIncidents = this.filterVisibleIncidents();
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError(this.translate.instant('INCIDENTS.MESSAGES.LOAD_ERROR') || 'No se pudieron cargar las incidencias');
      }
    });
  }

  onIncidentFilterChange(): void {
    this.visibleIncidents = this.filterVisibleIncidents();
    this.loadIncidents(true);
  }

  clearIncidentFilters(): void {
    this.incidentSearch = '';
    this.incidentFilters = {
      status: '',
      severity: '',
      incidentTypeId: '',
      createdById: '',
      from: '',
      to: '',
      page: 0,
      size: 12,
      sort: ['createdAt,desc']
    };
    this.loadIncidents();
  }

  applyIncidentSearch(): void {
    this.visibleIncidents = this.filterVisibleIncidents();
  }

  hasIncidentFilters(): boolean {
    return Boolean(
      this.incidentSearch.trim() ||
      this.incidentFilters.status ||
      this.incidentFilters.severity ||
      this.incidentFilters.incidentTypeId ||
      this.incidentFilters.createdById ||
      this.incidentFilters.from ||
      this.incidentFilters.to
    );
  }

  countPendingIncidents(): number {
    return this.incidents.filter(item => item.status === 'CREADO' || item.status === 'ABIERTO').length;
  }

  countClosedIncidents(): number {
    return this.incidents.filter(item => item.status === 'CERRADO_CON_RESOLUCION' || item.status === 'CERRADO_SIN_RESOLUCION').length;
  }

  countChatMessages(): number {
    return this.incidents.reduce((sum, item) => sum + (item.chatMessageCount || 0), 0);
  }

  prevPage(): void {
    if (!this.incidentsPage || this.incidentsPage.first) return;
    this.incidentFilters.page = Math.max((this.incidentFilters.page || 0) - 1, 0);
    this.loadIncidents();
  }

  nextPage(): void {
    if (!this.incidentsPage || this.incidentsPage.last) return;
    this.incidentFilters.page = (this.incidentFilters.page || 0) + 1;
    this.loadIncidents();
  }

  openCreateIncident(): void {
    this.incidentForm = {
      incidentTypeId: this.activeIncidentTypes[0]?.id ?? '',
      title: '',
      description: ''
    };
    this.showCreateModal = true;
  }

  saveIncident(): void {
    if (!this.incidentForm.incidentTypeId || !this.incidentForm.title.trim() || !this.incidentForm.description.trim()) {
      this.messageService.showWarning(this.translate.instant('INCIDENTS.MESSAGES.WARNING_COMPLETE_FORM') || 'Completa el tipo, título y descripción');
      return;
    }

    this.creatingIncident = true;
    const request: CreateIncidentRequest = {
      incidentTypeId: Number(this.incidentForm.incidentTypeId),
      title: this.incidentForm.title.trim(),
      description: this.incidentForm.description.trim()
    };

    this.incidentService.createIncident(request).pipe(
      finalize(() => {
        this.creatingIncident = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: incident => {
        this.messageService.showSuccess(this.translate.instant('INCIDENTS.MESSAGES.CREATE_SUCCESS') || 'Incidencia creada');
        this.showCreateModal = false;
        this.loadIncidents();
        this.openIncidentDetail(incident.id);
      },
      error: () => this.messageService.showError(this.translate.instant('INCIDENTS.MESSAGES.CREATE_ERROR') || 'No se pudo crear la incidencia')
    });
  }

  openIncidentDetail(id: number): void {
    this.selectedIncidentId = id;
    this.showIncidentDetailModal = true;
    this.detailTab = 'summary';
    this.latestChatMessageId = null;
    this.clearRemoteTypingUsers();
    this.clearTypingStopTimeout();
    this.typingLocallyActive = false;
    this.ensureChatRealtimeConnected();
    this.subscribeIncidentRealtimeTopics(id);
    this.loadIncidentDetail(id);
  }

  loadIncidentDetail(id: number): void {
    this.loadingIncidentDetail = true;
    this.loadingChat = true;

    const detail$ = this.incidentService.getIncident(id);
    const chat$ = this.incidentService.getChatHistory(id, 0, 50);
    const audits$ = this.canAttachAudits() ? this.incidentService.getAttachableAudits(id) : null;

    const request$ = audits$
      ? forkJoin({ detail: detail$, chat: chat$, audits: audits$ })
      : forkJoin({ detail: detail$, chat: chat$ });

    request$.pipe(
      finalize(() => {
        this.loadingIncidentDetail = false;
        this.loadingChat = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: payload => {
        this.selectedIncident = payload.detail;
        this.chatMessages = payload.chat.content || [];
        this.prefetchChatImagePreviews(this.chatMessages);
        this.scheduleMarkChatAsRead();
        this.selectedIncidentAttachments = payload.detail.attachedAudits || [];
        if ('audits' in payload) {
          const payloadWithAudits = payload as { audits: RecipeCookingAudit[] };
          this.attachableAudits = payloadWithAudits.audits || [];
          this.selectedAttachAuditIds = new Set();
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError(this.translate.instant('INCIDENTS.MESSAGES.DETAIL_ERROR') || 'No se pudo cargar el detalle de la incidencia');
      }
    });
  }

  refreshSelectedIncident(): void {
    if (!this.selectedIncidentId) return;
    this.loadIncidentDetail(this.selectedIncidentId);
    this.loadIncidents();
  }

  private refreshFromRealtimeEvent(): void {
    this.loadIncidents();

    if (this.canManageTypes()) {
      this.loadIncidentTypes();
    }

    if (this.selectedIncidentId) {
      this.loadIncidentDetail(this.selectedIncidentId);

      if (this.showAttachModal) {
        this.loadAttachableAudits();
      }
    }
  }

  closeIncidentDetail(): void {
    this.emitTypingState(false);
    this.clearTypingStopTimeout();
    this.clearRemoteTypingUsers();
    this.unsubscribeIncidentRealtimeTopics();
    this.revokeChatImagePreviews();
    this.closeImageZoom();
    this.showIncidentDetailModal = false;
    this.selectedIncident = null;
    this.selectedIncidentId = null;
    this.chatMessages = [];
    this.chatContent = '';
    this.chatFile = null;
    this.chatFilePreviewUrl = null;
    this.attachableAudits = [];
    this.selectedAttachAuditIds = new Set();
  }

  setDetailTab(tab: DetailTab): void {
    this.detailTab = tab;
    if (tab === 'chat') {
      this.scheduleMarkChatAsRead();
    } else {
      this.emitTypingState(false);
      this.clearRemoteTypingUsers();
    }
  }

  openOpenModal(): void {
    this.openSeverity = this.selectedIncident?.severity || 'MEDIA';
    this.showOpenModal = true;
  }

  confirmOpenIncident(): void {
    if (!this.selectedIncidentId) return;

    this.openingIncident = true;
    const request: OpenIncidentRequest = { severity: this.openSeverity };
    this.incidentService.openIncident(this.selectedIncidentId, request).pipe(
      finalize(() => {
        this.openingIncident = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: incident => {
        this.messageService.showSuccess(this.translate.instant('INCIDENTS.MESSAGES.OPEN_SUCCESS') || 'Incidencia abierta');
        this.showOpenModal = false;
        this.selectedIncident = incident;
        this.refreshSelectedIncident();
      },
      error: () => this.messageService.showError(this.translate.instant('INCIDENTS.MESSAGES.OPEN_ERROR') || 'No se pudo abrir la incidencia')
    });
  }

  openCloseModal(): void {
    this.closeHasResolution = true;
    this.closeResolution = this.selectedIncident?.resolution || '';
    this.showCloseModal = true;
  }

  confirmCloseIncident(): void {
    if (!this.selectedIncidentId) return;

    const request: CloseIncidentRequest = {
      hasResolution: this.closeHasResolution,
      resolution: this.closeHasResolution ? this.closeResolution.trim() : null
    };

    this.closingIncident = true;
    this.incidentService.closeIncident(this.selectedIncidentId, request).pipe(
      finalize(() => {
        this.closingIncident = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: incident => {
        this.messageService.showSuccess(this.translate.instant('INCIDENTS.MESSAGES.CLOSE_SUCCESS') || 'Incidencia cerrada');
        this.showCloseModal = false;
        this.selectedIncident = incident;
        this.refreshSelectedIncident();
      },
      error: () => this.messageService.showError(this.translate.instant('INCIDENTS.MESSAGES.CLOSE_ERROR') || 'No se pudo cerrar la incidencia')
    });
  }

  async onChatFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const selectedFile = input.files?.[0] ?? null;

    if (!selectedFile) {
      this.chatFile = null;
      this.chatFilePreviewUrl = null;
      this.cdr.markForCheck();
      return;
    }

    if (!selectedFile.type.startsWith('image/')) {
      this.chatFile = selectedFile;
      this.createChatFilePreview();
      this.cdr.markForCheck();
      return;
    }

    this.compressingChatFile = true;
    this.cdr.markForCheck();

    try {
      this.chatFile = await this.compressChatImage(selectedFile);
      this.createChatFilePreview();
    } catch {
      this.chatFile = selectedFile;
      this.createChatFilePreview();
      this.messageService.showWarning(this.translate.instant('INCIDENTS.MESSAGES.WARNING_OPTIMIZE') || 'No se pudo optimizar la imagen. Se enviara el archivo original.');
    } finally {
      this.compressingChatFile = false;
      this.cdr.markForCheck();
    }
  }

  private createChatFilePreview(): void {
    if (!this.chatFile) {
      this.chatFilePreviewUrl = null;
      return;
    }

    if (this.isChatFileImage()) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.chatFilePreviewUrl = e.target?.result as string || null;
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(this.chatFile);
    } else {
      this.chatFilePreviewUrl = null;
    }
  }

  private isChatFileImage(): boolean {
    if (!this.chatFile) return false;
    return this.chatFile.type.startsWith('image/');
  }

  private async compressChatImage(file: File): Promise<File> {
    if (!this.shouldCompressImage(file)) {
      return file;
    }

    const imageBitmap = await createImageBitmap(file);

    try {
      const maxDimension = 1920;
      const { width, height } = this.scaledImageDimensions(imageBitmap.width, imageBitmap.height, maxDimension);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      if (!context) {
        return file;
      }

      context.drawImage(imageBitmap, 0, 0, width, height);

      const targetType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const quality = targetType === 'image/png' ? undefined : 0.8;
      const compressedBlob = await this.canvasToBlob(canvas, targetType, quality);
      if (!compressedBlob || compressedBlob.size >= file.size) {
        return file;
      }

      const safeFileName = this.renameFileExtension(file.name, targetType);
      return new File([compressedBlob], safeFileName, {
        type: compressedBlob.type,
        lastModified: Date.now()
      });
    } finally {
      imageBitmap.close();
    }
  }

  private shouldCompressImage(file: File): boolean {
    return file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp';
  }

  private scaledImageDimensions(width: number, height: number, maxDimension: number): { width: number; height: number } {
    if (width <= maxDimension && height <= maxDimension) {
      return { width, height };
    }

    const scale = Math.min(maxDimension / width, maxDimension / height);
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale))
    };
  }

  private canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), type, quality);
    });
  }

  private renameFileExtension(fileName: string, mimeType: string): string {
    const extension = mimeType === 'image/png' ? 'png' : 'jpg';
    const baseName = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
    return `${baseName}.${extension}`;
  }

  removeChatFile(): void {
    this.chatFile = null;
    this.chatFilePreviewUrl = null;
    this.cdr.markForCheck();
  }

  onChatInputChanged(value: string): void {
    if (this.detailTab !== 'chat' || !this.selectedIncidentId) {
      return;
    }

    if (!value || !value.trim()) {
      this.emitTypingState(false);
      return;
    }

    this.emitTypingState(true);
    this.scheduleTypingStop();
  }

  onChatInputBlur(): void {
    this.emitTypingState(false);
  }

  sendChatMessage(): void {
    if (!this.selectedIncidentId) return;

    const hasText = this.chatContent.trim().length > 0;
    const hasFile = !!this.chatFile;
    if (!hasText && !hasFile) {
      this.messageService.showWarning(this.translate.instant('INCIDENTS.MESSAGES.WARNING_MESSAGE_EMPTY') || 'Escribe un mensaje o adjunta un archivo');
      return;
    }

    if (this.compressingChatFile) {
      this.messageService.showInfo(this.translate.instant('INCIDENTS.MESSAGES.WARNING_WAIT_OPTIMIZE') || 'Espera a que termine la compresion de la imagen');
      return;
    }

    this.emitTypingState(false);

    this.sendingChat = true;
    this.incidentService.sendChatMessage(this.selectedIncidentId, this.chatContent, this.chatFile).pipe(
      finalize(() => {
        this.sendingChat = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: message => {
        this.upsertChatMessage(message);
        this.queueScrollToMessage(message.id);
        this.highlightIncomingMessage(message.id);
        this.ensureChatImagePreview(message);
        this.chatContent = '';
        this.chatFile = null;
        this.chatFilePreviewUrl = null;
        this.markChatAsRead();
        this.messageService.showSuccess(this.translate.instant('INCIDENTS.MESSAGES.SENT_SUCCESS') || 'Mensaje enviado');
        this.refreshSelectedIncident();
      },
      error: () => this.messageService.showError(this.translate.instant('INCIDENTS.MESSAGES.SENT_ERROR') || 'No se pudo enviar el mensaje')
    });
  }

  onChatKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      if (event.ctrlKey || event.metaKey) {
        // Ctrl+Enter: nueva línea
        return;
      }
      // Enter a secas: enviar (móvil y escritorio)
      event.preventDefault();
      this.sendChatMessage();
    }
  }

  typingIndicatorText(): string {
    if (this.typingUsers.length === 0) {
      return '';
    }

    if (this.typingUsers.length === 1) {
      return this.translate.instant('INCIDENTS.MESSAGES.TYPING', { name: this.typingUsers[0].userName }) || `${this.typingUsers[0].userName} esta escribiendo...`;
    }

    const first = this.typingUsers[0].userName;
    const extra = this.typingUsers.length - 1;
    return this.translate.instant('INCIDENTS.MESSAGES.TYPING_MULTIPLE', { name: first, count: extra }) || `${first} y ${extra} mas estan escribiendo...`;
  }

  isOwnChatMessage(message: IncidentChatMessage): boolean {
    return !!this.currentUserId && message.authorId === this.currentUserId;
  }

  messageReadByOthers(message: IncidentChatMessage): IncidentChatReadReceipt[] {
    const readers = message.readBy || [];
    return readers.filter(reader => reader.userId !== message.authorId);
  }

  isMessageReadByOthers(message: IncidentChatMessage): boolean {
    return this.messageReadByOthers(message).length > 0;
  }

  messageReadByLabel(message: IncidentChatMessage): string {
    const readers = this.messageReadByOthers(message);
    if (readers.length === 0) {
      return this.translate.instant('INCIDENTS.MESSAGES.NOT_READ') || 'Aun no leido por otros participantes';
    }

    const names = readers.map(reader => reader.userName).filter(Boolean).join(', ');
    return this.translate.instant('INCIDENTS.MESSAGES.READ_BY', { names }) || `Leido por: ${names}`;
  }

  downloadAttachment(message: IncidentChatMessage): void {
    if (!this.selectedIncidentId) return;
    this.incidentService.downloadChatAttachment(this.selectedIncidentId, message.id).subscribe({
      next: blob => this.downloadBlob(blob, message.attachmentFilename || 'adjunto'),
      error: () => this.messageService.showError(this.translate.instant('INCIDENTS.MESSAGES.DOWNLOAD_ERROR') || 'No se pudo descargar el adjunto')
    });
  }

  isImageAttachment(message: IncidentChatMessage): boolean {
    const contentType = message.attachmentContentType?.toLowerCase() || '';
    if (contentType.startsWith('image/')) {
      return true;
    }

    const filename = message.attachmentFilename?.toLowerCase() || '';
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(filename);
  }

  getChatImagePreviewUrl(messageId: number): string | null {
    return this.chatImagePreviews.get(messageId) || null;
  }

  isChatImageLoading(messageId: number): boolean {
    return this.loadingChatImageIds.has(messageId);
  }

  openImageZoom(imageUrl: string, alt: string): void {
    this.zoomImageUrl = imageUrl;
    this.zoomImageAlt = alt;
    this.cdr.markForCheck();
  }

  closeImageZoom(): void {
    this.zoomImageUrl = null;
    this.zoomImageAlt = '';
    this.cdr.markForCheck();
  }

  private prefetchChatImagePreviews(messages: IncidentChatMessage[]): void {
    messages.forEach(message => this.ensureChatImagePreview(message));
  }

  private ensureChatImagePreview(message: IncidentChatMessage): void {
    if (!this.isImageAttachment(message)) return;
    if (this.chatImagePreviews.has(message.id) || this.loadingChatImageIds.has(message.id)) return;
    if (!this.selectedIncidentId) return;

    this.loadingChatImageIds.add(message.id);
    this.incidentService.downloadChatAttachment(this.selectedIncidentId, message.id).subscribe({
      next: blob => {
        if (!blob.type.startsWith('image/')) {
          this.loadingChatImageIds.delete(message.id);
          this.cdr.markForCheck();
          return;
        }

        const previewUrl = window.URL.createObjectURL(blob);
        this.chatImagePreviews.set(message.id, previewUrl);
        this.loadingChatImageIds.delete(message.id);
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingChatImageIds.delete(message.id);
        this.cdr.markForCheck();
      }
    });
  }

  private revokeChatImagePreviews(): void {
    this.chatImagePreviews.forEach(url => window.URL.revokeObjectURL(url));
    this.chatImagePreviews.clear();
    this.loadingChatImageIds.clear();
  }

  private highlightIncomingMessage(messageId: number): void {
    this.latestChatMessageId = messageId;
    if (this.newMessageHighlightTimeout !== null) {
      window.clearTimeout(this.newMessageHighlightTimeout);
    }

    this.newMessageHighlightTimeout = window.setTimeout(() => {
      this.latestChatMessageId = null;
      this.newMessageHighlightTimeout = null;
      this.cdr.markForCheck();
    }, 1800);
  }

  async exportPdf(): Promise<void> {
    if (!this.selectedIncidentId) return;

    const confirmed = await this.messageService.confirm(
      this.translate.instant('COMMON.CONFIRM_DOWNLOAD'),
      this.translate.instant('COMMON.CONFIRM_DOWNLOAD_PDF')
    );
    if (!confirmed) return;

    this.incidentService.exportPdf(this.selectedIncidentId).subscribe({
      next: blob => {
        this.downloadBlob(blob, `incidencia-${this.selectedIncidentId}.pdf`);
        this.messageService.showSuccess(this.translate.instant('INCIDENTS.MESSAGES.PDF_SUCCESS') || 'PDF descargado correctamente');
      },
      error: () => this.messageService.showError(this.translate.instant('INCIDENTS.MESSAGES.PDF_ERROR') || 'Error al generar el PDF')
    });
  }

  canManageTypes(): boolean {
    return this.isAdminUser;
  }

  canAttachAudits(): boolean {
    return ['ADMIN', 'CHEF', 'ELEVATED'].includes(this.authService.getRole() || '');
  }

  loadIncidentTypes(): void {
    this.loadingTypes = true;
    const load$ = this.canManageTypes()
      ? this.incidentService.getAllIncidentTypes()
      : this.incidentService.getIncidentTypes();

    load$.pipe(
      finalize(() => {
        this.loadingTypes = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: types => {
        this.incidentTypes = types || [];
        this.cdr.markForCheck();
      },
      error: () => this.messageService.showError(this.translate.instant('INCIDENTS.MESSAGES.TYPES_LOAD_ERROR') || 'No se pudieron cargar los tipos de incidencia')
    });
  }

  openTypeModal(type?: IncidentType): void {
    this.editingType = type || null;
    this.typeForm = {
      name: type?.name || '',
      description: type?.description || ''
    };
    this.showTypeModal = true;
  }

  saveType(): void {
    if (!this.typeForm.name.trim()) {
      this.messageService.showWarning(this.translate.instant('INCIDENTS.MESSAGES.WARNING_NAME') || 'Indica un nombre para el tipo');
      return;
    }

    this.savingType = true;
    const request: IncidentTypeRequest = {
      name: this.typeForm.name.trim(),
      description: this.typeForm.description.trim() || null
    };

    const operation = this.editingType
      ? this.incidentService.updateIncidentType(this.editingType.id, request)
      : this.incidentService.createIncidentType(request);

    operation.pipe(
      finalize(() => {
        this.savingType = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.messageService.showSuccess(this.editingType ? (this.translate.instant('INCIDENTS.MESSAGES.TYPE_UPDATE_SUCCESS') || 'Tipo actualizado') : (this.translate.instant('INCIDENTS.MESSAGES.TYPE_CREATE_SUCCESS') || 'Tipo creado'));
        this.showTypeModal = false;
        this.loadIncidentTypes();
      },
      error: () => this.messageService.showError(this.translate.instant('INCIDENTS.MESSAGES.TYPE_SAVE_ERROR') || 'No se pudo guardar el tipo')
    });
  }

  async toggleType(type: IncidentType): Promise<void> {
    const currentlyActive = this.incidentTypeActive(type);
    const action = currentlyActive ? 'desactivar' : 'activar';

    const confirmed = await this.messageService.confirm(
      this.translate.instant(currentlyActive ? 'INCIDENTS.ACTIONS.DEACTIVATE_TYPE' : 'INCIDENTS.ACTIONS.ACTIVATE_TYPE', { name: type.name }) || `${currentlyActive ? 'Desactivar' : 'Activar'} tipo`,
      this.translate.instant('INCIDENTS.MESSAGES.TYPE_TOGGLE_CONFIRM', { action, name: type.name }) || `¿Deseas ${action} el tipo "${type.name}"?`
    );

    if (!confirmed) return;

    this.incidentService.toggleIncidentType(type.id).subscribe({
      next: (updatedType) => {
        const index = this.incidentTypes.findIndex(item => item.id === type.id);
        if (index >= 0) {
          this.incidentTypes[index] = updatedType ?? {
            ...this.incidentTypes[index],
            isActive: !currentlyActive,
            active: !currentlyActive
          };
          this.incidentTypes = [...this.incidentTypes];
        }

        this.messageService.showSuccess(this.translate.instant(currentlyActive ? 'INCIDENTS.MESSAGES.TYPE_DEACTIVATED' : 'INCIDENTS.MESSAGES.TYPE_ACTIVATED') || (currentlyActive ? 'Tipo desactivado' : 'Tipo activado'));
        this.cdr.markForCheck();
      },
      error: () => this.messageService.showError(this.translate.instant('INCIDENTS.MESSAGES.TYPE_TOGGLE_ERROR') || 'No se pudo cambiar el estado del tipo')
    });
  }

  openAttachModal(): void {
    if (!this.selectedIncidentId) return;
    this.showAttachModal = true;
    this.selectedAttachAuditIds = new Set();
    this.loadAttachableAudits();
  }

  loadAttachableAudits(): void {
    if (!this.selectedIncidentId) return;
    this.loadingAttachableAudits = true;
    this.incidentService.getAttachableAudits(this.selectedIncidentId).pipe(
      finalize(() => {
        this.loadingAttachableAudits = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: audits => {
        this.attachableAudits = audits || [];
        this.cdr.markForCheck();
      },
      error: () => this.messageService.showError(this.translate.instant('INCIDENTS.MESSAGES.LOADING_ATTACHABLE_ERROR') || 'No se pudieron cargar las auditorías adjuntables')
    });
  }

  toggleAttachAuditSelection(auditId: number): void {
    if (this.selectedAttachAuditIds.has(auditId)) {
      this.selectedAttachAuditIds.delete(auditId);
    } else {
      this.selectedAttachAuditIds.add(auditId);
    }
    this.selectedAttachAuditIds = new Set(this.selectedAttachAuditIds);
  }

  attachAudits(): void {
    if (!this.selectedIncidentId || this.selectedAttachAuditIds.size === 0) {
      this.messageService.showWarning(this.translate.instant('INCIDENTS.MESSAGES.WARNING_SELECT_AUDIT') || 'Selecciona al menos una auditoría');
      return;
    }

    const request: AttachAuditRequest = { cookingAuditIds: [...this.selectedAttachAuditIds] };
    this.attachingAudits = true;
    this.incidentService.attachAudits(this.selectedIncidentId, request).pipe(
      finalize(() => {
        this.attachingAudits = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.messageService.showSuccess(this.translate.instant('INCIDENTS.MESSAGES.ATTACH_SUCCESS') || 'Auditorías adjuntadas');
        this.showAttachModal = false;
        this.refreshSelectedIncident();
      },
      error: () => this.messageService.showError(this.translate.instant('INCIDENTS.MESSAGES.ATTACH_ERROR') || 'No se pudieron adjuntar las auditorías')
    });
  }

  openRevertModal(attachment: IncidentAuditAttachment): void {
    this.auditToRevert = attachment;
    this.revertReason = '';
    this.showRevertModal = true;
  }

  confirmRevertAttachment(): void {
    if (!this.selectedIncidentId || !this.auditToRevert) return;

    const request: RevertAuditFromIncidentRequest = {
      auditAttachmentId: this.auditToRevert.id,
      reason: this.revertReason.trim()
    };

    if (!request.reason) {
      this.messageService.showWarning(this.translate.instant('INCIDENTS.MESSAGES.WARNING_REASON') || 'Indica un motivo para la reversión');
      return;
    }

    this.revertingAudit = true;
    this.incidentService.revertAudit(this.selectedIncidentId, this.auditToRevert.id, request).pipe(
      finalize(() => {
        this.revertingAudit = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.messageService.showSuccess(this.translate.instant('INCIDENTS.MESSAGES.REVERT_SUCCESS') || 'Auditoría revertida');
        this.showRevertModal = false;
        this.refreshSelectedIncident();
      },
      error: () => this.messageService.showError(this.translate.instant('INCIDENTS.MESSAGES.REVERT_ERROR') || 'No se pudo revertir la auditoría')
    });
  }

  loadUsers(): void {
    if (this.isAdminUser) {
      this.userService.search('', 0, 50).subscribe({
        next: page => {
          this.users = page.content || [];
          this.cdr.markForCheck();
        },
        error: () => { }
      });
      return;
    }

    this.userService.getTeachers().subscribe({
      next: users => {
        this.users = users || [];
        this.cdr.markForCheck();
      },
      error: () => { }
    });
  }


  formatDate(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString(this.translate.currentLang || [], {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatFullDate(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString(this.translate.currentLang || [], {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatStatus(status: IncidentStatus | string | null | undefined): string {
    switch (status) {
      case 'CREADO': return this.translate.instant('INCIDENTS.STATUS.CREADO') || 'Creada';
      case 'ABIERTO': return this.translate.instant('INCIDENTS.STATUS.ABIERTO') || 'Abierta';
      case 'CERRADO_CON_RESOLUCION':
      case 'CERRADO_SIN_RESOLUCION': return this.translate.instant('INCIDENTS.STATUS.CERRADO') || 'Cerrada';
      default: return '-';
    }
  }

  formatSeverity(severity?: IncidentSeverity | null): string {
    switch (severity) {
      case 'ALTA': return this.translate.instant('INCIDENTS.SEVERITY.HIGH') || 'Alta';
      case 'MEDIA': return this.translate.instant('INCIDENTS.SEVERITY.MEDIUM') || 'Media';
      case 'BAJA': return this.translate.instant('INCIDENTS.SEVERITY.LOW') || 'Baja';
      default: return this.translate.instant('INCIDENTS.SEVERITY.NONE') || 'Sin nivel';
    }
  }

  incidentStatusClass(status?: IncidentStatus | null): string {
    switch (status) {
      case 'ABIERTO': return 'status-open';
      case 'CERRADO_CON_RESOLUCION': return 'status-closed-resolution';
      case 'CERRADO_SIN_RESOLUCION': return 'status-closed';
      case 'CREADO':
      default:
        return 'status-created';
    }
  }

  incidentSeverityClass(severity?: IncidentSeverity | null): string {
    switch (severity) {
      case 'ALTA': return 'severity-high';
      case 'MEDIA': return 'severity-medium';
      case 'BAJA': return 'severity-low';
      default: return 'severity-none';
    }
  }

  incidentTypeActive(type: IncidentType): boolean {
    return incidentTypeIsActive(type);
  }

  isClosed(status?: IncidentStatus | null): boolean {
    return isIncidentClosed(status);
  }

  attachmentQuantity(attachment: IncidentAuditAttachment): string {
    const value = attachment.quantityCooked;
    if (value === null || value === undefined || value === '') return '-';
    return typeof value === 'string' ? value : String(value);
  }

  private filterVisibleIncidents(): IncidentListItem[] {
    const term = this.incidentSearch.trim().toLowerCase();
    if (!term) {
      return [...this.incidents];
    }

    return this.incidents.filter(item => {
      const haystack = [
        String(item.id),
        item.title,
        item.incidentType?.name,
        item.createdBy?.name,
        item.relatedTeacher?.name,
        item.status,
        item.severity
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }

  creatorLabel(user?: User | null): string {
    return user?.name || '-';
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  private ensureChatRealtimeConnected(): void {
    const token = this.authService.getToken();
    if (!token) {
      return;
    }

    if (this.chatRealtimeClient?.active) {
      return;
    }

    this.chatRealtimeClient = new Client({
      webSocketFactory: () => new SockJS(this.getChatSockJsUrl()),
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      beforeConnect: async () => {
        const freshToken = this.authService.getToken();
        if (!freshToken) {
          throw new Error('Missing auth token for incident chat realtime');
        }

        if (this.chatRealtimeClient) {
          this.chatRealtimeClient.connectHeaders = {
            Authorization: `Bearer ${freshToken}`
          };
        }
      },
      reconnectDelay: 1000,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      maxReconnectDelay: 30000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        this.chatRealtimeConnected = true;
        const incidentId = this.pendingIncidentSubscriptionId ?? this.selectedIncidentId;
        if (incidentId) {
          this.subscribeIncidentRealtimeTopics(incidentId);
          this.pendingIncidentSubscriptionId = null;
        }
      },
      onStompError: frame => {
        this.logger.error('Incident chat STOMP error:', frame.headers['message'] || frame.body);
      },
      onWebSocketClose: () => {
        this.chatRealtimeConnected = false;
      },
      onWebSocketError: error => {
        this.logger.error('Incident chat websocket transport error:', error);
      }
    });

    this.chatRealtimeClient.activate();
  }

  private disconnectChatRealtime(): void {
    this.chatRealtimeConnected = false;
    if (this.chatRealtimeClient) {
      void this.chatRealtimeClient.deactivate();
      this.chatRealtimeClient = undefined;
    }
  }

  private subscribeIncidentRealtimeTopics(incidentId: number): void {
    if (!this.chatRealtimeClient?.connected) {
      this.pendingIncidentSubscriptionId = incidentId;
      return;
    }

    if (this.subscribedIncidentId === incidentId && this.chatRealtimeSubscriptions.length > 0) {
      return;
    }

    this.unsubscribeIncidentRealtimeTopics();
    this.subscribedIncidentId = incidentId;

    const chatTopic = `/topic/incidents/${incidentId}/chat`;
    const readReceiptTopic = `/topic/incidents/${incidentId}/chat/read-receipts`;
    const typingTopic = `/topic/incidents/${incidentId}/chat/typing`;

    this.chatRealtimeSubscriptions.push(
      this.chatRealtimeClient.subscribe(chatTopic, (message: IMessage) => {
        this.handleChatRealtimeMessage(message);
      })
    );

    this.chatRealtimeSubscriptions.push(
      this.chatRealtimeClient.subscribe(readReceiptTopic, (message: IMessage) => {
        this.handleReadReceiptRealtimeMessage(message);
      })
    );

    this.chatRealtimeSubscriptions.push(
      this.chatRealtimeClient.subscribe(typingTopic, (message: IMessage) => {
        this.handleTypingRealtimeMessage(message);
      })
    );
  }

  private unsubscribeIncidentRealtimeTopics(): void {
    this.chatRealtimeSubscriptions.forEach(subscription => subscription.unsubscribe());
    this.chatRealtimeSubscriptions.length = 0;
    this.subscribedIncidentId = null;
  }

  private handleChatRealtimeMessage(message: IMessage): void {
    try {
      const payload = JSON.parse(message.body) as IncidentChatMessage;
      const wasNew = !this.chatMessages.some(item => item.id === payload.id);
      this.upsertChatMessage(payload);

      if (wasNew) {
        this.queueScrollToMessage(payload.id);
        this.highlightIncomingMessage(payload.id);
      }

      this.ensureChatImagePreview(payload);

      if (this.detailTab === 'chat' && payload.authorId !== this.currentUserId) {
        this.scheduleMarkChatAsRead();
      }

      this.cdr.markForCheck();
    } catch (error) {
      this.logger.error('Invalid incident chat payload:', error);
    }
  }

  private handleReadReceiptRealtimeMessage(message: IMessage): void {
    try {
      const payload = JSON.parse(message.body) as IncidentChatReadReceipt;
      this.applyReadReceiptToMessages(payload);
      this.cdr.markForCheck();
    } catch (error) {
      this.logger.error('Invalid incident read receipt payload:', error);
    }
  }

  private handleTypingRealtimeMessage(message: IMessage): void {
    try {
      const payload = JSON.parse(message.body) as IncidentChatTypingResponse;

      if (!payload || payload.userId === this.currentUserId) {
        return;
      }

      if (!payload.typing) {
        this.removeRemoteTypingUser(payload.userId);
        return;
      }

      this.remoteTypingUsersMap.set(payload.userId, payload);
      this.typingUsers = Array.from(this.remoteTypingUsersMap.values());

      const currentTimeout = this.remoteTypingTimeoutByUser.get(payload.userId);
      if (currentTimeout !== undefined) {
        window.clearTimeout(currentTimeout);
      }

      const timeoutId = window.setTimeout(() => {
        this.removeRemoteTypingUser(payload.userId);
      }, this.remoteTypingVisibilityMs);

      this.remoteTypingTimeoutByUser.set(payload.userId, timeoutId);
      this.cdr.markForCheck();
    } catch (error) {
      this.logger.error('Invalid incident typing payload:', error);
    }
  }

  private markChatAsRead(): void {
    if (!this.selectedIncidentId || this.detailTab !== 'chat') {
      return;
    }

    if (this.chatRealtimeClient?.connected) {
      this.chatRealtimeClient.publish({
        destination: `/app/incidents/${this.selectedIncidentId}/chat.markRead`,
        body: ''
      });
      return;
    }

    this.incidentService.markChatAsRead(this.selectedIncidentId).subscribe({
      error: () => {
        // noop: fallback best-effort
      }
    });
  }

  private scheduleMarkChatAsRead(): void {
    if (!this.selectedIncidentId || this.detailTab !== 'chat') {
      return;
    }

    this.clearMarkReadTimeout();
    this.markReadTimeout = window.setTimeout(() => {
      this.markChatAsRead();
      this.markReadTimeout = null;
    }, this.readReceiptDebounceMs);
  }

  private clearMarkReadTimeout(): void {
    if (this.markReadTimeout !== null) {
      window.clearTimeout(this.markReadTimeout);
      this.markReadTimeout = null;
    }
  }

  private emitTypingState(typing: boolean): void {
    if (!this.selectedIncidentId || this.detailTab !== 'chat') {
      return;
    }

    if (!this.chatRealtimeClient?.connected) {
      return;
    }

    if (this.typingLocallyActive === typing) {
      return;
    }

    this.chatRealtimeClient.publish({
      destination: `/app/incidents/${this.selectedIncidentId}/chat.typing`,
      body: JSON.stringify({ typing })
    });

    this.typingLocallyActive = typing;

    if (!typing) {
      this.clearTypingStopTimeout();
    }
  }

  private scheduleTypingStop(): void {
    this.clearTypingStopTimeout();
    this.typingStopTimeout = window.setTimeout(() => {
      this.emitTypingState(false);
      this.cdr.markForCheck();
    }, this.typingDebounceMs);
  }

  private clearTypingStopTimeout(): void {
    if (this.typingStopTimeout !== null) {
      window.clearTimeout(this.typingStopTimeout);
      this.typingStopTimeout = null;
    }
  }

  private removeRemoteTypingUser(userId: number): void {
    const timeout = this.remoteTypingTimeoutByUser.get(userId);
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      this.remoteTypingTimeoutByUser.delete(userId);
    }

    if (this.remoteTypingUsersMap.delete(userId)) {
      this.typingUsers = Array.from(this.remoteTypingUsersMap.values());
      this.cdr.markForCheck();
    }
  }

  private clearRemoteTypingUsers(): void {
    this.remoteTypingTimeoutByUser.forEach(timeout => window.clearTimeout(timeout));
    this.remoteTypingTimeoutByUser.clear();
    this.remoteTypingUsersMap.clear();
    this.typingUsers = [];
    this.cdr.markForCheck();
  }

  private upsertChatMessage(message: IncidentChatMessage): void {
    const existingIndex = this.chatMessages.findIndex(item => item.id === message.id);
    if (existingIndex >= 0) {
      const next = [...this.chatMessages];
      next[existingIndex] = {
        ...next[existingIndex],
        ...message
      };
      this.chatMessages = next;
      return;
    }

    this.chatMessages = [...this.chatMessages, message].sort((a, b) => a.id - b.id);
  }

  private applyReadReceiptToMessages(receipt: IncidentChatReadReceipt): void {
    if (!receipt || !receipt.userId || !receipt.lastReadMessageId) {
      return;
    }

    this.chatMessages = this.chatMessages.map(message => {
      if (message.id > receipt.lastReadMessageId) {
        return message;
      }

      const readBy = (message.readBy || []).filter(item => item.userId !== receipt.userId);
      return {
        ...message,
        readBy: [...readBy, receipt]
      };
    });
  }

  private getChatSockJsUrl(): string {
    const configured = (environment.apiUrl || '').trim();
    if (configured) {
      return `${configured.replace(/\/$/, '')}/ws-alerts`;
    }

    return `${window.location.origin}/ws-alerts`;
  }

  private queueScrollToMessage(messageId: number): void {
    if (this.detailTab !== 'chat') {
      return;
    }

    this.pendingScrollToMessageId = messageId;
    this.scrollToPendingMessageIfNeeded();
  }

  private scrollToPendingMessageIfNeeded(): void {
    if (this.pendingScrollToMessageId === null || !this.chatMessageItems || this.chatMessageItems.length === 0) {
      return;
    }

    const pendingMessageId = this.pendingScrollToMessageId;
    requestAnimationFrame(() => {
      const target = this.chatMessageItems.find(
        item => Number(item.nativeElement.dataset['messageId']) === pendingMessageId
      )?.nativeElement ?? this.chatMessageItems.last?.nativeElement;

      if (!target) {
        return;
      }

      target.scrollIntoView({ behavior: 'smooth', block: 'end' });
      const scrollContainer = this.findNearestScrollableParent(target);
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
      this.pendingScrollToMessageId = null;
    });
  }

  private findNearestScrollableParent(element: HTMLElement): HTMLElement | null {
    let current: HTMLElement | null = element.parentElement;

    while (current) {
      const style = window.getComputedStyle(current);
      const overflowY = style.overflowY;
      const isScrollable = (overflowY === 'auto' || overflowY === 'scroll')
        && current.scrollHeight > current.clientHeight;

      if (isScrollable) {
        return current;
      }

      current = current.parentElement;
    }

    return null;
  }
}