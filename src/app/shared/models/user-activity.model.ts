import { Page } from './page.model';

export interface UserActivityLogResponse {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  action: 'CONNECTED' | 'DISCONNECTED' | 'SCREEN_CHANGED' | string;
  screen?: string;
  screenContext?: string;
  sessionId?: string;
  timestamp: string;
}

export type UserActivityPage = Page<UserActivityLogResponse>;
