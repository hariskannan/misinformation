import { api } from './client';
import type { MLModelVersion, Prediction } from '../types';

export const predictionsApi = {
  async analyze(text: string): Promise<Prediction> {
    const { data } = await api.post<Prediction>('/api/predictions/analyze/', {
      text,
    });
    return data;
  },

  async getPrediction(id: number): Promise<Prediction> {
    const { data } = await api.get<Prediction>(`/api/predictions/${id}/`);
    return data;
  },

  async getActiveModel(): Promise<MLModelVersion | null> {
    try {
      const { data } = await api.get<MLModelVersion>('/api/predictions/active-model/');
      return data;
    } catch {
      return null;
    }
  },
};
