export interface User {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'CHEF' | 'USER';
}

export interface UserRequest {
  name: string;
  password: string;
  email: string;
  role: string;
}
