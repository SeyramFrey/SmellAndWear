import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Image size presets for different contexts.
 * Use these for consistent optimization across the app.
 */
export const IMAGE_SIZES = {
  /** Cart thumbnail: 200px */
  CART_THUMBNAIL: 200,
  /** Product card thumbnail: 400px */
  PRODUCT_CARD: 400,
  /** Product detail main image: 800px */
  PRODUCT_DETAIL: 800,
  /** Gallery zoom image: 1200px */
  GALLERY_ZOOM: 1200,
  /** Hero banner: 1600px, use quality 85 */
  HERO_BANNER: 1600,
  /** Admin/small preview: 200px */
  ADMIN_PREVIEW: 200,
} as const;

/** Default storage bucket for product images */
export const DEFAULT_IMAGE_BUCKET = 'public-images';

/**
 * ImageService - Centralized image optimization for Supabase Storage.
 *
 * All images loaded from Supabase Storage are served via the image transformation
 * endpoint to provide:
 * - WEBP format for smaller file sizes
 * - Context-appropriate resizing
 * - Quality optimization
 *
 * URL format: {supabaseUrl}/storage/v1/render/image/public/{bucket}/{path}?format=webp&width={width}&quality={quality}
 */
@Injectable({
  providedIn: 'root'
})
export class ImageService {
  private readonly baseUrl: string;
  private readonly useTransformation: boolean;
  private readonly storageUrlPattern: RegExp;
  private readonly renderUrlPattern: RegExp;

  constructor() {
    this.baseUrl = (environment.supabase?.url || '').replace(/\/$/, '');
    this.useTransformation = environment.supabase?.imageTransformationEnabled === true;
    const escaped = this.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    this.storageUrlPattern = new RegExp(
      `${escaped}/storage/v1/object/public/([^/]+)/(.+?)(?:\\?|$)`
    );
    this.renderUrlPattern = new RegExp(
      `${escaped}/storage/v1/render/image/public/([^/]+)/(.+?)(?:\\?|$)`
    );
  }

  /**
   * Get raw public URL (works on all Supabase plans).
   */
  getRawPublicUrl(bucket: string, path: string): string {
    if (!this.baseUrl || !path?.trim()) return '';
    const cleanPath = path.replace(/^\//, '').trim();
    if (!cleanPath) return '';
    return `${this.baseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
  }


  getOptimizedImageUrl(
      bucket: string,
      path: string,
      width: number,
      quality: number = 95 // ✅ Qualité très haute pour garder la qualité originale
  ): string {
    if (!this.baseUrl || !path?.trim()) return '';

    const cleanPath = path.replace(/^\//, '').trim();
    if (!cleanPath) return '';

    if (!this.useTransformation) {
      return this.getRawPublicUrl(bucket, cleanPath);
    }

    // ✅ Juste la qualité, pas de redimensionnement
    const params = new URLSearchParams({
      quality: String(quality)
    });

    return `${this.baseUrl}/storage/v1/render/image/public/${bucket}/${cleanPath}?${params.toString()}`;
  }

  /**
   * Get optimized URL from a storage path (uses default bucket).
   */
  getOptimizedUrl(
    path: string,
    width: number = IMAGE_SIZES.PRODUCT_CARD,
    quality: number = 75,
    bucket: string = DEFAULT_IMAGE_BUCKET
  ): string {
    return this.getOptimizedImageUrl(bucket, path, width, quality);
  }

  /**
   * Resolve image URL: accepts storage path or full URL.
   * - Storage path (e.g. 'produits/xxx.jpg'): returns optimized URL
   * - Full Supabase storage URL: extracts path and returns optimized URL
   * - Other URLs (http, assets): returns as-is
   * - Empty: returns placeholder
   */
  resolveImageUrl(
    pathOrUrl: string | undefined | null,
    width?: number,
    quality: number = 95,
    bucket: string = DEFAULT_IMAGE_BUCKET,
    placeholder: string = '/assets/images/products/placeholder.jpg'
  ): string {
    if (!pathOrUrl?.trim()) return placeholder;

    const input = pathOrUrl.trim();

    if (input.startsWith('http')) {
      const optimized = this.tryOptimizeExistingSupabaseUrl(input, width, quality);
      return optimized || input;
    }

    if (input.startsWith('assets/') || input.startsWith('/assets/')) {
      return input.startsWith('/') ? input : `/${input}`;
    }

    const url = this.getOptimizedImageUrl(bucket, input, quality);
    return url || placeholder;
  }

  /**
   * If the URL is a Supabase storage public URL, return optimized version.
   */
  tryOptimizeExistingSupabaseUrl(
    url: string,
    width?: number,
    quality: number = 75
  ): string | null {
    const match = url.match(this.storageUrlPattern) || url.match(this.renderUrlPattern);
    if (!match) return null;

    const [, bucket, path] = match;
    const decodedPath = decodeURIComponent(path);
    if (!this.useTransformation) {
      return this.getRawPublicUrl(bucket, decodedPath);
    }
    return this.getOptimizedImageUrl(bucket, decodedPath, quality);
  }

  /**
   * Generate srcset for responsive images (e.g. 400w, 800w).
   */
  getSrcSet(
    bucket: string,
    path: string,
    widths: number[] = [400, 800],
    quality: number = 75
  ): string {
    if (!this.useTransformation) {
      return '';
    }
    return widths
      .map(w => `${this.getOptimizedImageUrl(bucket, path, w, quality)} ${w}w`)
      .join(', ');
  }
}
