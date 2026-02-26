export interface MediaModel {
  id: number;
  media_path: string | null;
  media_name: string | null;
  type: 'image' | 'video';
  created_at?: string;
  // Computed properties for UI
  size?: number;
  url?: string;
}
