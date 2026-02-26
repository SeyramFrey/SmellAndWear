import { Injectable } from '@angular/core';
import { MediaService } from './media.service';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';

export interface LandingMediaUrls {
  'Page 1 Wear': string | null;
  'Page 1 Smell': string | null;
  'Choice Men': string | null;
  'Choice Women': string | null;
  'Wear Men Banniere': string | null;
  'Wear Men Video': string | null;
  'Sous Categorie Men Video': string | null;
  'All Categorie Video': string | null;
}

@Injectable({
  providedIn: 'root'
})
export class LandingMediaService {
  private mediaUrlsSubject = new BehaviorSubject<LandingMediaUrls>({
    'Page 1 Wear': null,
    'Page 1 Smell': null,
    'Choice Men': null,
    'Choice Women': null,
    'Wear Men Banniere': null,
    'Wear Men Video': null,
    'Sous Categorie Men Video': null,
    'All Categorie Video': null
  });

  public mediaUrls$ = this.mediaUrlsSubject.asObservable();
  private cache = new Map<string, Observable<string | null>>();

  constructor(private mediaService: MediaService) {
    this.loadAllMediaUrls();
  }

  /**
   * Load all media URLs at once for better performance
   */
  private loadAllMediaUrls(): void {
    const mediaNames = [
      'Page 1 Wear',
      'Page 1 Smell', 
      'Choice Men',
      'Choice Women',
      'Wear Men Banniere',
      'Wear Men Video',
      'Sous Categorie Men Video',
      'All Categorie Video'
    ];

    const currentUrls = this.mediaUrlsSubject.value;

    mediaNames.forEach(mediaName => {
      this.getMediaUrl(mediaName).subscribe(url => {
        currentUrls[mediaName as keyof LandingMediaUrls] = url;
        this.mediaUrlsSubject.next({ ...currentUrls });
      });
    });
  }

  /**
   * Get media URL by name with caching
   */
  getMediaUrl(mediaName: string): Observable<string | null> {
    if (this.cache.has(mediaName)) {
      return this.cache.get(mediaName)!;
    }

    const url$ = this.mediaService.getMediaByName(mediaName).pipe(
      map(media => {
        if (media && media.media_path) {
          return this.mediaService.getMediaUrl(media.media_path);
        }
        return null;
      }),
      catchError(error => {
        console.warn(`Failed to load media "${mediaName}":`, error);
        return of(null);
      }),
      shareReplay(1) // Cache the result
    );

    this.cache.set(mediaName, url$);
    return url$;
  }

  /**
   * Get media URL synchronously from cache
   */
  getMediaUrlSync(mediaName: string): string | null {
    const currentUrls = this.mediaUrlsSubject.value;
    return currentUrls[mediaName as keyof LandingMediaUrls] || null;
  }

  /**
   * Refresh a specific media URL
   */
  refreshMediaUrl(mediaName: string): void {
    this.cache.delete(mediaName);
    this.getMediaUrl(mediaName).subscribe(url => {
      const currentUrls = this.mediaUrlsSubject.value;
      currentUrls[mediaName as keyof LandingMediaUrls] = url;
      this.mediaUrlsSubject.next({ ...currentUrls });
    });
  }

  /**
   * Refresh all media URLs
   */
  refreshAllMediaUrls(): void {
    this.cache.clear();
    this.loadAllMediaUrls();
  }

  /**
   * Get fallback image URL
   */
  getFallbackUrl(type: 'image' | 'video' = 'image'): string {
    if (type === 'video') {
      return '/assets/videos/default-video.mp4';
    }
    return '/assets/images/default-bg.jpg';
  }

  /**
   * Get CSS background image style
   */
  getBackgroundImageStyle(mediaName: string, fallbackUrl?: string): Observable<{ [key: string]: string }> {
    return this.getMediaUrl(mediaName).pipe(
      map(url => {
        const imageUrl = url || fallbackUrl || this.getFallbackUrl('image');
        return {
          'background-image': `url('${imageUrl}')`,
          'background-size': 'cover',
          'background-position': 'center',
          'background-repeat': 'no-repeat'
        };
      })
    );
  }

  /**
   * Get video source URL
   */
  getVideoSource(mediaName: string, fallbackUrl?: string): Observable<string> {
    return this.getMediaUrl(mediaName).pipe(
      map(url => url || fallbackUrl || this.getFallbackUrl('video'))
    );
  }
}
