export type RecipeDraftStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface RecipeDraftComponent {
  productId: number;
  quantity: number;
}

export interface RecipeDraftRequest {
  name: string;
  elaboration: string;
  presentation: string;
  portions: number;
  components: RecipeDraftComponent[];
  isHidden?: boolean;
  allergenIds?: number[];
}

export interface RecipeDraftRejectRequest {
  reason: string;
}

export interface RecipeDraft {
  id: number;
  name: string;
  elaboration?: string;
  presentation?: string;
  portions: number;
  components: RecipeDraftComponent[];
  allergenIds: number[];
  isHidden: boolean;
  status: RecipeDraftStatus;
  createdByName?: string;
  createdById?: number;
  reviewedByName?: string;
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
  reviewedAt?: string;
  approvedRecipeId?: number;
}