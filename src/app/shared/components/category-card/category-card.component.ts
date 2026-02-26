import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-category-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <a [routerLink]="link" class="category-card">
      <div class="category-card__image-container">
        <img [src]="image" [alt]="name" class="category-card__image">
        <div class="category-card__overlay"></div>
      </div>
      <div class="category-card__content">
        <h3 class="category-card__title">{{ name }}</h3>
      </div>
    </a>
  `,
  styles: [`
    .category-card {
      display: block;
      position: relative;
      border-radius: 8px;
      overflow: hidden;
      height: 70vh;
      text-decoration: none;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      
      &:hover {
        transform: translateY(-5px);
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
        
        .category-card__image {
          transform: scale(1.05);
        }
        
        .category-card__overlay {
          background-color: rgba(0, 0, 0, 0.2);
        }
      }
      
      &__image-container {
        position: relative;
        height: 100%;
        width: 100%;
      }
      
      &__image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.5s ease;
      }
      
      &__overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.4);
        transition: background-color 0.3s ease;
      }
      
      &__content {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
      }
      
      &__title {
        color: white;
        font-size: 1.5rem;
        font-weight: 600;
        text-align: center;
        margin: 0;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }
    }
    
    @media (max-width: 768px) {
      .category-card {
        height: 250px;
        
        &__title {
          font-size: 1.25rem;
        }
      }
    }
  `]
})
export class CategoryCardComponent {
  @Input() name: string = '';
  @Input() image: string = '';
  @Input() link: string = '';
} 