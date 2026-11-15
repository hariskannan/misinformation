import axios from 'axios';
import { api, API_BASE_URL } from './client';
import type {
  ActivityPoint,
  ModerationStatsAnalytics,
  ModelPerformanceRow,
  OverviewStats,
  PublicStats,
} from '../types';

export interface RiskDistributionRow {
  risk_level: string;
  count: number;
  label: string;
}

export const analyticsApi = {
  async overview(params?: { start?: string; end?: string }): Promise<OverviewStats> {
    const { data } = await api.get<OverviewStats>('/api/analytics/overview/', {
      params,
    });
    return data;
  },

  async riskDistribution(params?: {
    start?: string;
    end?: string;
  }): Promise<{ results: RiskDistributionRow[] }> {
    const { data } = await api.get('/api/analytics/risk-distribution/', { params });
    return data;
  },

  async activity(params?: {
    days?: number;
    bucket?: 'daily' | 'weekly' | 'monthly';
  }): Promise<{ bucket: string; days: number; results: ActivityPoint[] }> {
    const { data } = await api.get('/api/analytics/activity/', { params });
    return data;
  },

  async moderationStats(params?: {
    start?: string;
    end?: string;
  }): Promise<ModerationStatsAnalytics> {
    const { data } = await api.get('/api/analytics/moderation-stats/', { params });
    return data;
  },

  async modelPerformance(): Promise<{ results: ModelPerformanceRow[] }> {
    const { data } = await api.get('/api/analytics/model-performance/');
    return data;
  },

  async exportUrl(type: 'overview' | 'posts'): Promise<Blob> {
    const { data } = await api.get(`/api/analytics/export/`, {
      params: { type },
      responseType: 'blob',
    });
    return data as Blob;
  },

  async publicStats(): Promise<PublicStats> {
    const { data } = await axios.get<PublicStats>(
      `${API_BASE_URL}/api/public/stats/`,
    );
    return data;
  },
};
