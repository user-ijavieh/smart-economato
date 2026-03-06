import { Injectable } from '@angular/core';
import { Client, IMessage, ReconnectionTimeMode, StompSubscription } from '@stomp/stompjs';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

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
  private connectedToken?: string;
  private readonly alertSubject = new Subject<AlertMessage>();
  private readonly brokerUrl = this.getBrokerUrl();

  readonly alerts$: Observable<AlertMessage> = this.alertSubject.asObservable();

  connect(jwtToken: string): void {
    if (!jwtToken) {
      return;
    }

    if (this.client?.active && this.connectedToken === jwtToken) {
      return;
    }

    this.disconnect();
    this.connectedToken = jwtToken;

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
        
        // Suscripción a alertas broadcast (cambios en tiempo real)
        this.broadcastSubscription = this.client?.subscribe('/topic/alerts', (message: IMessage) => {
          this.handleAlertMessage(message);
        });
        
        // Suscripción a alertas personales (estado inicial al conectarse)
        this.personalSubscription = this.client?.subscribe('/user/queue/alerts', (message: IMessage) => {
          this.handleAlertMessage(message);
        });
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
    this.broadcastSubscription = undefined;
    this.personalSubscription = undefined;
    this.connectedToken = undefined;

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

  private getBrokerUrl(): string {
    const wsProtocol = environment.apiUrl.startsWith('https://') ? 'wss://' : 'ws://';
    const host = environment.apiUrl.replace(/^https?:\/\//, '');
    return `${wsProtocol}${host}/ws-alerts/websocket`;
  }
}
