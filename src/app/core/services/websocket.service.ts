import { Injectable } from '@angular/core';
import { Client, IMessage, ReconnectionTimeMode, StompSubscription } from '@stomp/stompjs';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PresenceUpdateRequest, UserPresenceSnapshot } from '../../shared/models/presence.model';

export interface AlertMessage {
  code: string;
  timestamp: number;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private client?: Client;
  private broadcastSubscription?: StompSubscription;
  private personalSubscription?: StompSubscription;
  private adminPresenceSubscription?: StompSubscription;
  private chefStudentPresenceSubscription?: StompSubscription;
  private connectedToken?: string;
  private connectedRole?: string | null;
  private readonly alertSubject = new Subject<AlertMessage>();
  private readonly adminPresenceSubject = new BehaviorSubject<UserPresenceSnapshot[]>([]);
  private readonly studentPresenceSubject = new BehaviorSubject<UserPresenceSnapshot[]>([]);
  private readonly brokerUrl = this.getBrokerUrl();

  readonly alerts$: Observable<AlertMessage> = this.alertSubject.asObservable();
  readonly adminPresence$: Observable<UserPresenceSnapshot[]> = this.adminPresenceSubject.asObservable();
  readonly studentPresence$: Observable<UserPresenceSnapshot[]> = this.studentPresenceSubject.asObservable();

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
      brokerURL: this.brokerUrl,
      connectHeaders: {
        Authorization: `Bearer ${jwtToken}`
      },
      reconnectDelay: 1000,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      maxReconnectDelay: 30000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        this.broadcastSubscription?.unsubscribe();
        this.personalSubscription?.unsubscribe();
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
      },
      onStompError: frame => {
        console.error('STOMP error:', frame.headers['message'] || frame.body);
      }
    });

    this.client.activate();
  }

  disconnect(): void {
    this.broadcastSubscription?.unsubscribe();
    this.personalSubscription?.unsubscribe();
    this.adminPresenceSubscription?.unsubscribe();
    this.chefStudentPresenceSubscription?.unsubscribe();
    this.broadcastSubscription = undefined;
    this.personalSubscription = undefined;
    this.adminPresenceSubscription = undefined;
    this.chefStudentPresenceSubscription = undefined;
    this.connectedToken = undefined;
    this.connectedRole = undefined;
    this.adminPresenceSubject.next([]);
    this.studentPresenceSubject.next([]);

    if (this.client) {
      void this.client.deactivate();
      this.client = undefined;
    }
  }

  private handleAlertMessage(message: IMessage): void {
    try {
      const alert: AlertMessage = JSON.parse(message.body) as AlertMessage;
      this.alertSubject.next(alert);
    } catch (error) {
      console.error('Invalid alert payload:', error);
    }
  }

  private handleAdminPresenceMessage(message: IMessage): void {
    try {
      const payload = JSON.parse(message.body) as UserPresenceSnapshot[];
      this.adminPresenceSubject.next(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error('Invalid admin presence payload:', error);
    }
  }

  private handleStudentPresenceMessage(message: IMessage): void {
    try {
      const payload = JSON.parse(message.body) as UserPresenceSnapshot[];
      this.studentPresenceSubject.next(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error('Invalid student presence payload:', error);
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

  private getBrokerUrl(): string {
    const configuredApiUrl = (environment.apiUrl || '').trim();

    if (!configuredApiUrl) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/ws-alerts/websocket`;
    }

    const wsProtocol = configuredApiUrl.startsWith('https://') ? 'wss://' : 'ws://';
    const host = configuredApiUrl.replace(/^https?:\/\//, '');
    return `${wsProtocol}${host}/ws-alerts/websocket`;
  }
}
