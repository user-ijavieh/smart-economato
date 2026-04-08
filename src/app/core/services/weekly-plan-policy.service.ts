import { Injectable } from '@angular/core';
import { Role } from '../../shared/models/role-permissions';
import { WeeklyPlanResponse } from '../../shared/models/weekly-plan.model';

@Injectable({ providedIn: 'root' })
export class WeeklyPlanPolicyService {
  canCreate(role: Role | null): boolean {
    return role === 'ADMIN' || role === 'CHEF';
  }

  canEdit(role: Role | null, plan: WeeklyPlanResponse | null): boolean {
    if (!plan) {
      return false;
    }
    const canByRole = role === 'ADMIN' || role === 'CHEF' || role === 'ELEVATED';
    return canByRole && (plan.status === 'DRAFT' || plan.status === 'ACTIVE' || plan.status === 'IN_PROGRESS');
  }

  canDuplicate(role: Role | null, plan: WeeklyPlanResponse | null): boolean {
    if (!plan) {
      return false;
    }
    return (role === 'ADMIN' || role === 'CHEF') && plan.status !== 'CANCELLED';
  }

  canManageRuntime(role: Role | null, plan: WeeklyPlanResponse | null): boolean {
    if (!plan) {
      return false;
    }
    return (role === 'ADMIN' || role === 'CHEF' || role === 'ELEVATED')
      && (plan.status === 'ACTIVE' || plan.status === 'IN_PROGRESS');
  }

  canViewSensitive(role: Role | null): boolean {
    return role === 'ADMIN' || role === 'CHEF';
  }
}
