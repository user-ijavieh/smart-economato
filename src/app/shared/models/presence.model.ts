export interface PresenceUpdateRequest {
  screen: string;
  context?: string | null;
  heartbeat: boolean;
}

export interface UserPresenceSnapshot {
  username: string;
  displayName: string;
  role: 'ADMIN' | 'CHEF' | 'USER' | 'ELEVATED';
  userId: number;
  connectedSince: string;
  tabs: TabInfo[];
}

export interface TabInfo {
  sessionId: string;
  screen: string;
  screenContext?: string | null;
  lastActivityAt: string;
}
