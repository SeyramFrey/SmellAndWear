import {AfterViewInit, Component, ElementRef, Input, ViewChild} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-video-hero',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="video-hero">
      <video
          #videoElement
        class="video-hero__video" 
        [src]="videoSrc" 
        autoplay 
        muted 
        loop
        playsinline
      ></video>
      <div class="video-hero__overlay"></div>
      <div class="video-hero__content">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .video-hero {
      position: relative;
      width: 100%;
      height: 60vh;
      overflow: hidden;
      
      &__video {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      &__overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.3);
      }
      
      &__content {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100%;
        color: white;
        text-align: center;
        padding: 0 1rem;
      }
    }
  `]
})
export class VideoHeroComponent implements AfterViewInit{
  @Input() videoSrc: string = '';
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

  ngAfterViewInit() {
    // Forcer la lecture de la vidéo après l'initialisation de la vue
    if (this.videoElement && this.videoElement.nativeElement) {
      const video = this.videoElement.nativeElement;

      // Attendre un court instant pour s'assurer que le DOM est prêt
      setTimeout(() => {
        // Forcer le chargement
        video.load();
        video.muted = true;
        video.autoplay = true;
        video.loop = true;
        video.playsInline = true;
        // Forcer la lecture
        const playPromise = video.play();

        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error('Autoplay was prevented:', error);
            // Les navigateurs peuvent bloquer l'autoplay sans interaction utilisateur
            // Vous pourriez ajouter un bouton de lecture ici comme solution de secours
          });
        }
      }, 100);
    }
  }
} 