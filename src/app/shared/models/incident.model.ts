export type IncidentStatus = 'CREADO' | 'ABIERTO' | 'CERRADO_CON_RESOLUCION' | 'CERRADO_SIN_RESOLUCION';
export type IncidentSeverity = 'ALTA' | 'MEDIA' | 'BAJA';

export interface UserSummary {
  id: number;
  name: string;
  user?: string;
  role?: string;
}

export interface IncidentType {
  id: number;
  name: string;
  description?: string | null;
  active?: boolean;
  isActive?: boolean;
}

export interface IncidentAuditAttachment {
  id: number;
  cookingAuditId: number;
  recipeName?: string | null;
  cookingDate?: string | null;
  userName?: string | null;
  quantityCooked?: number | string | null;
  reverted: boolean;
  revertedAt?: string | null;
}

export interface IncidentChatMessage {
  id: number;
  authorId: number;
  authorName: string;
  authorRole: string;
  content?: string | null;
  hasAttachment: boolean;
  attachmentUrl?: string | null;
  attachmentFilename?: string | null;
  attachmentContentType?: string | null;
  createdAt: string;
}

export interface IncidentListItem {
  id: number;
  incidentType: IncidentType;
  title: string;
  status: IncidentStatus;
  severity?: IncidentSeverity | null;
  createdBy: UserSummary;
  relatedTeacher?: UserSummary | null;
  createdAt: string;
  chatMessageCount: number;
}

export interface IncidentDetail extends IncidentListItem {
  description: string;
  resolution?: string | null;
  openedAt?: string | null;
  openedBy?: UserSummary | null;
  closedAt?: string | null;
  closedBy?: UserSummary | null;
  attachedAudits: IncidentAuditAttachment[];
}

export interface IncidentTypeRequest {
  name: string;
  description?: string | null;
}

export interface CreateIncidentRequest {
  incidentTypeId: number;
  title: string;
  description: string;
  cookingAuditIds?: number[];
}

export interface OpenIncidentRequest {
  severity: IncidentSeverity;
}

export interface CloseIncidentRequest {
  hasResolution: boolean;
  resolution?: string | null;
}

export interface AttachAuditRequest {
  cookingAuditIds: number[];
}

export interface RevertAuditFromIncidentRequest {
  auditAttachmentId: number;
  reason: string;
}

export interface RecipeCookingAudit {
  id: number;
  recipeId?: number;
  recipeName: string;
  userId?: number;
  userName?: string;
  quantityCooked?: number | string | null;
  details?: string | null;
  cookingDate?: string | null;
}

export interface IncidentFilters {
  status?: IncidentStatus | '';
  severity?: IncidentSeverity | '';
  incidentTypeId?: number | '';
  createdById?: number | '';
  from?: string;
  to?: string;
  page?: number;
  size?: number;
  sort?: string[];
}

export const INCIDENT_STATUS_OPTIONS: Array<{ value: IncidentStatus | ''; label: string }> = [
  { value: '', label: 'Todos los estados' },
  { value: 'CREADO', label: 'Creada' },
  { value: 'ABIERTO', label: 'Abierta' },
  { value: 'CERRADO_CON_RESOLUCION', label: 'Cerrada con resolución' },
  { value: 'CERRADO_SIN_RESOLUCION', label: 'Cerrada sin resolución' }
];

export const INCIDENT_SEVERITY_OPTIONS: Array<{ value: IncidentSeverity | ''; label: string }> = [
  { value: '', label: 'Todas las severidades' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'MEDIA', label: 'Media' },
  { value: 'BAJA', label: 'Baja' }
];

export function incidentTypeIsActive(type: IncidentType | null | undefined): boolean {
  return Boolean(type && (type.active ?? type.isActive ?? false));
}

export function isIncidentClosed(status: IncidentStatus | null | undefined): boolean {
  return status === 'CERRADO_CON_RESOLUCION' || status === 'CERRADO_SIN_RESOLUCION';
}