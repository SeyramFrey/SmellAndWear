import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ProduitVariation, Produit } from '../models/models';
import { ProductService } from './product.service';

export interface CartItem {
  id: string; // Identifiant unique pour cet item de panier
  productId: string; // ID du produit
  variantId: string; // ID de la variante
  name: string; // Nom du produit
  price: number; // Prix unitaire
  quantity: number; // Quantité
  size: string; // Taille (libellé)
  sizeId: string; // ID de la taille
  color: string; // Couleur (libellé)
  colorId: number; // ID de la couleur
  colorHex: string; // Code hexadécimal de la couleur
  imageUrl: string; // URL de l'image
  stock: number; // Stock disponible (pour vérification)
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly CART_STORAGE_KEY = 'smellwear_cart';
  
  // Observable du panier pour permettre la réactivité sur tous les composants
  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  public cartItems$: Observable<CartItem[]> = this.cartItemsSubject.asObservable();
  
  // Observable du nombre total d'items
  private cartCountSubject = new BehaviorSubject<number>(0);
  public cartCount$: Observable<number> = this.cartCountSubject.asObservable();
  
  // Observable du montant total
  private cartTotalSubject = new BehaviorSubject<number>(0);
  public cartTotal$: Observable<number> = this.cartTotalSubject.asObservable();

  constructor(private produitService: ProductService) {
    this.loadCartFromStorage();
  }

  /**
   * Validate cart items against visible products. Removes items whose product is no longer visible.
   * Call this on checkout load and optionally when cart is displayed.
   */
  validateCartVisibility(): void {
    const items = this.cartItemsSubject.value;
    if (items.length === 0) return;

    const productIds = [...new Set(items.map(i => i.productId))];
    this.produitService.getVisibleProductIds(productIds).subscribe(visibleIds => {
      const validItems = items.filter(item => visibleIds.has(item.productId));
      if (validItems.length !== items.length) {
        this.cartItemsSubject.next(validItems);
        this.saveCartToStorage(validItems);
        this.updateCartCountAndTotal();
      }
    });
  }

  // Charger le panier depuis localStorage
  private loadCartFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const storedCart = localStorage.getItem(this.CART_STORAGE_KEY);
        console.log('Chargement du panier depuis localStorage:', storedCart);
        
        if (storedCart) {
          const cartItems = JSON.parse(storedCart) as CartItem[];
          console.log('Panier chargé:', cartItems);
          this.cartItemsSubject.next(cartItems);
          this.updateCartCountAndTotal();
          this.validateCartVisibility();
        } else {
          console.log('Aucun panier trouvé dans localStorage');
        }
      } catch (error) {
        console.error('Erreur lors du chargement du panier:', error);
        // En cas d'erreur, on réinitialise le panier
        this.clearCart();
      }
    }
  }

  // Sauvegarder le panier dans localStorage
  private saveCartToStorage(items: CartItem[]): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.CART_STORAGE_KEY, JSON.stringify(items));
    }
  }

  // Mettre à jour les compteurs (nombre d'articles et total)
  private updateCartCountAndTotal(): void {
    const items = this.cartItemsSubject.value;
    
    // Calculer le nombre total d'articles (somme des quantités)
    const itemCount = items.reduce((total, item) => total + item.quantity, 0);
    this.cartCountSubject.next(itemCount);
    
    // Calculer le montant total
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    this.cartTotalSubject.next(total);
  }

  // Ajouter un produit au panier
  addToCart(product: Produit, variant: ProduitVariation, quantity: number, size: { id: string, libelle: string }, color: { id: number, nom: string, hex: string }, imageUrl: string): void {
    console.log('Adding to cart:', {
      product: product.nom,
      productPrice: product.prix,
      variant: variant.id,
      quantity: quantity,
      size: size.libelle,
      color: color.nom
    });
    
    const currentCart = [...this.cartItemsSubject.value];
    
    // Générer un ID unique pour l'item basé sur le produit et la variante
    const cartItemId = `${product.id}_${variant.id}_${size.id}_${color.id}`;
    
    // Vérifier si ce produit avec cette variante existe déjà
    const existingItemIndex = currentCart.findIndex(item => 
      item.id === cartItemId
    );
    
    if (existingItemIndex >= 0) {
      // Mettre à jour la quantité si l'article existe déjà
      currentCart[existingItemIndex].quantity += quantity;
    } else {
      // Ajouter un nouvel article au panier
      const newCartItem: CartItem = {
        id: cartItemId,
        productId: product.id,
        variantId: variant.id,
        name: product.nom,
        price: product.prix || 0, // Price comes from product, not variant
        quantity: quantity,
        size: size.libelle,
        sizeId: size.id,
        color: color.nom,
        colorId: color.id,
        colorHex: color.hex,
        imageUrl: imageUrl,
        stock: 0 // No stock management anymore
      };
      
      console.log('New cart item created:', newCartItem);
      currentCart.push(newCartItem);
    }
    
    // Mettre à jour le sujet BehaviorSubject et localStorage
    this.cartItemsSubject.next(currentCart);
    this.saveCartToStorage(currentCart);
    this.updateCartCountAndTotal();
    
    console.log('Cart updated - Final cart:', currentCart);
    console.log('Cart count:', currentCart.length);
    console.log('Cart total items:', currentCart.reduce((sum, item) => sum + item.quantity, 0));
    console.log('Cart total price:', currentCart.reduce((sum, item) => sum + (item.price * item.quantity), 0));
    
    // NOTE: Cart notifications removed per user request.
    // The cart dropdown now opens automatically when items are added,
    // providing visual feedback without intrusive toast notifications.
  }

  // Modifier la quantité d'un article
  updateItemQuantity(itemId: string, newQuantity: number): void {
    const currentCart = [...this.cartItemsSubject.value];
    const itemIndex = currentCart.findIndex(item => item.id === itemId);
    
    if (itemIndex >= 0) {
      // S'assurer que la quantité est valide
      if (newQuantity > 0 && newQuantity <= currentCart[itemIndex].stock) {
        currentCart[itemIndex].quantity = newQuantity;
        
        // Mettre à jour le panier
        this.cartItemsSubject.next(currentCart);
        this.saveCartToStorage(currentCart);
        this.updateCartCountAndTotal();
      } else if (newQuantity <= 0) {
        // Si la quantité est 0 ou négative, supprimer l'article
        this.removeFromCart(itemId);
      }
    }
  }

  // Supprimer un article du panier
  removeFromCart(itemId: string): void {
    const currentCart = this.cartItemsSubject.value.filter(item => item.id !== itemId);
    
    this.cartItemsSubject.next(currentCart);
    this.saveCartToStorage(currentCart);
    this.updateCartCountAndTotal();
  }

  // Vider le panier
  clearCart(): void {
    this.cartItemsSubject.next([]);
    this.saveCartToStorage([]);
    this.updateCartCountAndTotal();
  }

  // Obtenir le contenu du panier
  getCartItems(): CartItem[] {
    return this.cartItemsSubject.value;
  }

  // Obtenir le nombre d'articles dans le panier
  getCartCount(): number {
    return this.cartCountSubject.value;
  }

  // Obtenir le montant total du panier
  getCartTotal(): number {
    return this.cartTotalSubject.value;
  }
} 