// Shared TypeScript types mirroring the Django REST API payloads.

export type Role = 'user' | 'moderator' | 'admin';
export type RiskLevel = 'low' | 'medium' | 'high';
export type PostStatus = 'published' | 'pending_review' | 'approved' | 'rejected';

export interface Profile {
  full_name: string;
  department: string;
  bio: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  is_active: boolean;
  date_joined: string;
  profile: Profile;
  posts_count?: number;
  last_login?: string | null;
}

export interface PredictionModel {
  id: number;
  name: string;
  algorithm: string;
  algorithm_display?: string;
  version_tag: string;
  trained_at: string;
  accuracy?: number | null;
  f1_score?: number | null;
}

export interface Prediction {
  id: number;
  post_id?: number | null;
  input_text?: string;
  predicted_label: string;
  predicted_label_display: string;
  risk_level: RiskLevel;
  confidence: number;
  probabilities: Record<string, number>;
  model: PredictionModel;
  created_at: string;
  limitations: string;
}

export interface PostAuthor {
  id: number;
  username: string;
  full_name: string;
  department: string;
}

export interface Post {
  id: number;
  title: string;
  content: string;
  category: string;
  image: string | null;
  status: PostStatus;
  risk_level: '' | RiskLevel;
  created_at: string;
  updated_at: string;
  author: PostAuthor;
  prediction: Prediction | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  reported_by_me?: boolean;
  reports_count?: number | null;
  comments?: CommentItem[];
  moderation_remarks?: {
    action: string;
    remarks: string;
    moderator: string;
    created_at: string;
  } | null;
}

export interface CommentItem {
  id: number;
  author: PostAuthor;
  content: string;
  created_at: string;
}

export interface AppNotification {
  id: number;
  notification_type: string;
  verb: string;
  message: string;
  actor_username: string | null;
  post: number | null;
  is_read: boolean;
  created_at: string;
}

export interface UserReport {
  id: number;
  post_id: number;
  post_title: string;
  post_content: string;
  post_status: PostStatus;
  post_risk_level: '' | RiskLevel;
  post_author: string;
  reason: string;
  details: string;
  status: 'open' | 'in_review' | 'resolved' | 'dismissed';
  resolution_remarks: string;
  reporter_username: string;
  resolved_by_username: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface DatasetVersion {
  id: number;
  version_number: number;
  original_filename: string;
  file_format: string;
  status: 'raw' | 'validated';
  status_display: string;
  row_count: number;
  column_count: number;
  text_column: string;
  label_column: string;
  label_mapping: Record<string, string>;
  stats: Record<string, unknown>;
  notes: string;
  created_by_username: string | null;
  created_at: string;
  updated_at: string;
}

export interface Dataset {
  id: number;
  name: string;
  description: string;
  source_url: string;
  license_notes: string;
  uploaded_by_username: string | null;
  created_at: string;
  updated_at: string;
  versions: DatasetVersion[];
  column_mappings: { id: number; original_label: string; mapped_label: string }[];
  latest_version: DatasetVersion | null;
}

export interface DatasetPreview {
  version_id: number;
  version_number: number;
  status: string;
  file_format: string;
  original_filename: string;
  row_count: number;
  column_count: number;
  columns: { name: string; dtype: string; non_null: number; missing: number; unique_values: number }[];
  sample_rows: Record<string, string | null>[];
  duplicate_rows: number;
  text_column: string;
  label_column: string;
  label_values: { value: string; count: number }[] | null;
  avg_text_length: number | null;
  label_mapping: Record<string, string>;
  stats: Record<string, unknown>;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  confusion_matrix: { labels: string[]; matrix: number[][] };
  classification_report: Record<string, Record<string, number> & { support?: number }>;
  class_distribution: Record<string, number>;
  test_size: number;
}

export interface MLModelVersion {
  id: number;
  name: string;
  algorithm: string;
  algorithm_display: string;
  version_tag: string;
  status: 'trained' | 'active' | 'deprecated';
  status_display: string;
  metrics: ModelMetrics | null;
  train_rows: number;
  test_rows: number;
  feature_count: number;
  training_duration_seconds: number;
  trained_at: string;
  trained_by_username: string | null;
  activated_at: string | null;
  activated_by_username: string | null;
  dataset: { id: number; version_number: number; status: string; row_count: number };
}

export interface TrainingJob {
  id: number;
  algorithm: string;
  algorithm_display: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  status_display: string;
  params: Record<string, number>;
  log: string;
  error_message: string;
  created_by_username: string | null;
  dataset: { id: number; version_number: number };
  model_version: MLModelVersion | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface AlgorithmInfo {
  key: string;
  label: string;
  description: string;
  params: Record<string, { default: number; min: number; max: number }>;
}

export interface ModerationStats {
  total_flagged: number;
  pending_reviews: number;
  approved_posts: number;
  rejected_posts: number;
  user_reports: number;
  open_reports: number;
  total_reviews: number;
}

export interface ModerationQueueItem {
  id: number;
  title: string;
  content: string;
  category: string;
  status: PostStatus;
  risk_level: RiskLevel;
  created_at: string;
  author_username: string;
  author_full_name: string;
  prediction: {
    id: number;
    predicted_label: string;
    risk_level: RiskLevel;
    confidence: number;
    probabilities: Record<string, number>;
    model: { name: string; algorithm: string; version_tag: string; trained_at: string };
    created_at: string;
  } | null;
  reports_count: number;
  latest_report_reasons: string[];
}

export interface ModerationReviewItem {
  id: number;
  post_id: number;
  post_title: string;
  post_content: string;
  post_status: PostStatus;
  post_risk_level: '' | RiskLevel;
  post_author: string;
  moderator_username: string;
  action: 'approved' | 'rejected';
  remarks: string;
  created_at: string;
}

export interface OverviewStats {
  users_total: number;
  users_by_role: Record<string, number>;
  posts_total: number;
  posts_published: number;
  posts_pending: number;
  posts_approved: number;
  posts_rejected: number;
  posts_low_risk: number;
  posts_medium_risk: number;
  posts_high_risk: number;
  predictions_total: number;
  predictions_by_risk: Record<string, number>;
  comments_total: number;
  likes_total: number;
  reports_total: number;
  reports_open: number;
  models_trained: number;
  training_jobs_total: number;
  reviews_total: number;
  active_model: {
    id: number;
    name: string;
    algorithm: string;
    version_tag: string;
    trained_at: string;
    metrics: ModelMetrics | null;
  } | null;
  range: { start: string | null; end: string | null };
}

export interface ActivityPoint {
  date: string;
  total: number;
  low: number;
  medium: number;
  high: number;
  new_users: number;
}

export interface ModelPerformanceRow {
  id: number;
  name: string;
  algorithm: string;
  algorithm_display: string;
  version_tag: string;
  status: string;
  dataset: string;
  trained_at: string;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  train_rows: number;
  test_rows: number;
  feature_count: number;
  training_duration_seconds: number;
}

export interface AuditLogItem {
  id: number;
  action: string;
  actor: number | null;
  actor_username: string | null;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface PublicStats {
  users_total: number;
  posts_total: number;
  predictions_total: number;
  models_trained: number;
  algorithms_available: number;
  active_model: { name: string; algorithm: string; trained_at: string } | null;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ModerationStatsAnalytics {
  approved: number;
  rejected: number;
  per_moderator: { moderator: string; count: number }[];
  report_stats: Record<string, number>;
}
