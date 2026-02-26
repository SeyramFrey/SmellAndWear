import { Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { Observable, from, throwError, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { MediaModel } from '../../pages/media/medias/media.model';

export interface MediaUploadResult {
  data: MediaModel | null;
  error: string | null;
}

export interface UploadedFile {
  file: File;
  path?: string;
  url?: string;
  progress: number;
  uploading: boolean;
  error?: string;
}

export interface MediaListResult {
  data: MediaModel[];
  total: number;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  private supabaseClient: SupabaseClient;
  private mediasSubject = new BehaviorSubject<MediaModel[]>([]);
  public medias$ = this.mediasSubject.asObservable();

  constructor(private supabaseService: SupabaseService) {
    this.supabaseClient = this.supabaseService.getClient();
  }

  /**
   * Update media record directly (for admin operations)
   */
  async updateMediaRecord(mediaId: number, updateData: Partial<MediaModel>): Promise<MediaModel> {
    const { data, error } = await this.supabaseClient
      .from('media')
      .update(updateData)
      .eq('id', mediaId)
      .select()
      .single();

    if (error) {
      console.error('Media update error:', error);
      throw error;
    }

    // Generate URL if media_path is present
    const updatedMedia = data as MediaModel;
    if (updatedMedia.media_path) {
      const { data: urlData } = this.supabaseClient.storage
        .from('medias')
        .getPublicUrl(updatedMedia.media_path);
      updatedMedia.url = urlData.publicUrl;
    }

    return updatedMedia;
  }

  /**
   * Get all media files with pagination
   */
  getMedias(page: number = 0, limit: number = 20, searchTerm?: string): Observable<MediaListResult> {
    return from(this.fetchMedias(page, limit, searchTerm)).pipe(
      map(result => {
        if (result.data) {
          this.mediasSubject.next(result.data);
        }
        return result;
      }),
      catchError(error => {
        console.error('Error fetching medias:', error);
        return throwError(() => error);
      })
    );
  }

  private async fetchMedias(page: number, limit: number, searchTerm?: string): Promise<MediaListResult> {
    try {
      let query = this.supabaseClient
        .from('media')
        .select('*', { count: 'exact' })
        .order('id', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

      if (searchTerm && searchTerm.trim()) {
        query = query.or(`media_name.ilike.%${searchTerm}%,media_path.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      // Enhance media objects with computed properties
      const enhancedData = (data || []).map(media => this.enhanceMediaObject(media));

      return {
        data: enhancedData,
        total: count || 0,
        error: null
      };
    } catch (error: any) {
      return {
        data: [],
        total: 0,
        error: error.message || 'Failed to fetch medias'
      };
    }
  }

  /**
   * Get media by ID
   */
  getMediaById(id: number): Observable<MediaModel | null> {
    return from(this.fetchMediaById(id)).pipe(
      catchError(error => {
        console.error('Error fetching media by ID:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get media by name
   */
  getMediaByName(mediaName: string): Observable<MediaModel | null> {
    return from(this.fetchMediaByName(mediaName)).pipe(
      catchError(error => {
        console.error('Error fetching media by name:', error);
        return throwError(() => error);
      })
    );
  }

  private async fetchMediaById(id: number): Promise<MediaModel | null> {
    const { data, error } = await this.supabaseClient
      .from('media')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw error;
    }

    return data ? this.enhanceMediaObject(data) : null;
  }

  private async fetchMediaByName(mediaName: string): Promise<MediaModel | null> {
    const { data, error } = await this.supabaseClient
      .from('media')
      .select('*')
      .eq('media_name', mediaName)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      throw error;
    }

    return data ? this.enhanceMediaObject(data) : null;
  }

  /**
   * Upload file to storage and create media record (legacy method)
   */
  uploadMedia(file: File, bucket: string = 'medias'): Observable<MediaUploadResult> {
    return from(this.performUpload(file, bucket)).pipe(
      tap(result => {
        if (result.data) {
          // Update local state
          const currentMedias = this.mediasSubject.value;
          this.mediasSubject.next([result.data, ...currentMedias]);
        }
      }),
      catchError(error => {
        console.error('Error uploading media:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Upload files with progress tracking (optimized version from variants-list)
   */
  async uploadFilesWithProgress(files: UploadedFile[], bucket: string = 'medias'): Promise<string[]> {
    const uploadPromises: Promise<string>[] = [];
    
    for (const uploadedFile of files) {
      uploadedFile.uploading = true;
      uploadedFile.progress = 0;
      
      const fileName = `media_${Date.now()}_${uploadedFile.file.name}`;
      const filePath = `public_images/${fileName}`;
      
      const uploadPromise = this.supabaseClient.storage
        .from(bucket)
        .upload(filePath, uploadedFile.file, {
          cacheControl: '3600',
          upsert: false
        })
        .then(({ data, error }) => {
          if (error) {
            uploadedFile.error = error.message;
            throw error;
          }
          
          uploadedFile.path = data.path;
          uploadedFile.progress = 100;
          uploadedFile.uploading = false;
          
          // Get public URL
          const { data: urlData } = this.supabaseClient.storage
            .from(bucket)
            .getPublicUrl(data.path);
          
          uploadedFile.url = urlData.publicUrl;

          console.log(uploadedFile);
          
          return urlData.publicUrl;
        })
        .catch(error => {
          uploadedFile.uploading = false;
          uploadedFile.error = error.message;
          throw error;
        });
      
      uploadPromises.push(uploadPromise);
    }
    
    return Promise.all(uploadPromises);
  }

  /**
   * Upload single file and create database record
   */
  async uploadFileToStorage(uploadedFile: UploadedFile, bucket: string = 'medias', mediaName?: string): Promise<MediaModel | null> {
    try {
      // Upload to storage
      const urls = await this.uploadFilesWithProgress([uploadedFile], bucket);
      
      if (urls.length === 0 || !uploadedFile.path) {
        throw new Error('Upload failed');
      }

      const finalMediaName = mediaName || uploadedFile.file.name;

      // Check if media with this name already exists
      const existingMedia = await this.fetchMediaByName(finalMediaName);
      
      let mediaData;
      if (existingMedia) {
        // Update existing media record
        const { data: updateData, error: updateError } = await this.supabaseClient
          .from('media')
          .update({
            media_path: uploadedFile.path,
            type: this.detectMediaType(uploadedFile.file)
          })
          .eq('media_name', finalMediaName)
          .select()
          .single();

        if (updateError) {
          // Clean up uploaded file if database update fails
          await this.supabaseClient.storage
            .from(bucket)
            .remove([uploadedFile.path]);
          throw updateError;
        }
        
        // Clean up old file if it exists
        if (existingMedia.media_path) {
          await this.supabaseClient.storage
            .from(bucket)
            .remove([existingMedia.media_path]);
        }
        
        mediaData = updateData;
      } else {
        // Create new media record
        const { data: insertData, error: insertError } = await this.supabaseClient
          .from('media')
          .insert({
            media_path: uploadedFile.path,
            media_name: finalMediaName,
            type: this.detectMediaType(uploadedFile.file)
          })
          .select()
          .single();

        if (insertError) {
          // Clean up uploaded file if database insert fails
          await this.supabaseClient.storage
            .from(bucket)
            .remove([uploadedFile.path]);
          throw insertError;
        }
        
        mediaData = insertData;
      }

      const enhancedMedia = this.enhanceMediaObject(mediaData);
      
      // Update local state
      const currentMedias = this.mediasSubject.value;
      if (existingMedia) {
        // Replace existing media in the list
        const index = currentMedias.findIndex(m => m.id === enhancedMedia.id);
        if (index !== -1) {
          currentMedias[index] = enhancedMedia;
          this.mediasSubject.next([...currentMedias]);
        }
      } else {
        // Add new media to the list
        this.mediasSubject.next([enhancedMedia, ...currentMedias]);
      }
      
      return enhancedMedia;
    } catch (error: any) {
      console.error('Upload failed:', error);
      uploadedFile.error = error.message;
      return null;
    }
  }

  private async performUpload(file: File, bucket: string): Promise<MediaUploadResult> {
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `media_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `public_images/${fileName}`;

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await this.supabaseClient.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // Create media record in database
      const { data: mediaData, error: dbError } = await this.supabaseClient
        .from('media')
        .insert({
          media_path: uploadData.path,
          media_name: file.name,
          type: this.detectMediaType(file)
        })
        .select()
        .single();

      if (dbError) {
        // Clean up uploaded file if database insert fails
        await this.supabaseClient.storage
          .from(bucket)
          .remove([uploadData.path]);
        throw dbError;
      }

      return {
        data: this.enhanceMediaObject(mediaData),
        error: null
      };
    } catch (error: any) {
      return {
        data: null,
        error: error.message || 'Failed to upload media'
      };
    }
  }

  /**
   * Delete media file and record
   */
  deleteMedia(id: number, bucket: string = 'medias'): Observable<boolean> {
    return from(this.performDelete(id, bucket)).pipe(
      tap(success => {
        if (success) {
          // Update local state
          const currentMedias = this.mediasSubject.value;
          this.mediasSubject.next(currentMedias.filter(media => media.id !== id));
        }
      }),
      catchError(error => {
        console.error('Error deleting media:', error);
        return throwError(() => error);
      })
    );
  }

  private async performDelete(id: number, bucket: string): Promise<boolean> {
    try {
      // Get media record first
      const media = await this.fetchMediaById(id);
      if (!media || !media.media_path) {
        throw new Error('Media not found');
      }

      // Delete from storage
      const { error: storageError } = await this.supabaseClient.storage
        .from(bucket)
        .remove([media.media_path]);

      if (storageError) {
        console.warn('Failed to delete from storage:', storageError.message);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database
      const { error: dbError } = await this.supabaseClient
        .from('media')
        .delete()
        .eq('id', id);

      if (dbError) {
        throw dbError;
      }

      return true;
    } catch (error: any) {
      console.error('Delete operation failed:', error);
      return false;
    }
  }

  /**
   * Get public URL for media file
   */
  getMediaUrl(path: string, bucket: string = 'medias'): string | null {
    if (!path) return null;

    const { data } = this.supabaseClient.storage
      .from(bucket)
      .getPublicUrl(path);

    return data?.publicUrl || null;
  }

  /**
   * Detect media type from file
   */
  private detectMediaType(file: File): 'image' | 'video' {
    const mimeType = file.type.toLowerCase();
    if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType.startsWith('video/')) {
      return 'video';
    }
    
    // Fallback to file extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    const videoExtensions = ['mp4', 'webm', 'ogg', 'avi', 'mov', 'wmv', 'flv'];
    
    if (extension && imageExtensions.includes(extension)) {
      return 'image';
    } else if (extension && videoExtensions.includes(extension)) {
      return 'video';
    }
    
    // Default to image if uncertain
    return 'image';
  }

  /**
   * Get file type based on extension
   */
  getFileType(filename: string): string {
    if (!filename) return 'unknown';

    const ext = filename.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'svg':
        return 'image';
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'wmv':
      case 'webm':
        return 'video';
      case 'mp3':
      case 'wav':
      case 'flac':
      case 'ogg':
        return 'audio';
      case 'pdf':
        return 'pdf';
      case 'doc':
      case 'docx':
        return 'document';
      case 'zip':
      case 'rar':
      case '7z':
        return 'archive';
      default:
        return 'file';
    }
  }

  /**
   * Enhance media object with computed properties
   */
  private enhanceMediaObject(media: any): MediaModel {
    const enhanced: MediaModel = {
      id: media.id,
      media_path: media.media_path,
      media_name: media.media_name,
      type: media.type || 'image', // Use database type or default to image
      created_at: media.created_at
    };

    // Add computed URL if path exists
    if (enhanced.media_path) {
      enhanced.url = this.getMediaUrl(enhanced.media_path)!;
    }

    return enhanced;
  }

  /**
   * Refresh media list
   */
  refreshMedias(): void {
    this.getMedias(0, 20).subscribe();
  }

  /**
   * Check if user can upload files (implement your authorization logic)
   */
  canUpload(): boolean {
    // Add your authorization logic here
    // For now, allow all uploads
    return true;
  }

  /**
   * Check if user can delete files (implement your authorization logic)
   */
  canDelete(): boolean {
    // Add your authorization logic here
    // For now, allow all deletions
    return true;
  }

  /**
   * Create UploadedFile object from File
   */
  createUploadedFile(file: File): UploadedFile {
    return {
      file,
      progress: 0,
      uploading: false
    };
  }
}
