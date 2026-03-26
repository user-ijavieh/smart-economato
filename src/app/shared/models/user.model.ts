export interface User {
  id: number;
  name: string;
  user: string;
  role: 'ADMIN' | 'CHEF' | 'USER' | 'ELEVATED';
  teacher?: UserTeacher | null;
  firstLogin?: boolean;
  hidden?: boolean;
}

export interface UserTeacher {
  id: number;
  name: string;
  user: string;
  role: string;
}

export interface UserRequest {
  name: string;
  password?: string;
  user: string;
  role: string;
}

export interface BatchAssignResponse {
  success: boolean;
  processedCount: number;
  totalCount: number;
  message: string;
  failedStudentIds: number[];
}
