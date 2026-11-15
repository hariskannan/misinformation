import { api } from './client';
import type { Dataset, DatasetPreview, Paginated } from '../types';

export interface DatasetValidationStats {
  rows_before: number;
  rows_after: number;
  missing_text: number;
  missing_label: number;
  missing_dropped: number;
  empty_text_dropped: number;
  unmapped_labels_dropped: number;
  unmapped_label_values: string[];
  duplicates_removed: number;
  class_distribution: Record<string, number>;
  avg_text_length: number;
  min_text_length: number;
  text_column: string;
  label_column: string;
}

export const datasetsApi = {
  async list(params?: { page?: number }): Promise<Paginated<Dataset>> {
    const { data } = await api.get<Paginated<Dataset>>('/api/datasets/', {
      params,
    });
    return data;
  },

  async upload(form: FormData): Promise<{
    dataset: Dataset;
    preview: DatasetPreview;
  }> {
    const { data } = await api.post('/api/datasets/upload/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async detail(id: number): Promise<Dataset> {
    const { data } = await api.get<Dataset>(`/api/datasets/${id}/`);
    return data;
  },

  async preview(id: number, version?: number): Promise<DatasetPreview> {
    const { data } = await api.get<DatasetPreview>(`/api/datasets/${id}/preview/`, {
      params: version ? { version } : undefined,
    });
    return data;
  },

  async validate(
    id: number,
    payload: {
      version?: number;
      text_column: string;
      label_column: string;
      label_mapping: Record<string, string>;
      drop_missing: boolean;
      drop_duplicates: boolean;
    },
  ): Promise<{ dataset: Dataset; stats: DatasetValidationStats }> {
    const { data } = await api.post(`/api/datasets/${id}/validate/`, payload);
    return data;
  },

  async remove(id: number): Promise<{ detail: string }> {
    const { data } = await api.delete(`/api/datasets/${id}/`);
    return data;
  },
};
