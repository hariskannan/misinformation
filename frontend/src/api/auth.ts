import { api } from './client';
import type { User } from '../types';

export interface AuthTokens {
  access: string;
  refresh: string;
  user: User;
}

export const authApi = {
  async login(identifier: string, password: string): Promise<AuthTokens> {
    const { data } = await api.post<AuthTokens>('/api/auth/login/', {
      identifier,
      password,
    });
    return data;
  },

  async register(payload: {
    full_name: string;
    username: string;
    email: string;
    department?: string;
    password: string;
    password2: string;
  }): Promise<AuthTokens> {
    const { data } = await api.post<AuthTokens>('/api/auth/register/', payload);
    return data;
  },

  async logout(refresh: string): Promise<void> {
    await api.post('/api/auth/logout/', { refresh });
  },

  async profile(): Promise<User> {
    const { data } = await api.get<User>('/api/auth/profile/');
    return data;
  },

  async updateProfile(payload: {
    full_name?: string;
    department?: string;
    bio?: string;
  }): Promise<User> {
    const { data } = await api.patch<User>('/api/auth/profile/', payload);
    return data;
  },

  async changePassword(old_password: string, new_password: string): Promise<void> {
    await api.post('/api/auth/change-password/', {
      old_password,
      new_password,
      new_password2: new_password,
    });
  },
};
