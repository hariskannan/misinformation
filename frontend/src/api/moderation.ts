import { api } from './client';
import type {
  ModerationQueueItem,
  ModerationReviewItem,
  ModerationStats,
  Paginated,
  Prediction,
  RiskLevel,
  UserReport,
} from '../types';

export const moderationApi = {
  async stats(): Promise<ModerationStats> {
    const { data } = await api.get<ModerationStats>('/api/moderation/stats/');
    return data;
  },

  async queue(params?: {
    page?: number;
    risk?: string;
    category?: string;
  }): Promise<Paginated<ModerationQueueItem>> {
    const { data } = await api.get<Paginated<ModerationQueueItem>>(
      '/api/moderation/queue/',
      { params },
    );
    return data;
  },

  async approve(
    id: number,
    remarks: string,
    newRiskLevel?: RiskLevel,
  ): Promise<{ detail: string }> {
    const { data } = await api.post(`/api/moderation/${id}/approve/`, {
      remarks,
      ...(newRiskLevel ? { new_risk_level: newRiskLevel } : {}),
    });
    return data;
  },

  async reject(id: number, remarks: string): Promise<{ detail: string }> {
    const { data } = await api.post(`/api/moderation/${id}/reject/`, { remarks });
    return data;
  },

  async setRisk(
    id: number,
    riskLevel: RiskLevel,
    remarks: string,
  ): Promise<{ detail: string; review: ModerationReviewItem; post: ModerationQueueItem }> {
    const { data } = await api.post(`/api/moderation/${id}/set-risk/`, {
      risk_level: riskLevel,
      remarks,
    });
    return data;
  },

  async moderatedPosts(params?: {
    page?: number;
    status?: string;
    risk?: string;
    search?: string;
  }): Promise<Paginated<ModerationQueueItem>> {
    const { data } = await api.get<Paginated<ModerationQueueItem>>(
      '/api/moderation/posts/',
      { params },
    );
    return data;
  },

  async reports(params?: {
    page?: number;
    status?: string;
  }): Promise<Paginated<UserReport>> {
    const { data } = await api.get<Paginated<UserReport>>(
      '/api/moderation/reports/',
      { params },
    );
    return data;
  },

  async resolveReport(
    id: number,
    action: 'resolve' | 'dismiss' | 'escalate',
    remarks: string,
  ): Promise<{ detail: string; report: UserReport }> {
    const { data } = await api.post(`/api/moderation/reports/${id}/resolve/`, {
      action,
      remarks,
    });
    return data;
  },

  async history(params?: {
    page?: number;
    mine?: string;
    action?: string;
  }): Promise<Paginated<ModerationReviewItem>> {
    const { data } = await api.get<Paginated<ModerationReviewItem>>(
      '/api/moderation/history/',
      { params },
    );
    return data;
  },

  async predictionDetails(postId: number): Promise<Prediction> {
    const { data } = await api.get<Prediction>(
      `/api/moderation/${postId}/prediction/`,
    );
    return data;
  },
};
