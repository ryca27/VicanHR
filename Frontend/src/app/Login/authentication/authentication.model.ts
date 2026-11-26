
export type UserRole =
  | 'admin'
  | 'hr'
  | 'finance'
  | 'operations';

export interface AuthUser {
  id?: number;
  username: string;
  role: UserRole;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  username: string;
  roles: string[];
  csrfToken: string;
}
