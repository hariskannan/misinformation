import { api } from './client';
import type {
  AlgorithmInfo,
  MLModelVersion,
  Paginated,
  TrainingJob,
} from '../types';

export const modelsApi = {
  async list(params?: {
    page?: number;
    algorithm?: string;
    status?: string;
  }): Promise<Paginated<MLModelVersion>> {
    const { data } = await api.get<Paginated<MLModelVersion>>('/api/models/', {
      params,
    });
    return data;
  },

  async algorithms(): Promise<{ results: AlgorithmInfo[] }> {
    const { data } = await api.get('/api/models/algorithms/');
    return data;
  },

  async train(payload: {
    dataset_version: number;
    algorithm: string;
    params?: Record<string, number>;
  }): Promise<TrainingJob> {
    const { data } = await api.post<TrainingJob>('/api/models/train/', payload);
    return data;
  },

  async trainingStatus(id: number): Promise<TrainingJob> {
    const { data } = await api.get<TrainingJob>(`/api/models/training-status/${id}/`);
    return data;
  },

  async trainingHistory(params?: { page?: number }): Promise<Paginated<TrainingJob>> {
    const { data } = await api.get<Paginated<TrainingJob>>(
      '/api/models/training-history/',
      { params },
    );
    return data;
  },

  async activate(id: number): Promise<MLModelVersion> {
    const { data } = await api.post<MLModelVersion>(`/api/models/${id}/activate/`);
    return data;
  },

  async deactivate(id: number): Promise<MLModelVersion> {
    const { data } = await api.post<MLModelVersion>(`/api/models/${id}/deactivate/`);
    return data;
  },

  async compare(params?: { ids?: string }): Promise<{ results: MLModelVersion[] }> {
    const { data } = await api.get('/api/models/compare/', { params });
    return data;
  },
};
