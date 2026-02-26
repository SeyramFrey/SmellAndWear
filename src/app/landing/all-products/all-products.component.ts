import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProduitService } from '../../core/services/produit.service';
import { Produit } from '../../core/models/models';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { TopbarComponent } from '../../shared/landing/index/topbar/topbar.component';
import { SharedModule } from '../../shared/shared.module';

@Component({
  selector: 'app-all-products',
  standalone: true,
  imports: [CommonModule, ProductCardComponent, TopbarComponent, SharedModule],
  templateUrl: './all-products.component.html',
  styleUrl: './all-products.component.scss'
})
export class AllProductsComponent implements OnInit {
  products: Produit[] = [];
  loading: boolean = true;
  error: string | null = null;

  constructor(private produitService: ProduitService) {}

  ngOnInit(): void {
    this.loadAllProducts();
  }

  loadAllProducts(): void {
    this.loading = true;
    this.produitService.getAllProductsShuffledPublic().subscribe({
      next: (products) => {
        this.products = products;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.error = 'Failed to load products';
        this.loading = false;
      }
    });
  }

  /**
   * Scroll to top when button clicked
   */
  topFunction(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Track products by ID for better performance
   */
  trackByProduct(index: number, product: Produit): string {
    return product.id;
  }
}
