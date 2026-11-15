import { api } from './client';
import type { AuditLogItem, Paginated, User } from '../types';

export const adminApi = {
  async listUsers(params?: {
    page?: number;
    search?: string;
    role?: string;
  }): Promise<Paginated<User>> {
    const { data } = await api.get<Paginated<User>>('/api/admin/users/', {
      params,
    });
    return data;
  },

  async updateUser(
    id: number,
    payload: { role?: string; is_active?: boolean },
  ): Promise<User> {
    const { data } = await api.patch<User>(`/api/admin/users/${id}/`, payload);
    return data;
  },

  async resetUserPassword(
    id: number,
    new_password: string,
  ): Promise<{ detail: string }> {
    const { data } = await api.post(`/api/admin/users/${id}/reset-password/`, {
      new_password,
      new_password2: new_password,
    });
    return data;
  },

  async listAuditLogs(params?: {
    page?: number;
    action?: string;
    search?: string;
  }): Promise<Paginated<AuditLogItem>> {
    const { data } = await api.get<Paginated<AuditLogItem>>(
      '/api/admin/audit-logs/',
      { params },
    );
    return data;
  },
};
