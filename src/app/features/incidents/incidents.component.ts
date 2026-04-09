import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, forkJoin, finalize, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { IncidentService } from '../../core/services/incident.service';
import { MessageService } from '../../core/services/message.service';
import { UserService } from '../../core/services/user.service';
import { NotificationService } from '../../core/services/notification.service';
import { BaseModalComponent } from '../../shared/components/base-modal/base-modal.component';
import {
  AttachAuditRequest,
  CloseIncidentRequest,
  CreateIncidentRequest,
  IncidentAuditAttachment,
  IncidentChatMessage,
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
} from '../../shared/models/incident.model';
import { Page } from '../../shared/models/page.model';
import { User } from '../../shared/models/user.model';
import { Router } from '@angular/router';

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
  imports: [CommonModule, FormsModule, BaseModalComponent],
  templateUrl: './incidents.component.html',
  styleUrl: './incidents.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IncidentsComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly incidentService = inject(IncidentService);
  private readonly userService = inject(UserService);
  private readonly messageService = inject(MessageService);
  private readonly notificationService = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
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
  chatContent = '';
  chatFile: File | null = null;
  chatFilePreviewUrl: string | null = null;
  latestChatMessageId: number | null = null;
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
    this.loadUsers();
    this.loadIncidentTypes();
    this.loadIncidents();

    this.notificationService.incoming$
      .pipe(debounceTime(350), takeUntil(this.destroy$))
      .subscribe(() => {
        this.refreshFromRealtimeEvent();
      });
  }

  ngOnDestroy(): void {
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
        this.messageService.showError('No se pudieron cargar las incidencias');
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
      incidentTypeId: this.incidentTypes[0]?.id ?? '',
      title: '',
      description: ''
    };
    this.showCreateModal = true;
  }

  saveIncident(): void {
    if (!this.incidentForm.incidentTypeId || !this.incidentForm.title.trim() || !this.incidentForm.description.trim()) {
      this.messageService.showWarning('Completa el tipo, título y descripción');
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
        this.messageService.showSuccess('Incidencia creada');
        this.showCreateModal = false;
        this.loadIncidents();
        this.openIncidentDetail(incident.id);
      },
      error: () => this.messageService.showError('No se pudo crear la incidencia')
    });
  }

  openIncidentDetail(id: number): void {
    this.selectedIncidentId = id;
    this.showIncidentDetailModal = true;
    this.detailTab = 'summary';
    this.latestChatMessageId = null;
    this.loadIncidentDetail(id);
  }

  loadIncidentDetail(id: number): void {
    this.loadingIncidentDetail = true;
    this.loadingChat = true;

    const detail$ = this.incidentService.getIncident(id);
    const chat$ = this.incidentService.getChatHistory(id, 0, 200);
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
        this.selectedIncidentAttachments = payload.detail.attachedAudits || [];
        if ('audits' in payload) {
          const payloadWithAudits = payload as { audits: RecipeCookingAudit[] };
          this.attachableAudits = payloadWithAudits.audits || [];
          this.selectedAttachAuditIds = new Set();
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.showError('No se pudo cargar el detalle de la incidencia');
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
    this.revokeChatImagePreviews();
    this.closeImageZoom();
    this.showIncidentDetailModal = false;
    this.selectedIncident = null;
    this.selectedIncidentId = null;
    this.chatMessages = [];
    this.chatContent = '';
    this.chatFile = null;
    this.attachableAudits = [];
    this.selectedAttachAuditIds = new Set();
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
        this.messageService.showSuccess('Incidencia abierta');
        this.showOpenModal = false;
        this.selectedIncident = incident;
        this.refreshSelectedIncident();
      },
      error: () => this.messageService.showError('No se pudo abrir la incidencia')
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
        this.messageService.showSuccess('Incidencia cerrada');
        this.showCloseModal = false;
        this.selectedIncident = incident;
        this.refreshSelectedIncident();
      },
      error: () => this.messageService.showError('No se pudo cerrar la incidencia')
    });
  }

  onChatFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.chatFile = input.files?.[0] ?? null;
    this.createChatFilePreview();
    this.cdr.markForCheck();
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

  removeChatFile(): void {
    this.chatFile = null;
    this.chatFilePreviewUrl = null;
    this.cdr.markForCheck();
  }

  sendChatMessage(): void {
    if (!this.selectedIncidentId) return;

    const hasText = this.chatContent.trim().length > 0;
    const hasFile = !!this.chatFile;
    if (!hasText && !hasFile) {
      this.messageService.showWarning('Escribe un mensaje o adjunta un archivo');
      return;
    }

    this.sendingChat = true;
    this.incidentService.sendChatMessage(this.selectedIncidentId, this.chatContent, this.chatFile).pipe(
      finalize(() => {
        this.sendingChat = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: message => {
        this.chatMessages = [...this.chatMessages, message];
        this.highlightIncomingMessage(message.id);
        this.ensureChatImagePreview(message);
        this.chatContent = '';
        this.chatFile = null;
        this.chatFilePreviewUrl = null;
        this.messageService.showSuccess('Mensaje enviado');
        this.refreshSelectedIncident();
      },
      error: () => this.messageService.showError('No se pudo enviar el mensaje')
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

  downloadAttachment(message: IncidentChatMessage): void {
    if (!this.selectedIncidentId) return;
    this.incidentService.downloadChatAttachment(this.selectedIncidentId, message.id).subscribe({
      next: blob => this.downloadBlob(blob, message.attachmentFilename || 'adjunto'),
      error: () => this.messageService.showError('No se pudo descargar el adjunto')
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
      'Confirmar descarga',
      '¿Deseas descargar este archivo PDF?'
    );
    if (!confirmed) return;

    this.incidentService.exportPdf(this.selectedIncidentId).subscribe({
      next: blob => {
        this.downloadBlob(blob, `incidencia-${this.selectedIncidentId}.pdf`);
        this.messageService.showSuccess('PDF descargado correctamente');
      },
      error: () => this.messageService.showError('Error al generar el PDF')
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
    this.incidentService.getIncidentTypes().pipe(
      finalize(() => {
        this.loadingTypes = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: types => {
        this.incidentTypes = types || [];
        this.cdr.markForCheck();
      },
      error: () => this.messageService.showError('No se pudieron cargar los tipos de incidencia')
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
      this.messageService.showWarning('Indica un nombre para el tipo');
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
        this.messageService.showSuccess(this.editingType ? 'Tipo actualizado' : 'Tipo creado');
        this.showTypeModal = false;
        this.loadIncidentTypes();
      },
      error: () => this.messageService.showError('No se pudo guardar el tipo')
    });
  }

  toggleType(type: IncidentType): void {
    this.incidentService.toggleIncidentType(type.id).subscribe({
      next: () => {
        this.messageService.showSuccess(type.isActive || type.active ? 'Tipo desactivado' : 'Tipo activado');
        this.loadIncidentTypes();
      },
      error: () => this.messageService.showError('No se pudo cambiar el estado del tipo')
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
      error: () => this.messageService.showError('No se pudieron cargar las auditorías adjuntables')
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
      this.messageService.showWarning('Selecciona al menos una auditoría');
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
        this.messageService.showSuccess('Auditorías adjuntadas');
        this.showAttachModal = false;
        this.refreshSelectedIncident();
      },
      error: () => this.messageService.showError('No se pudieron adjuntar las auditorías')
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
      this.messageService.showWarning('Indica un motivo para la reversión');
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
        this.messageService.showSuccess('Auditoría revertida');
        this.showRevertModal = false;
        this.refreshSelectedIncident();
      },
      error: () => this.messageService.showError('No se pudo revertir la auditoría')
    });
  }

  loadUsers(): void {
    this.userService.getAllUnpaged().subscribe({
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
    return date.toLocaleString([], {
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
    return date.toLocaleString([], {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatStatus(status: IncidentStatus | string | null | undefined): string {
    switch (status) {
      case 'CREADO': return 'Creada';
      case 'ABIERTO': return 'Abierta';
      case 'CERRADO_CON_RESOLUCION':
      case 'CERRADO_SIN_RESOLUCION': return 'Cerrada';
      default: return '-';
    }
  }

  formatSeverity(severity?: IncidentSeverity | null): string {
    switch (severity) {
      case 'ALTA': return 'Alta';
      case 'MEDIA': return 'Media';
      case 'BAJA': return 'Baja';
      default: return 'Sin nivel';
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
}