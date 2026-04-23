import { Injectable, NgZone, inject } from '@angular/core';
import { Client, IMessage, ReconnectionTimeMode, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PresenceUpdateRequest, UserPresenceSnapshot } from '../../shared/models/presence.model';
import { SyncEvent } from '../../shared/models/sync-event.model';
import { StorageService } from './storage.service';
import { LoggerService } from './logger.service';

export interface AlertMessage {
  code: string;
  timestamp: number;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private readonly ngZone = inject(NgZone);
  private readonly storageService = inject(StorageService);
  private readonly logger = inject(LoggerService);
  private client?: Client;
  private broadcastSubscription?: StompSubscription;
  private personalSubscription?: StompSubscription;
  private syncSubscription?: StompSubscription;
  private adminPresenceSubscription?: StompSubscription;
  private chefStudentPresenceSubscription?: StompSubscription;
  private connectedToken?: string;
  private connectedRole?: string | null;
  private readonly alertSubject = new Subject<AlertMessage>();
  private readonly syncEventSubject = new Subject<SyncEvent>();
  private readonly adminPresenceSubject = new BehaviorSubject<UserPresenceSnapshot[]>([]);
  private readonly studentPresenceSubject = new BehaviorSubject<UserPresenceSnapshot[]>([]);
  private readonly connectedSubject = new BehaviorSubject<boolean>(false);

  readonly alerts$: Observable<AlertMessage> = this.alertSubject.asObservable();
  readonly syncEvents$: Observable<SyncEvent> = this.syncEventSubject.asObservable();
  readonly adminPresence$: Observable<UserPresenceSnapshot[]> = this.adminPresenceSubject.asObservable();
  readonly studentPresence$: Observable<UserPresenceSnapshot[]> = this.studentPresenceSubject.asObservable();
  readonly connected$: Observable<boolean> = this.connectedSubject.asObservable();

  connect(jwtToken: string, role: string | null = null): void {
    if (!jwtToken) {
      return;
    }

    const normalizedRole = role?.toUpperCase() ?? null;
    if (this.client?.active && this.connectedToken === jwtToken && this.connectedRole === normalizedRole) {
      return;
    }

    this.disconnect();
    this.connectedToken = jwtToken;
    this.connectedRole = normalizedRole;

    this.client = new Client({
      webSocketFactory: () => new SockJS(this.getSockJsUrl()),
      connectHeaders: {
        Authorization: `Bearer ${jwtToken}`
      },
      beforeConnect: async () => {
        const freshToken = this.storageService.get('auth_token') || jwtToken;
        this.connectedToken = freshToken;

        if (this.client) {
          this.client.connectHeaders = {
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
        this.broadcastSubscription?.unsubscribe();
        this.personalSubscription?.unsubscribe();
        this.syncSubscription?.unsubscribe();
        this.adminPresenceSubscription?.unsubscribe();
        this.chefStudentPresenceSubscription?.unsubscribe();
        
        // Suscripción a alertas broadcast (cambios en tiempo real)
        this.broadcastSubscription = this.client?.subscribe('/topic/alerts', (message: IMessage) => {
          this.handleAlertMessage(message);
        });
        
        // Suscripción a alertas personales (estado inicial al conectarse)
        this.personalSubscription = this.client?.subscribe('/user/queue/alerts', (message: IMessage) => {
          this.handleAlertMessage(message);
        });

        this.syncSubscription = this.client?.subscribe('/topic/sync', (message: IMessage) => {
          this.handleSyncMessage(message);
        });

        if (this.connectedRole === 'ADMIN') {
          this.adminPresenceSubscription = this.client?.subscribe('/topic/roles/ADMIN/presence', (message: IMessage) => {
            this.handleAdminPresenceMessage(message);
          });
        }

        if (this.connectedRole === 'CHEF') {
          this.chefStudentPresenceSubscription = this.client?.subscribe('/user/queue/student-presence', (message: IMessage) => {
            this.handleStudentPresenceMessage(message);
          });
        }

        this.ngZone.run(() => this.connectedSubject.next(true));
      },
      onWebSocketClose: () => {
        this.ngZone.run(() => this.connectedSubject.next(false));
      },
      onStompError: frame => {
        this.logger.error('STOMP error:', frame.headers['message'] || frame.body);
      }
    });

    this.client.activate();
  }

  disconnect(): void {
    this.broadcastSubscription?.unsubscribe();
    this.personalSubscription?.unsubscribe();
    this.syncSubscription?.unsubscribe();
    this.adminPresenceSubscription?.unsubscribe();
    this.chefStudentPresenceSubscription?.unsubscribe();
    this.broadcastSubscription = undefined;
    this.personalSubscription = undefined;
    this.syncSubscription = undefined;
    this.adminPresenceSubscription = undefined;
    this.chefStudentPresenceSubscription = undefined;
    this.connectedToken = undefined;
    this.connectedRole = undefined;
    this.adminPresenceSubject.next([]);
    this.studentPresenceSubject.next([]);
    this.connectedSubject.next(false);

    if (this.client) {
      void this.client.deactivate();
      this.client = undefined;
    }
  }

  private handleAlertMessage(message: IMessage): void {
    try {
      const alert: AlertMessage = JSON.parse(message.body) as AlertMessage;
      this.ngZone.run(() => this.alertSubject.next(alert));
    } catch (error) {
      this.logger.error('Invalid alert payload:', error);
    }
  }

  private handleSyncMessage(message: IMessage): void {
    try {
      const payload = JSON.parse(message.body) as SyncEvent;
      if (!Array.isArray(payload.affectedDomains) || typeof payload.changedBy !== 'string') {
        return;
      }

      if (!Array.isArray(payload.entityIds)) {
        payload.entityIds = [];
      }

      this.ngZone.run(() => this.syncEventSubject.next(payload));
    } catch (error) {
      this.logger.error('Invalid sync payload:', error);
    }
  }

  private handleAdminPresenceMessage(message: IMessage): void {
    try {
      const payload = JSON.parse(message.body) as UserPresenceSnapshot[];
      this.ngZone.run(() => this.adminPresenceSubject.next(Array.isArray(payload) ? payload : []));
    } catch (error) {
      this.logger.error('Invalid admin presence payload:', error);
    }
  }

  private handleStudentPresenceMessage(message: IMessage): void {
    try {
      const payload = JSON.parse(message.body) as UserPresenceSnapshot[];
      this.ngZone.run(() => this.studentPresenceSubject.next(Array.isArray(payload) ? payload : []));
    } catch (error) {
      this.logger.error('Invalid student presence payload:', error);
    }
  }

  publishPresenceUpdate(screen: string, context?: string | null, heartbeat = false): void {
    if (!this.client?.connected) {
      return;
    }

    const payload: PresenceUpdateRequest = {
      screen,
      context: context ?? null,
      heartbeat
    };

    this.client.publish({
      destination: '/app/presence.update',
      body: JSON.stringify(payload)
    });
  }

  private getSockJsUrl(): string {
    const configuredApiUrl = (environment.apiUrl || '').trim();

    if (!configuredApiUrl) {
      return `${window.location.protocol}//${window.location.host}/ws-alerts`;
    }

    return `${configuredApiUrl.replace(/\/$/, '')}/ws-alerts`;
  }
}
