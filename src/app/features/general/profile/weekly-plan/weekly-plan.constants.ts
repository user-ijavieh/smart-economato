export interface WeekDayItem {
  value: number;
  label: string;
  shortLabel: string;
}

export const WEEK_DAYS: WeekDayItem[] = [
  { value: 1, label: 'Lunes', shortLabel: 'Lun' },
  { value: 2, label: 'Martes', shortLabel: 'Mar' },
  { value: 3, label: 'Miércoles', shortLabel: 'Mié' },
  { value: 4, label: 'Jueves', shortLabel: 'Jue' },
  { value: 5, label: 'Viernes', shortLabel: 'Vie' },
  { value: 6, label: 'Sábado', shortLabel: 'Sáb' },
  { value: 7, label: 'Domingo', shortLabel: 'Dom' }
];

export const WEEKLY_PLAN_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activa',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado'
};

export const SLOT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado'
};

export const STUDENT_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Asignado',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado'
};

export function getWeeklyPlanStatusClass(status: string): string {
  return `status-${status.toLowerCase().replaceAll('_', '-')}`;
}

export function getSlotStatusClass(status: string): string {
  return `slot-status-${status.toLowerCase().replaceAll('_', '-')}`;
}

export function formatLocalDate(dateValue: Date): string {
  const year = dateValue.getFullYear();
  const month = `${dateValue.getMonth() + 1}`.padStart(2, '0');
  const day = `${dateValue.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeWeekStartDate(input: string): string {
  if (!input) {
    return '';
  }

  const base = new Date(`${input}T00:00:00`);
  if (Number.isNaN(base.getTime())) {
    return input;
  }

  const dayIndex = base.getDay();
  const diffToMonday = (dayIndex + 6) % 7;
  base.setDate(base.getDate() - diffToMonday);
  return formatLocalDate(base);
}

export function timeToMinutes(time: string): number {
  if (!time || !time.includes(':')) {
    return 0;
  }

  const [hours, minutes] = time.split(':').map(value => Number(value));
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}
