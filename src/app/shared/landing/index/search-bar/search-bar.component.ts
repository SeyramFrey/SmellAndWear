import { Component, OnInit, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ProduitService } from '../../../../core/services/produit.service';
import { Produit } from '../../../../core/models/models';
import { ProductCardComponent } from '../../../components/product-card/product-card.component';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ProductCardComponent],
  templateUrl: './search-bar.component.html',
  styleUrl: './search-bar.component.scss'
})
export class SearchBarComponent implements OnInit, OnDestroy {
  @Output() closeSearch = new EventEmitter<void>();

  searchControl = new FormControl('');
  searchBy: 'name' | 'description' | 'price' | 'all' = 'all';
  products: Produit[] = [];
  loading: boolean = false;
  showDropdown: boolean = false;
  isActive: boolean = false; // For animation
  private destroy$ = new Subject<void>();

  constructor(private produitService: ProduitService) {}

  ngOnInit(): void {
    // Trigger animation after component loads
    setTimeout(() => {
      this.isActive = true;
    }, 10);

    // Real-time search with debounce
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
        switchMap(term => {
          if (!term || term.trim().length < 2) {
            this.products = [];
            return [];
          }
          
          this.loading = true;
          return this.produitService.advancedSearchPublic(term.trim(), this.searchBy);
        })
      )
      .subscribe({
        next: (products) => {
          this.products = products;
          this.loading = false;
        },
        error: (error) => {
          console.error('Search error:', error);
          this.loading = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  close(): void {
    // Animate out before closing
    this.isActive = false;
    setTimeout(() => {
      this.closeSearch.emit();
    }, 300); // Match animation duration
  }

  clearSearch(): void {
    this.searchControl.setValue('');
    this.products = [];
  }

  selectSearchBy(type: 'name' | 'description' | 'price' | 'all'): void {
    this.searchBy = type;
    this.showDropdown = false;
    
    // Re-trigger search if there's a value
    const currentValue = this.searchControl.value;
    if (currentValue && currentValue.trim().length >= 2) {
      this.loading = true;
      this.produitService.advancedSearchPublic(currentValue.trim(), this.searchBy).subscribe({
        next: (products) => {
          this.products = products;
          this.loading = false;
        },
        error: (error) => {
          console.error('Search error:', error);
          this.loading = false;
        }
      });
    }
  }

  toggleDropdown(): void {
    this.showDropdown = !this.showDropdown;
  }

  getSearchByLabel(): string {
    switch (this.searchBy) {
      case 'name':
        return 'Name';
      case 'description':
        return 'Description';
      case 'price':
        return 'Price';
      default:
        return 'All';
    }
  }
}
