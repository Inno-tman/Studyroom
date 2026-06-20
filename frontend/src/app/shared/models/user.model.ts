export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  role: string;
  token: string;
  expiresAt: string;
}

export interface RegisterDto {
  username: string;
  email: string;
  password: string;
}

export interface LoginDto {
  username: string;
  password: string;
}
