export interface User {
  id: number;
  name: string;
  user: string;
  role: 'ADMIN' | 'CHEF' | 'USER';
}

export interface UserRequest {
  name: string;
  password: string;
  user: string;
  role: string;
}
