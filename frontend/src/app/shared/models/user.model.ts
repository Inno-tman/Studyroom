export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  firstName?: string;
  lastName?: string;
  schoolName?: string;
  bio?: string;
  role: string;
  profileComplete?: boolean;
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

export interface UpdateProfileDto {
  username: string;
  avatarUrl?: string;
  firstName?: string;
  lastName?: string;
  schoolName?: string;
  bio?: string;
}
