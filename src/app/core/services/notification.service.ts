import { Injectable, inject } from '@angular/core';
import { Client, IMessage, ReconnectionTimeMode, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { BehaviorSubject, Observable, Subject, distinctUntilChanged, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MessageService } from './message.service';
import { NotificationApiService, NotificationResponseDTO } from './notification-api.service';

export type AppRole = 'ADMIN' | 'CHEF' | 'ELEVATED' | 'USER';
export type RoleEscalationReason = 'MANUAL_GRANTED' | 'MANUAL_REVOKED' | 'AUTO_EXPIRED';
export type NotificationCode = 'FOOD_CRISIS_ACTIVATED' | 'FOOD_CRISIS_LIFTED' | 'ROLE_ESCALATION_CHANGED' | null;

export interface RoleNotificationMessage {
  title: string;
  message: string;
  code: NotificationCode;
  newRole?: AppRole;
  reason?: RoleEscalationReason | string;
  timestamp: string;
}

export interface SessionNotification extends RoleNotificationMessage {
  id: string;
  read: boolean;
  expanded: boolean;
  receivedAt: number;
}

interface PersistedSessionNotification extends SessionNotification {
  persistedId: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly messageService = inject(MessageService);
  private readonly notificationApiService = inject(NotificationApiService);

  private client?: Client;
  private roleSubscription?: StompSubscription;
  private adminRoleSubscription?: StompSubscription;
  private userSubscription?: StompSubscription;
  private connectedToken?: string;
  private connectedRole?: AppRole;

  private readonly incomingSubject = new Subject<RoleNotificationMessage>();
  private readonly notificationsSubject = new BehaviorSubject<SessionNotification[]>([]);

  private readonly maxNotifications = 50;

  readonly incoming$: Observable<RoleNotificationMessage> = this.incomingSubject.asObservable();
  readonly notifications$: Observable<SessionNotification[]> = this.notificationsSubject.asObservable();
  readonly unreadCount$: Observable<number> = this.notifications$.pipe(
    map(list => list.filter(n => !n.read).length),
    distinctUntilChanged()
  );

  connect(jwtToken: string, role: string | null): void {
    const normalizedRole = this.normalizeRole(role);
    if (!jwtToken || !normalizedRole) {
      return;
    }

    if (this.client?.active && this.connectedToken === jwtToken && this.connectedRole === normalizedRole) {
      return;
    }

    this.disconnect();
    this.connectedToken = jwtToken;
    this.connectedRole = normalizedRole;

    this.client = new Client({
      webSocketFactory: () => {
        // Backend endpoint is registered with SockJS; use the same transport on all browsers.
        return new SockJS(this.getSockJsUrl());
      },
      connectHeaders: {
        Authorization: `Bearer ${jwtToken}`
      },
      beforeConnect: async () => {
        const freshToken = localStorage.getItem('auth_token');
        if (!freshToken) {
          throw new Error('Missing auth token for notifications WebSocket');
        }

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
        this.roleSubscription?.unsubscribe();
        this.adminRoleSubscription?.unsubscribe();
        this.userSubscription?.unsubscribe();

        const roleDestination = `/topic/roles/${normalizedRole}`;
        this.roleSubscription = this.client?.subscribe(roleDestination, (message: IMessage) => {
          this.handleNotificationMessage(message);
        });

        if (normalizedRole === 'ADMIN') {
          const adminDestination = '/topic/roles/ADMIN';
          if (adminDestination !== roleDestination) {
            this.adminRoleSubscription = this.client?.subscribe(adminDestination, (message: IMessage) => {
              this.handleNotificationMessage(message);
            });
          }
        }

        this.userSubscription = this.client?.subscribe('/user/queue/notifications', (message: IMessage) => {
          this.handleNotificationMessage(message);
        });

        this.loadPersistedNotifications();
      },
      onStompError: frame => {
        const message = frame.headers['message'] || frame.body || '';
        console.error('Notification STOMP error:', message);

        if (/unauthorized|jwt|401/i.test(message)) {
          this.disconnect();
        }
      },
      onWebSocketClose: closeEvent => {
        if (closeEvent.code !== 1000) {
          console.warn('Notification websocket closed unexpectedly:', closeEvent.reason || closeEvent.code);
        }
      },
      onWebSocketError: event => {
        console.error('Notification websocket transport error:', event);
      }
    });

    this.client.activate();
  }

  disconnect(): void {
    this.roleSubscription?.unsubscribe();
    this.adminRoleSubscription?.unsubscribe();
    this.userSubscription?.unsubscribe();
    this.roleSubscription = undefined;
    this.adminRoleSubscription = undefined;
    this.userSubscription = undefined;
    this.connectedToken = undefined;
    this.connectedRole = undefined;

    if (this.client) {
      void this.client.deactivate();
      this.client = undefined;
    }
  }

  markAsRead(id: string): void {
    const current = this.notificationsSubject.value;
    const target = current.find(item => item.id === id);

    if (!target) {
      return;
    }

    const next = current.map(item => (item.id === id ? { ...item, read: true } : item));
    this.notificationsSubject.next(next);

    const persistedId = this.extractPersistedId(target.id);
    if (persistedId === null) {
      return;
    }

    this.notificationApiService.markAsRead(persistedId).subscribe({
      error: () => {
        this.notificationsSubject.next(current);
      }
    });
  }

  markAllAsRead(): void {
    const current = this.notificationsSubject.value;
    if (current.length === 0) {
      return;
    }

    this.notificationsSubject.next(current.map(item => ({ ...item, read: true })));

    this.notificationApiService.markAllAsRead().subscribe({
      error: () => {
        this.notificationsSubject.next(current);
      }
    });
  }

  refreshNotifications(): void {
    this.loadPersistedNotifications();
  }

  toggleExpanded(id: string): void {
    this.notificationsSubject.next(
      this.notificationsSubject.value.map(item =>
        item.id === id ? { ...item, expanded: !item.expanded } : item
      )
    );
  }

  private handleNotificationMessage(message: IMessage): void {
    try {
      const parsed = JSON.parse(message.body) as Partial<RoleNotificationMessage>;
      const normalized = this.normalizePayload(parsed);
      if (!normalized) {
        return;
      }

      const sessionItem: SessionNotification = {
        ...normalized,
        id: this.buildNotificationId(normalized),
        read: false,
        expanded: false,
        receivedAt: Date.now()
      };

      this.notificationsSubject.next([sessionItem, ...this.notificationsSubject.value].slice(0, this.maxNotifications));
      this.incomingSubject.next(normalized);
      this.showIncomingToast(normalized);
    } catch (error) {
      console.error('Invalid notification payload:', error);
    }
  }

  private loadPersistedNotifications(): void {
    this.notificationApiService.getMyNotifications().subscribe({
      next: page => {
        const current = this.notificationsSubject.value;
        const sessionOnly = current.filter(item => this.extractPersistedId(item.id) === null);
        const persisted = page.content.map(notification => this.mapPersistedNotification(notification));

        const merged = [...sessionOnly, ...persisted]
          .sort((a, b) => b.receivedAt - a.receivedAt)
          .slice(0, this.maxNotifications);

        this.notificationsSubject.next(merged);
      },
      error: error => {
        console.warn('Could not load persisted notifications:', error);
      }
    });
  }

  private mapPersistedNotification(notification: NotificationResponseDTO): SessionNotification {
    const isRead = notification.isRead ?? notification.read ?? false;

    return {
      id: notification.id.toString(),
      title: notification.title?.trim() || 'Notificación',
      message: notification.message,
      code: this.mapNotificationTypeToCode(notification.type),
      timestamp: this.normalizeTimestamp(notification.createdAt),
      read: isRead,
      expanded: false,
      receivedAt: new Date(notification.createdAt).getTime() || Date.now()
    };
  }

  private extractPersistedId(id: string): number | null {
    return /^\d+$/.test(id) ? Number(id) : null;
  }

  private mapNotificationTypeToCode(type: string): NotificationCode {
    if (type === 'FOOD_CRISIS_ACTIVATED' || type === 'FOOD_CRISIS_LIFTED' || type === 'ROLE_ESCALATION_CHANGED') {
      return type;
    }

    return null;
  }

  private showIncomingToast(notification: RoleNotificationMessage): void {
    const title = notification.title?.trim() || 'Notificación';

    if (notification.code === 'FOOD_CRISIS_ACTIVATED') {
      this.messageService.showError(notification.message, undefined, {
        title,
        persistent: true
      });
      this.playCrisisTone();
      return;
    }

    if (notification.code === 'FOOD_CRISIS_LIFTED') {
      this.messageService.showSuccess(notification.message, undefined, {
        title,
        persistent: true
      });
      return;
    }

    if (notification.code === 'ROLE_ESCALATION_CHANGED') {
      this.messageService.showInfo(notification.message, 9000, {
        title,
        persistent: true
      });
      return;
    }

    this.messageService.showInfo(notification.message, 8000, { title });
  }

  private playCrisisTone(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        return;
      }

      const audioContext = new AudioContextClass();
      const now = audioContext.currentTime;

      const gain = audioContext.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      gain.connect(audioContext.destination);

      const oscillator = audioContext.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(880, now);
      oscillator.frequency.setValueAtTime(740, now + 0.18);
      oscillator.connect(gain);
      oscillator.start(now);
      oscillator.stop(now + 0.35);

      oscillator.onended = () => {
        void audioContext.close();
      };
    } catch (error) {
      console.warn('Could not play notification tone:', error);
    }
  }

  private normalizePayload(payload: Partial<RoleNotificationMessage>): RoleNotificationMessage | null {
    if (!payload || !payload.message) {
      return null;
    }

    const code = payload.code === 'FOOD_CRISIS_ACTIVATED' ||
      payload.code === 'FOOD_CRISIS_LIFTED' ||
      payload.code === 'ROLE_ESCALATION_CHANGED'
      ? payload.code
      : null;
    const newRole = this.normalizeRole(payload.newRole ?? null) ?? undefined;

    const timestamp = this.normalizeTimestamp(payload.timestamp);

    return {
      title: payload.title?.trim() || 'Notificación',
      message: payload.message,
      code,
      newRole,
      reason: payload.reason,
      timestamp
    };
  }

  private normalizeTimestamp(rawTimestamp?: string): string {
    if (!rawTimestamp) {
      return new Date().toISOString();
    }

    const parsedDate = new Date(rawTimestamp);
    if (Number.isNaN(parsedDate.getTime())) {
      return new Date().toISOString();
    }

    return parsedDate.toISOString();
  }

  private normalizeRole(role: string | null): AppRole | null {
    switch (role) {
      case 'ADMIN':
      case 'CHEF':
      case 'ELEVATED':
      case 'USER':
        return role;
      default:
        return null;
    }
  }

  private buildNotificationId(notification: RoleNotificationMessage): string {
    return `${notification.timestamp}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private getSockJsUrl(): string {
    const configuredApiUrl = (environment.apiUrl || '').trim();

    if (!configuredApiUrl) {
      return `${window.location.origin}/ws-notifications`;
    }

    return `${configuredApiUrl.replace(/\/$/, '')}/ws-notifications`;
  }

}
