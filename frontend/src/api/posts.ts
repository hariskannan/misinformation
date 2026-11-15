import { api } from './client';
import type {
  AppNotification,
  CommentItem,
  Paginated,
  Post,
  Prediction,
  UserReport,
} from '../types';

export const postsApi = {
  async getFeed(params?: {
    page?: number;
    category?: string;
    risk?: string;
    search?: string;
  }): Promise<Paginated<Post>> {
    const { data } = await api.get<Paginated<Post>>('/api/posts/', { params });
    return data;
  },

  async getMyPosts(params?: { page?: number; status?: string }): Promise<Paginated<Post>> {
    const { data } = await api.get<Paginated<Post>>('/api/posts/mine/', { params });
    return data;
  },

  async getPost(id: number): Promise<Post> {
    const { data } = await api.get<Post>(`/api/posts/${id}/`);
    return data;
  },

  async createPost(form: FormData): Promise<Post> {
    const { data } = await api.post<Post>('/api/posts/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async deletePost(id: number): Promise<void> {
    await api.delete(`/api/posts/${id}/`);
  },

  async toggleLike(id: number): Promise<{ liked: boolean; like_count: number }> {
    const { data } = await api.post(`/api/posts/${id}/like/`);
    return data;
  },

  async getComments(id: number): Promise<{ count: number; results: CommentItem[] }> {
    const { data } = await api.get(`/api/posts/${id}/comments/`);
    return data;
  },

  async addComment(id: number, content: string): Promise<CommentItem> {
    const { data } = await api.post<CommentItem>(`/api/posts/${id}/comment/`, {
      content,
    });
    return data;
  },

  async reportPost(
    id: number,
    reason: string,
    details: string,
  ): Promise<UserReport> {
    const { data } = await api.post<UserReport>(`/api/posts/${id}/report/`, {
      reason,
      details,
    });
    return data;
  },

  async getMyReports(params?: { page?: number }): Promise<Paginated<UserReport>> {
    const { data } = await api.get<Paginated<UserReport>>('/api/reports/mine/', {
      params,
    });
    return data;
  },

  async getTrendingCategories(): Promise<{ results: { category: string; count: number }[] }> {
    const { data } = await api.get('/api/posts/categories/');
    return data;
  },

  async getRecentPredictions(): Promise<{ results: Prediction[] }> {
    const { data } = await api.get('/api/posts/my-recent-predictions/');
    return data;
  },

  async getNotifications(params?: {
    page?: number;
    unread?: string;
  }): Promise<Paginated<AppNotification>> {
    const { data } = await api.get<Paginated<AppNotification>>(
      '/api/notifications/',
      { params },
    );
    return data;
  },

  async getUnreadCount(): Promise<{ count: number }> {
    const { data } = await api.get('/api/notifications/unread-count/');
    return data;
  },

  async markNotificationRead(id: number): Promise<AppNotification> {
    const { data } = await api.post<AppNotification>(
      `/api/notifications/${id}/read/`,
    );
    return data;
  },

  async markAllNotificationsRead(): Promise<{ updated: number }> {
    const { data } = await api.post('/api/notifications/read-all/');
    return data;
  },
};
