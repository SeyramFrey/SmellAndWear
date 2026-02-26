import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-section-title',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="section-title">
      <h2 class="section-title__heading">{{ title }}</h2>
      <p *ngIf="subtitle" class="section-title__subtitle">{{ subtitle }}</p>
    </div>
  `,
  styles: [`
    .section-title {
      text-align: start;
      margin-bottom: 2.5rem;
      
      &__heading {
        font-size: 2rem;
        text-transform: uppercase;
        color: #212529;
        margin-bottom: 0.5rem;
        position: relative;
        display: inline-block;
        
        &::after {
          content: '';
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 50px;
          height: 3px;
          background-color: #B5190C;
        }
      }
      
      &__subtitle {
        font-size: 1rem;
        color: #6c757d;
        max-width: 600px;
      }
    }
    
    @media (max-width: 768px) {
      .section-title {
        margin-bottom: 2rem;
        
        &__heading {
          font-size: 1.75rem;
        }
        
        &__subtitle {
          font-size: 0.9rem;
        }
      }
    }
  `]
})
export class SectionTitleComponent {
  @Input() title: string = '';
  @Input() subtitle?: string;
} 