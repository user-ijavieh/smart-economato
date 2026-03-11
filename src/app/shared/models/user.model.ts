export interface User {
  id: number;
  name: string;
  user: string;
  role: 'ADMIN' | 'CHEF' | 'USER' | 'ELEVATED';
  teacher?: User;
}

export interface UserRequest {
  name: string;
  password?: string;
  user: string;
  role: string;
}
