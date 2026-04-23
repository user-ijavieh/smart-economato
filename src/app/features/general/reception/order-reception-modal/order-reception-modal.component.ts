import { ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';  
import { CommonModule, DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, catchError, of } from 'rxjs';
import {
  Order,
  OrderDetail,
  OrderReceptionRequest
} from '../../../../shared/models/order.model';
import { OrderService } from '../../../../core/services/order.service';
import { MessageService } from '../../../../core/services/message.service';
import { ProductService } from '../../../../core/services/product.service';
import { Product } from '../../../../shared/models/product.model';
import { ScaleService } from '../../../../core/services/scale.service';
import { AuthService } from '../../../../core/services/auth.service';
import { OrderReviewLockStateService } from '../../../../core/services/order-review-lock-state.service';
import { OrderReviewCollaborationStateService } from '../../../../core/services/order-review-collaboration-state.service';
import { WebSocketService } from '../../../../core/services/websocket.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BaseModalComponent } from '../../../../shared/components/base-modal/base-modal.component';
import { BarcodeScannerComponent } from '../../barcode-scanner/barcode-scanner.component';

@Component({
  selector: 'app-order-reception-modal',
  standalone: true,
  imports: [FormsModule, BaseModalComponent, DatePipe, DecimalPipe, UpperCasePipe, BarcodeScannerComponent, TranslateModule],
  templateUrl: './order-reception-modal.component.html',
  styleUrl: './order-reception-modal.component.css'
})
export class OrderReceptionModalComponent implements OnInit, OnDestroy {
  @Input({ required: true }) order!: Order;
  @Output() closeModal = new EventEmitter<void>();
  @Output() receptionProcessed = new EventEmitter<void>();

  private orderService = inject(OrderService);
  private messageService = inject(MessageService);
  private productService = inject(ProductService);
  private scaleService = inject(ScaleService);
  private authService = inject(AuthService);
  private orderReviewLockStateService = inject(OrderReviewLockStateService);
  private orderReviewCollaborationStateService = inject(OrderReviewCollaborationStateService);
  private webSocketService = inject(WebSocketService);
  public translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);

  isProcessing = false;
  isScaleListening = false;
  searchTerm = '';
  showScannerModal = false;
  filteredDetails: OrderDetail[] = [];
  roundingMode: 'lots' | 'units' = 'lots';

  private scaleSubscription?: Subscription;
  private listeningSubscription?: Subscription;
  private activeScaleTarget: { productId: number; lotIndex: number } | null = null;

  beforeCloseHandler = async (): Promise<boolean> => {
    if (this.isProcessing) {
      return false;
    }

    return await this.messageService.confirm(
      this.translate.instant('RECEPTION.MESSAGES.EXIT_WITHOUT_SAVING_TITLE') || 'Salir de recepción',
      this.translate.instant('RECEPTION.MESSAGES.EXIT_WITHOUT_SAVING') || '¿Salir sin guardar? Los datos introducidos no se conservarán.',
      this.translate.instant('RECEPTION.MESSAGES.EXIT_WITHOUT_SAVING_BTN') || 'Salir sin guardar',
      this.translate.instant('COMMON.BACK') || 'Volver'
    );
  };

  ngOnInit(): void {
    this.filteredDetails = [...(this.order.details || [])];

    this.scaleSubscription = this.scaleService.weight$.subscribe(weight => {
      this.applyWeightToActiveLot(weight);
      this.cdr.detectChanges();
    });

    this.listeningSubscription = this.scaleService.listening$.subscribe(isListening => {
      this.isScaleListening = isListening;
      this.cdr.detectChanges();

      if (!isListening) {
        this.activeScaleTarget = null;
      }
    });

    if (this.order && this.order.details) {
      this.order.details.forEach(detail => {
        if (!detail.lots || detail.lots.length === 0) {
          detail.lots = [{ quantity: 0, expirationDate: null, batchCode: null }];
        }
      });
    }

    this.applySearch();
  }

  ngOnDestroy(): void {
    this.scaleSubscription?.unsubscribe();
    this.listeningSubscription?.unsubscribe();
    void this.scaleService.stopListening();
  }

  onSearchTermChange(term: string): void {
    this.searchTerm = term;
    this.applySearch();
  }

  applySearch(): void {
    const details = this.order.details || [];
    const term = this.searchTerm.trim();

    if (!term) {
      this.filteredDetails = [...details];
      return;
    }

    const normalizedTerm = this.normalizeText(term);
    const nameMatches = details.filter(detail =>
      this.normalizeText(detail.productName).includes(normalizedTerm)
    );

    if (nameMatches.length > 0) {
      this.filteredDetails = nameMatches;
      return;
    }

    this.productService.getByBarcode(term).pipe(
      catchError(() => of(null))
    ).subscribe(product => {
      if (!product) {
        this.filteredDetails = [];
        return;
      }

      this.filteredDetails = details.filter(detail => detail.productId === product.id);
      this.searchTerm = product.productCode || product.name || term;
    });
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.filteredDetails = [...(this.order.details || [])];
  }

  openBarcodeScanner(): void {
    this.showScannerModal = true;
  }

  closeBarcodeScanner(): void {
    this.showScannerModal = false;
  }

  onProductFound(product: Product): void {
    this.searchTerm = product.productCode || product.name || '';
    this.showScannerModal = false;
    this.applySearch();
  }

  get visibleDetails(): OrderDetail[] {
    return this.filteredDetails;
  }

  addLot(detail: any): void {
    if (!detail.lots) detail.lots = [];
    detail.lots.push({ quantity: 0, expirationDate: null, batchCode: null });
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  onRoundingModeChange(mode: 'units' | 'lots'): void {
    this.roundingMode = mode;
  }

  getLotCount(quantity: number, lotQuantity: number | undefined): number {
    if (!lotQuantity || lotQuantity <= 0) return 0;
    return quantity / lotQuantity;
  }

  updateLotQuantity(detail: OrderDetail, lotIndex: number, lotCount: number): void {
    if (detail.lotQuantity && detail.lotQuantity > 0) {
      const parsedLotCount = Number(lotCount);
      const safeLotCount = Number.isFinite(parsedLotCount) && parsedLotCount >= 0 ? parsedLotCount : 0;
      const newQuantity = safeLotCount * detail.lotQuantity;
      detail.lots![lotIndex].quantity = Math.round(newQuantity * 10000) / 10000;
    }
  }

  formatUnit(unit: string | undefined, compact = true): string {
    if (!unit) return '';
    if (!compact) return unit;
    return unit.length > 5 ? unit.substring(0, 4) + '.' : unit;
  }

  removeLot(detail: any, index: number): void {
    if (detail.lots && detail.lots.length > 1) {
      detail.lots.splice(index, 1);
    }
  }

  getTotalReceived(detail: any): number {
    if (!detail.lots) return 0;
    return detail.lots.reduce((acc: number, lot: any) => acc + (lot.quantity || 0), 0);
  }

  getComparisonSymbol(detail: any): string {
    const expected = detail.quantity || 0;
    const received = this.getTotalReceived(detail);
    
    if (received === expected) {
      return '✓';
    } else if (received < expected) {
      return '✕';
    } else {
      return '▲';
    }
  }

  getFormattedQuantity(detail: any): string {
    const expected = detail.quantity || 0;
    const received = this.getTotalReceived(detail);
    const unit = detail.unit || this.translate.instant('COMMON.UNITS_SHORT') || 'uds';
    return `${expected} / ${received} ${unit}`;
  }

  async confirmCancel() {
    const confirmed = await this.messageService.confirm(
      this.translate.instant('RECEPTION.MESSAGES.EXIT_WITHOUT_SAVING_TITLE') || 'Salir de recepción',
      this.translate.instant('RECEPTION.MESSAGES.EXIT_WITHOUT_SAVING') || '¿Salir sin guardar? Los datos introducidos no se conservarán.',
      this.translate.instant('RECEPTION.MESSAGES.EXIT_WITHOUT_SAVING_BTN') || 'Salir sin guardar',
      this.translate.instant('COMMON.BACK') || 'Volver'
    );
    if (confirmed) {
      this.close();
    }
  }

  close(): void {
    void this.scaleService.stopListening();
    this.closeModal.emit();
  }

  get collaborators(): OrderCollaborationUser[] {
    return this.collaborationState?.collaborators || [];
  }

  get pendingRequests(): OrderCollaborationUser[] {
    return this.collaborationState?.pendingRequests || [];
  }

  get canAdmitCollaborators(): boolean {
    return !!this.collaborationState?.currentUserCanAdmit;
  }

  get canEditCollaboratively(): boolean {
    // Si no ha cargado el estado de colaboración, NO intentamos editar colaborativamente
    // Esto evita inundaciones de red si el sistema está "desconectado"
    // Si el sistema colaborativo está deshabilitado o no cargado, mantenemos edición local.
    if (!this.isCollaborationAvailable()) {
      return true;
    }

    if (!this.reviewLockStatus?.locked) {
      return true;
    }

    if (this.reviewLockStatus.currentUserOwner || this.reviewLockStatus.currentUserAdmin) {
      return true;
    }

    return !!this.collaborationState?.currentUserCollaborator;
  }

  get canRequestSharedReview(): boolean {
    const hasBlockingLock = !!this.reviewLockStatus?.locked || this.conflictBlockedByOtherUser;
    if (!hasBlockingLock || this.isProcessing || this.requestingSharedReview) {
      return false;
    }

    if (!this.lockBlockedForCurrentUser) {
      return false;
    }

    const currentUserId = this.authService.getUserId();
    if (currentUserId == null) {
      return true;
    }

    const pending = this.collaborationState?.pendingRequests || [];
    return !pending.some(user => user.userId === currentUserId);
  }

  canConfirmReception(): boolean {
    if (!this.reviewLockStatus?.locked) {
      return true;
    }
    return !!this.reviewLockStatus.currentUserOwner || this.isCurrentUserAdmin();
  }

  isInputDisabled(fieldPath?: string): boolean {
    if (this.isProcessing) {
      return true;
    }

    if (!this.canEditCollaboratively) {
      return true;
    }

    if (!fieldPath || !this.isCollaborationAvailable()) {
      return false;
    }

    return this.isFieldLockedByAnotherUser(fieldPath);
  }

  getFieldLockOwner(fieldPath: string): string {
    const lock = this.findFieldLock(fieldPath);
    return lock?.lockedByDisplayName || lock?.lockedByUsername || this.translate.instant('RECEPTION.MODAL.OTHER_USER') || 'Otro usuario';
  }

  onFieldFocus(detail: OrderDetail, lotIndex: number, fieldName: 'quantity' | 'expirationDate' | 'batchCode'): void {
    if (!this.canEditCollaboratively || !this.isCollaborationAvailable()) {
      return;
    }

    const fieldPath = this.buildFieldPath(detail.productId, lotIndex, fieldName);
    this.orderReviewCollaborationStateService.lockField(this.order.id, fieldPath).subscribe({
      next: () => {
        this.activeFieldLocks.add(fieldPath);
      },
      error: () => {}
    });
  }

  onFieldBlur(detail: OrderDetail, lotIndex: number, fieldName: 'quantity' | 'expirationDate' | 'batchCode'): void {
    if (!this.isCollaborationAvailable()) {
      return;
    }

    const fieldPath = this.buildFieldPath(detail.productId, lotIndex, fieldName);
    if (!this.activeFieldLocks.has(fieldPath)) {
      return;
    }

    this.orderReviewCollaborationStateService.unlockField(this.order.id, fieldPath).subscribe({
      next: () => {
        this.activeFieldLocks.delete(fieldPath);
      },
      error: () => {}
    });
  }

  onLotFieldChange(detail: OrderDetail, lotIndex: number, fieldName: 'quantity' | 'expirationDate' | 'batchCode', rawValue: unknown): void {
    if (!this.canEditCollaboratively || !this.isCollaborationAvailable()) {
      return;
    }

    const fieldPath = this.buildFieldPath(detail.productId, lotIndex, fieldName);
    let value: unknown = rawValue;
    if (fieldName === 'quantity') {
      const numeric = Number(rawValue);
      value = Number.isFinite(numeric) ? numeric : 0;
    }

    this.patchSubject.next({ fieldPath, value });
  }

  requestSharedReview(): void {
    this.requestingSharedReview = true;
    this.orderReviewCollaborationStateService.requestSharedReview(this.order.id).subscribe({
      next: () => {
        this.messageService.showInfo(this.translate.instant('RECEPTION.MESSAGES.COLLABORATION_REQUEST_SENT') || 'Solicitud de revisión compartida enviada.');
        this.requestingSharedReview = false;
      },
      error: () => {
        this.requestingSharedReview = false;
      }
    });
  }

  admitSharedReview(userId: number): void {
    this.admittingUserIds.add(userId);
    this.orderReviewCollaborationStateService.admitSharedReview(this.order.id, userId).subscribe({
      next: () => {
        this.admittingUserIds.delete(userId);
      },
      error: () => {
        this.admittingUserIds.delete(userId);
      }
    });
  }

  async toggleScaleForLot(detail: any, lotIndex: number): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    const productId = Number(detail.productId);
    const sameTarget = this.activeScaleTarget?.productId === productId && this.activeScaleTarget?.lotIndex === lotIndex;

    if (this.isScaleListening && sameTarget) {
      await this.scaleService.stopListening();
      return;
    }

    this.activeScaleTarget = { productId, lotIndex };

    if (this.isScaleListening) {
      return;
    }

    if (!this.scaleService.isSupported) {
      this.messageService.showError(this.translate.instant('RECEPTION.MODAL.SCALE_NOT_SUPPORTED'));
      return;
    }

    try {
      await this.scaleService.startListening({ baudRate: 9600 });
  this.messageService.showInfo(this.translate.instant('RECEPTION.MODAL.SCALE_CONNECTED'));  
  } catch (error: any) {  
  this.activeScaleTarget = null;  
  const detail = error?.message || 'Error desconocido';  
  this.messageService.showError(`${this.translate.instant('RECEPTION.MODAL.SCALE_ERROR')}: ${detail}`);  
  console.error('Error abriendo báscula:', error);  
  }

  isScaleActiveForLot(detail: any, lotIndex: number): boolean {
    if (!this.isScaleListening || !this.activeScaleTarget) {
      return false;
    }
    return this.activeScaleTarget.productId === Number(detail.productId) && this.activeScaleTarget.lotIndex === lotIndex;
  }

  manualRefresh(): void {

  }

  private applyWeightToActiveLot(rawWeight: string): void {
    if (!this.activeScaleTarget || !this.order.details) {
      return;
    }

    const parsedWeight = Number(rawWeight);
    if (!Number.isFinite(parsedWeight)) {
      return;
    }

    const targetDetail = this.order.details.find(detail => Number(detail.productId) === this.activeScaleTarget?.productId);
    if (!targetDetail?.lots) {
      return;
    }

    const targetLot = targetDetail.lots[this.activeScaleTarget.lotIndex];
    if (!targetLot) {
      return;
    }

    targetLot.quantity = Number(parsedWeight.toFixed(4));
  }

  async processReception(): Promise<void> {
    if (this.order.status !== 'REVIEW') {
      this.messageService.showInfo(this.translate.instant('RECEPTION.MESSAGES.REVIEW_RELEASED', { id: this.order.id }) || `La orden #${this.order.id} ya no está en revisión. Se actualizará la vista.`);
      this.close();
      return;
    }

    if (Date.now() < this.processCooldownUntil) {
      this.messageService.showInfo(this.translate.instant('RECEPTION.MESSAGES.SYNCING_WAIT') || 'Espera un momento antes de reintentar. Se está sincronizando el estado de revisión.');
      return;
    }

    if (!this.canConfirmReception()) {
      this.messageService.showError(this.lockInfoDetail || this.translate.instant('RECEPTION.MESSAGES.REVIEWED_BY_OTHER') || 'La orden está siendo revisada por otro usuario.');
      return;
    }

    if (!this.order.details || this.order.details.length === 0) {
      this.messageService.showError(this.translate.instant('RECEPTION.MESSAGES.NO_PRODUCTS') || 'La orden no tiene productos.');
      return;
    }

    const hasInvalidQuantities = this.order.details.some(d => {
      const total = this.getTotalReceived(d);
      return total < 0 || d.lots?.some(lot => lot.quantity < 0 || lot.quantity === null || lot.quantity === undefined);
    });
    if (hasInvalidQuantities) {
      this.messageService.showError(this.translate.instant('RECEPTION.MESSAGES.INVALID_QUANTITIES') || 'Por favor revisa que todas las cantidades de los lotes sean números válidos o 0.');
      return;
    }

    const missingExpiration = this.order.details.some(d => 
      d.lots && d.lots.some(lot => lot.quantity > 0 && !lot.expirationDate)
    );
    if (missingExpiration) {
      this.messageService.showError(this.translate.instant('RECEPTION.MODAL.EXPIRATION_REQUIRED'));
      return;
    }

    const hasInvalidExpirationDate = this.order.details.some(d => 
      d.lots && d.lots.some(lot => lot.expirationDate && !/^\d{4}-\d{2}-\d{2}$/.test(lot.expirationDate))
    );
    if (hasInvalidExpirationDate) {
      this.messageService.showError(this.translate.instant('RECEPTION.MESSAGES.INVALID_EXP_FORMAT') || 'Revisa el formato de fecha de caducidad.');
      return;
    }

    const confirmed = await this.messageService.confirm(
      this.translate.instant('RECEPTION.PROCESS_RECEPTION') || 'Procesar Recepción',
      (this.translate.instant('RECEPTION.MESSAGES.CONFIRM_RECEPTION', { id: this.order.id })) || `¿Confirmar recepción de la orden #${this.order.id}?`
    );

    if (!confirmed) {
      return;
    }

    this.isProcessing = true;

    const request: OrderReceptionRequest = {
      orderId: this.order.id,
      items: this.order.details.map(d => ({
        productId: d.productId,
        quantityReceived: this.getTotalReceived(d),
        lots: d.lots?.map(l => ({
          quantity: l.quantity,
          expirationDate: l.expirationDate || null,
          batchCode: l.batchCode?.trim() ? l.batchCode.trim() : null
        })) || []
      }))
    };

    this.orderService.processReception(request).subscribe({
      next: () => {
        this.messageService.showSuccess(this.translate.instant('RECEPTION.MESSAGES.PROCESS_SUCCESS') || 'Recepción procesada correctamente');
        this.isProcessing = false;
        this.receptionProcessed.emit();
        this.close();
      },
      error: (error) => {
        if (error?.status === 409) {
          const currentStatus = error?.error?.currentStatus;
          if (currentStatus === 'CONFIRMED' || currentStatus === 'INCOMPLETE') {
            const statusTextKey = currentStatus === 'CONFIRMED' ? 'ORDERS.STATUS.CONFIRMED' : 'ORDERS.STATUS.INCOMPLETE';
            const statusText = this.translate.instant(statusTextKey).toLowerCase();
            const serverMessage = typeof error?.error?.message === 'string' ? error.error.message : null;
            this.messageService.showError(serverMessage || this.translate.instant('RECEPTION.MESSAGES.ORDER_ALREADY_STATUS', { id: this.order.id, status: statusText }) || `La orden #${this.order.id} ya esta ${statusText}.`);
            this.receptionProcessed.emit();
            this.close();
            this.isProcessing = false;
            return;
          }

          this.processCooldownUntil = Date.now() + OrderReceptionModalComponent.CONFLICT_COOLDOWN_MS;
          const lockedBy = error?.error?.lockedBy;
          const lockText = lockedBy
            ? this.translate.instant('RECEPTION.MESSAGES.REVISION_CONFLICT', { owner: lockedBy }) || `${lockedBy} está revisando esta orden en este momento.`
            : this.translate.instant('RECEPTION.MESSAGES.ORDER_CHANGED') || 'La orden cambió mientras la estabas revisando.';
          this.messageService.showError(lockText);
          this.orderReviewLockStateService.refresh(this.order.id).subscribe({ error: () => {} });
        } else {
          this.messageService.showError(this.translate.instant('RECEPTION.MESSAGES.PROCESS_ERROR') || 'Error al procesar la recepción');
        }
        this.isProcessing = false;
      }
    });
  }

  private initializeReviewLock(): void {
    // DESHABILITADO: Sistema de locks y colaboración compartida
    return;
    /*
    this.lockStatusSubscription = this.orderReviewLockStateService.watchOrder(this.order.id).subscribe(status => {
      this.reviewLockStatus = status;
      this.applyLockUiStatus(status);
    });

    this.orderReviewLockStateService.refresh(this.order.id).subscribe({
      next: status => {
        if (!status.locked || status.currentUserOwner) {
          this.tryAcquireReviewLock(true);
        } else {
          this.applyLockUiStatus(status);
          if (!status.currentUserOwner && !status.currentUserAdmin) {
            this.requestSharedReviewIfNeeded();
          }
        }
      },
      error: () => {
        this.tryAcquireReviewLock();
      }
    });
    */
  }

  private initializeCollaboration(): void {
    // DESHABILITADO: Sistema de locks y colaboración compartida
    return;
    /*
    this.collaborationStatusSubscription = this.orderReviewCollaborationStateService.watchOrder(this.order.id).subscribe(state => {
      this.collaborationState = state;
      this.applyCollaborationUiState(state);
      this.applyFieldValuesFromCollaboration();
    });

    this.orderReviewCollaborationStateService.refresh(this.order.id).subscribe({ error: () => {} });

    this.websocketConnectionSubscription = this.webSocketService.connected$.subscribe(isConnected => {
      if (!isConnected) {
        return;
      }

      this.orderReviewLockStateService.refresh(this.order.id).subscribe({ error: () => {} });
      this.orderReviewCollaborationStateService.refresh(this.order.id).subscribe({ error: () => {} });
    });

    this.syncEventSubscription = this.webSocketService.syncEvents$.subscribe(event => {
      const isSameOrderEvent = event.entityType?.toLowerCase() === 'order' && event.entityId === this.order.id;
      if (!isSameOrderEvent) {
        return;
      }

      this.orderReviewLockStateService.refresh(this.order.id).subscribe({ error: () => {} });
      this.orderReviewCollaborationStateService.refresh(this.order.id).subscribe({ error: () => {} });

      if (event.action === 'RECEIVE' || event.action === 'STATUS_CHANGE' || event.action === 'UPDATE') {
        this.refreshOrderStatusAndCloseIfNeeded();
      }
    });
    */
  }

  private refreshOrderStatusAndCloseIfNeeded(): void {
    // DESHABILITADO: Sistema de locks y colaboración compartida
    return;
    /*
    this.orderService.getById(this.order.id).subscribe({
      next: latestOrder => {
        this.order.status = latestOrder.status;
        if (latestOrder.status !== 'REVIEW' && !this.closedByExternalStatus) {
          this.closedByExternalStatus = true;
          this.messageService.showInfo(`La orden #${this.order.id} ya no está en revisión (${latestOrder.status}). Se cerrará esta ventana.`);
          this.close();
        }
      },
      error: () => {}
    });
    */
  }

  private requestSharedReviewIfNeeded(): void {
    // DESHABILITADO: Sistema de locks y colaboración compartida
    return;
    /*
    if (this.sharedReviewAutoRequested || !this.canRequestSharedReview) {
      return;
    }

    this.sharedReviewAutoRequested = true;
    this.requestingSharedReview = true;
    this.orderReviewCollaborationStateService.requestSharedReview(this.order.id).subscribe({
      next: () => {
        this.requestingSharedReview = false;
      },
      error: () => {
        this.requestingSharedReview = false;
        this.sharedReviewAutoRequested = false;
      }
    });
    */
  }

  private tryAcquireReviewLock(force = false): void {
    // DESHABILITADO: Sistema de locks y colaboración compartida
    return;
    /*
    if (this.order.status !== 'REVIEW') {
      return;
    }

    if (this.acquiringLock) {
      return;
    }

    if (!force && Date.now() < this.acquireRetryBlockedUntil) {
      return;
    }

    if (this.reviewLockStatus?.locked && !this.reviewLockStatus.currentUserOwner) {
      return;
    }

    this.acquireRetryBlockedUntil = Date.now() + OrderReceptionModalComponent.ACQUIRE_RETRY_COOLDOWN_MS;

    this.acquiringLock = true;
    this.orderReviewLockStateService.acquire(this.order.id).subscribe({
      next: status => {
        this.acquiringLock = false;
        this.acquireRetryBlockedUntil = 0;
        this.conflictBlockedByOtherUser = false;
        this.reviewLockStatus = status;
        this.applyLockUiStatus(status);
      },
      error: error => {
        this.acquiringLock = false;
        if (error?.status === 409) {
          this.conflictBlockedByOtherUser = true;
          this.acquireRetryBlockedUntil = Date.now() + OrderReceptionModalComponent.ACQUIRE_RETRY_COOLDOWN_MS;
          const lockedBy = error?.error?.lockedBy;
          this.lockInfoTitle = this.translate.instant('RECEPTION.MODAL.REVIEW_IN_PROGRESS');
          this.lockInfoDetail = lockedBy
            ? this.translate.instant('RECEPTION.MODAL.REVIEW_IN_PROGRESS_READONLY', { owner: lockedBy })
            : this.translate.instant('RECEPTION.MODAL.OTHER_USER_READONLY');
          this.lockBlockedForCurrentUser = !this.isCurrentUserAdmin();
          this.requestSharedReviewIfNeeded();
          this.orderReviewLockStateService.refresh(this.order.id).subscribe({ error: () => {} });
          return;
        }

        this.acquireRetryBlockedUntil = Date.now() + OrderReceptionModalComponent.ACQUIRE_RETRY_COOLDOWN_MS;
      }
    });
    */
  }

  private applyLockUiStatus(status: OrderReviewLockStatus | null): void {
    // DESHABILITADO: Sistema de locks y colaboración compartida
    return;
    /*
      this.stopLockHeartbeat();
      this.conflictBlockedByOtherUser = false;
      this.lockBlockedForCurrentUser = false;
      this.lockInfoTitle = '';
      this.lockInfoDetail = '';
      this.sharedReviewAutoRequested = false;
      // DESHABILITADO: this.displayMode = 'editing';
      
      if (this.order.status === 'REVIEW') {
        this.tryAcquireReviewLock();
      }
      return;
    }

    if (status.currentUserOwner) {
      this.startLockHeartbeat();
      this.conflictBlockedByOtherUser = false;
      this.lockBlockedForCurrentUser = false;
      this.lockInfoTitle = 'Bloqueo activo';
      this.lockInfoDetail = 'Se liberará al salir de esta ventana.';
      // DESHABILITADO: this.displayMode = 'editing';
      return;
    }

    this.stopLockHeartbeat();
    this.conflictBlockedByOtherUser = true;

    const lockOwner = status.lockedByDisplayName || status.lockedByUsername || 'Otro usuario';
    if (this.isCurrentUserAdmin()) {
      this.lockBlockedForCurrentUser = false;
      this.lockInfoTitle = 'Revisión compartida';
      this.lockInfoDetail = `${lockOwner} la está revisando. Puedes continuar y confirmar en paralelo como ADMIN.`;
      // DESHABILITADO: this.displayMode = 'editing';
      return;
    }

    this.lockBlockedForCurrentUser = true;
    this.lockInfoTitle = 'Revisión en curso';
    this.lockInfoDetail = `${lockOwner} está revisando esta orden en este momento.`;
    // DESHABILITADO: this.displayMode = 'viewing_locked';
    */
  }

  private applyCollaborationUiState(state: OrderReviewCollaborationState | null): void {
    // DESHABILITADO: Sistema de locks y colaboración compartida
    return;
    /*
    if (!this.reviewLockStatus?.locked || !state) {
      return;
    }

    if (state.currentUserCollaborator && !this.reviewLockStatus.currentUserOwner && !this.reviewLockStatus.currentUserAdmin) {
      this.lockBlockedForCurrentUser = false;
      this.lockInfoTitle = 'Revisión compartida admitida';
      this.lockInfoDetail = 'Puedes editar campos en paralelo con otros colaboradores.';
    }

    if (!this.canEditCollaboratively && this.lockBlockedForCurrentUser) {
      this.requestSharedReviewIfNeeded();
    }
    */
  }

  private applyFieldValuesFromCollaboration(): void {
    // DESHABILITADO: Sistema de locks y colaboración compartida
    return;
    /*
    if (!this.collaborationState?.fieldValues || !this.order.details) {
      return;
    }

    Object.entries(this.collaborationState.fieldValues).forEach(([fieldPath, value]) => {
      this.applyFieldPatch(fieldPath, value);
    });
    */
  }

  private applyFieldPatch(fieldPath: string, value: unknown): void {
    // DESHABILITADO: Sistema de locks y colaboración compartida
    return;
    /*
    const parsed = this.parseFieldPath(fieldPath);
    if (!parsed || !this.order.details) {
      return;
    }

    const detail = this.order.details.find(item => Number(item.productId) === parsed.productId);
    if (!detail?.lots || parsed.lotIndex < 0 || parsed.lotIndex >= detail.lots.length) {
      return;
    }

    const lot = detail.lots[parsed.lotIndex];
    if (parsed.fieldName === 'quantity') {
      const numeric = Number(value);
      lot.quantity = Number.isFinite(numeric) ? numeric : 0;
      return;
    }

    if (parsed.fieldName === 'expirationDate') {
      lot.expirationDate = value ? String(value) : null;
      return;
    }

    lot.batchCode = value ? String(value) : null;
    */
  }

  private buildFieldPath(productId: number, lotIndex: number, fieldName: 'quantity' | 'expirationDate' | 'batchCode'): string {
    return `detail:${productId}:lot:${lotIndex}:${fieldName}`;
  }

  private parseFieldPath(fieldPath: string): { productId: number; lotIndex: number; fieldName: 'quantity' | 'expirationDate' | 'batchCode' } | null {
    const match = /^detail:(\d+):lot:(\d+):(quantity|expirationDate|batchCode)$/.exec(fieldPath);
    if (!match) {
      return null;
    }

    return {
      productId: Number(match[1]),
      lotIndex: Number(match[2]),
      fieldName: match[3] as 'quantity' | 'expirationDate' | 'batchCode'
    };
  }

  private findFieldLock(fieldPath: string): OrderCollaborationFieldLock | undefined {
    return this.collaborationState?.fieldLocks?.find(lock => lock.fieldPath === fieldPath);
  }

  isFieldLockedByAnotherUser(fieldPath: string): boolean {
    const lock = this.findFieldLock(fieldPath);
    if (!lock) {
      return false;
    }

    const currentUserId = this.authService.getUserId();
    if (currentUserId == null) {
      return true;
    }

    if (lock.lockedByUserId === currentUserId) {
      return false;
    }

    return !this.isCurrentUserAdmin();
  }

  private releaseAllFieldLocks(): void {
    if (this.activeFieldLocks.size === 0) {
      return;
    }

    for (const fieldPath of Array.from(this.activeFieldLocks)) {
      this.orderReviewCollaborationStateService.unlockField(this.order.id, fieldPath).subscribe({
        next: () => {
          this.activeFieldLocks.delete(fieldPath);
        },
        error: () => {
          this.activeFieldLocks.delete(fieldPath);
        }
      });
    }
  }

  private releaseLockIfOwned(): void {
    if (!this.order || this.lockReleaseAttempted) {
      return;
    }

    if (this.reviewLockStatus?.locked && !this.reviewLockStatus.currentUserOwner) {
      return;
    }

    this.lockReleaseAttempted = true;

    this.orderReviewLockStateService.release(this.order.id).subscribe({
      error: () => {}
    });
  }

  private isCurrentUserAdmin(): boolean {
    return this.authService.getRole() === 'ADMIN';
  }
}
