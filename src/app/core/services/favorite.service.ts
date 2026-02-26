import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { FavorisService } from './favoris.service';
import { TokenStorageService } from './token-storage.service';

@Injectable({
  providedIn: 'root'
})
export class FavoriteService {
  private favoriteIdsSubject = new BehaviorSubject<string[]>([]);
  favoriteIds$: Observable<string[]> = this.favoriteIdsSubject.asObservable();
  
  constructor(
    private favorisService: FavorisService,
    private tokenStorageService: TokenStorageService
  ) {
    this.loadFavorites();
  }
  
  private async loadFavorites() {
    try {
      const currentUser = this.tokenStorageService.getUser();
      if (currentUser && currentUser.id) {
        const favorites = await this.favorisService.getFavorisByClientId(currentUser.id);
        const favoriteIds = favorites.map(fav => fav.produit_id || '');
        this.favoriteIdsSubject.next(favoriteIds);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des favoris', error);
    }
  }
  
  isFavorite(productId: string): boolean {
    return this.favoriteIdsSubject.value.includes(productId);
  }
  
  async toggleFavorite(productId: string): Promise<void> {
    try {
      const currentUser = this.tokenStorageService.getUser();
      if (!currentUser || !currentUser.id) {
        console.error('Utilisateur non connecté');
        return;
      }
      
      const isNowFavorite = await this.favorisService.toggleFavoris(currentUser.id, productId);
      
      // Mettre à jour la liste des favoris
      const currentFavorites = [...this.favoriteIdsSubject.value];
      const productIndex = currentFavorites.indexOf(productId);
      
      if (isNowFavorite && productIndex === -1) {
        currentFavorites.push(productId);
      } else if (!isNowFavorite && productIndex !== -1) {
        currentFavorites.splice(productIndex, 1);
      }
      
      this.favoriteIdsSubject.next(currentFavorites);
    } catch (error) {
      console.error('Erreur lors de la modification des favoris', error);
    }
  }
} 