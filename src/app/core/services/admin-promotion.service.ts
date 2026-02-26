import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of, forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { 
  Promotion, 
  PromotionPriceRule,
  CreatePromotionRequest,
  UpdatePromotionRequest,
  PromotionRuleRequest,
  CategoryOption,
  ProductOption,
  DeliveryZoneOption,
  PromotionType,
  TargetType
} from '../models/promotion.models';

export interface PromotionFilters {
  status?: string[];
  placement?: string[];
  promotion_type?: PromotionType[];
  dateRange?: {
    start?: string;
    end?: string;
  };
  search?: string;
}

export interface PromotionStats {
  total: number;
  active: number;
  scheduled: number;
  ended: number;
  draft: number;
  paused: number;
  productDiscounts: number;
  deliveryDiscounts: number;
}

export interface PromotionWithRules extends Promotion {
  rules: PromotionPriceRule[];
}

@Injectable({
  providedIn: 'root'
})
export class AdminPromotionService {
  private promotionsSubject = new BehaviorSubject<Promotion[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private statsSubject = new BehaviorSubject<PromotionStats | null>(null);

  constructor(private supabaseService: SupabaseService) {}

  // ============================================================================
  // PROMOTIONS CRUD
  // ============================================================================

  /**
   * Get all promotions with optional filtering
   */
  getPromotions(filters?: PromotionFilters): Observable<Promotion[]> {
    this.loadingSubject.next(true);
    
    return new Observable(observer => {
      let query = this.supabaseService.getClient()
        .from('promotions')
        .select('*');

      // Apply filters
      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters?.placement && filters.placement.length > 0) {
        query = query.in('placement', filters.placement);
      }

      if (filters?.promotion_type && filters.promotion_type.length > 0) {
        query = query.in('promotion_type', filters.promotion_type);
      }

      if (filters?.dateRange?.start) {
        query = query.gte('start_at', filters.dateRange.start);
      }

      if (filters?.dateRange?.end) {
        query = query.lte('end_at', filters.dateRange.end);
      }

      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,message.ilike.%${filters.search}%`);
      }

      // Order by weight and creation date
      query = query.order('weight', { ascending: false })
                  .order('created_at', { ascending: false });

      query.then(({ data, error }) => {
        this.loadingSubject.next(false);
        
        if (error) {
          observer.error(error);
          return;
        }

        const promotions = (data || []) as Promotion[];
        this.promotionsSubject.next(promotions);
        observer.next(promotions);
        observer.complete();
      });
    });
  }

  /**
   * Get promotion by ID with its rules
   */
  getPromotionById(id: string): Observable<PromotionWithRules | null> {
    return new Observable(observer => {
      // Fetch promotion and rules in parallel
      Promise.all([
        this.supabaseService.getClient()
          .from('promotions')
          .select('*')
          .eq('id', id)
          .single(),
        this.supabaseService.getClient()
          .from('promotion_price_rules')
          .select('*')
          .eq('promotion_id', id)
      ]).then(([promotionResult, rulesResult]) => {
        if (promotionResult.error) {
          observer.error(promotionResult.error);
          return;
        }

        const promotion = promotionResult.data as Promotion;
        const rules = (rulesResult.data || []) as PromotionPriceRule[];

        observer.next({
          ...promotion,
          rules
        });
        observer.complete();
      });
    });
  }

  /**
   * Create new promotion
   */
  createPromotion(promotion: CreatePromotionRequest): Observable<Promotion> {
    return new Observable(observer => {
      this.supabaseService.getClient()
        .from('promotions')
        .insert([{
          ...promotion,
          status: 'draft' // Always start as draft
        }])
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) {
            observer.error(error);
            return;
          }

          const newPromotion = data as Promotion;
          
          // Update local cache
          const currentPromotions = this.promotionsSubject.value;
          this.promotionsSubject.next([newPromotion, ...currentPromotions]);
          
          observer.next(newPromotion);
          observer.complete();
        });
    });
  }

  /**
   * Create promotion with rules in one transaction
   */
  createPromotionWithRules(
    promotion: CreatePromotionRequest,
    rules: Omit<PromotionRuleRequest, 'promotion_id'>[]
  ): Observable<PromotionWithRules> {
    return this.createPromotion(promotion).pipe(
      switchMap(createdPromotion => {
        if (rules.length === 0) {
          return of({ ...createdPromotion, rules: [] });
        }

        const rulesWithPromotionId = rules.map(rule => ({
          ...rule,
          promotion_id: createdPromotion.id
        }));

        return this.createPromotionRules(rulesWithPromotionId).pipe(
          map(createdRules => ({
            ...createdPromotion,
            rules: createdRules
          }))
        );
      })
    );
  }

  /**
   * Update existing promotion
   */
  updatePromotion(id: string, updates: UpdatePromotionRequest): Observable<Promotion> {
    return new Observable(observer => {
      this.supabaseService.getClient()
        .from('promotions')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) {
            observer.error(error);
            return;
          }

          const updatedPromotion = data as Promotion;
          
          // Update local cache
          const currentPromotions = this.promotionsSubject.value;
          const updatedPromotions = currentPromotions.map(p => 
            p.id === id ? updatedPromotion : p
          );
          this.promotionsSubject.next(updatedPromotions);
          
          observer.next(updatedPromotion);
          observer.complete();
        });
    });
  }

  /**
   * Update promotion with rules
   */
  updatePromotionWithRules(
    id: string,
    updates: UpdatePromotionRequest,
    rules: Omit<PromotionRuleRequest, 'promotion_id'>[]
  ): Observable<PromotionWithRules> {
    // First delete existing rules, then update promotion and create new rules
    return this.deletePromotionRules(id).pipe(
      switchMap(() => this.updatePromotion(id, updates)),
      switchMap(updatedPromotion => {
        if (rules.length === 0) {
          return of({ ...updatedPromotion, rules: [] });
        }

        const rulesWithPromotionId = rules.map(rule => ({
          ...rule,
          promotion_id: id
        }));

        return this.createPromotionRules(rulesWithPromotionId).pipe(
          map(createdRules => ({
            ...updatedPromotion,
            rules: createdRules
          }))
        );
      })
    );
  }

  /**
   * Delete promotion (with cascade delete of rules)
   */
  deletePromotion(id: string): Observable<boolean> {
    // First delete all rules associated with this promotion, then delete the promotion
    return this.deletePromotionRules(id).pipe(
      switchMap(() => {
        return new Observable<boolean>(observer => {
          this.supabaseService.getClient()
            .from('promotions')
            .delete()
            .eq('id', id)
            .then(({ error }) => {
              if (error) {
                observer.error(error);
                return;
              }

              // Update local cache
              const currentPromotions = this.promotionsSubject.value;
              const filteredPromotions = currentPromotions.filter(p => p.id !== id);
              this.promotionsSubject.next(filteredPromotions);
              
              observer.next(true);
              observer.complete();
            });
        });
      })
    );
  }

  /**
   * Update promotion status
   */
  updatePromotionStatus(id: string, status: string): Observable<Promotion> {
    return this.updatePromotion(id, { status: status as Promotion['status'] });
  }

  /**
   * Duplicate promotion
   */
  duplicatePromotion(id: string): Observable<PromotionWithRules> {
    return this.getPromotionById(id).pipe(
      switchMap(original => {
        if (!original) {
          throw new Error('Promotion not found');
        }

        const duplicate: CreatePromotionRequest = {
          title: `${original.title} (Copie)`,
          message: original.message,
          url: original.url,
          placement: original.placement,
          start_at: original.start_at,
          end_at: original.end_at,
          display_duration_seconds: original.display_duration_seconds,
          weight: original.weight,
          is_dismissible: original.is_dismissible,
          animation: original.animation,
          theme: original.theme,
          promotion_type: original.promotion_type,
          discount_type: original.discount_type,
          discount_value: original.discount_value,
          min_order_amount: original.min_order_amount,
          max_discount_amount: original.max_discount_amount
        };

        const rulesDuplicate = original.rules.map(rule => ({
          target_type: rule.target_type,
          target_id: rule.target_id,
          target_code: rule.target_code
        }));

        return this.createPromotionWithRules(duplicate, rulesDuplicate);
      })
    );
  }

  // ============================================================================
  // PROMOTION RULES CRUD
  // ============================================================================

  /**
   * Get rules for a promotion
   */
  getPromotionRules(promotionId: string): Observable<PromotionPriceRule[]> {
    return new Observable(observer => {
      this.supabaseService.getClient()
        .from('promotion_price_rules')
        .select('*')
        .eq('promotion_id', promotionId)
        .then(({ data, error }) => {
          if (error) {
            observer.error(error);
            return;
          }

          observer.next((data || []) as PromotionPriceRule[]);
          observer.complete();
        });
    });
  }

  /**
   * Create promotion rules
   */
  createPromotionRules(rules: PromotionRuleRequest[]): Observable<PromotionPriceRule[]> {
    if (rules.length === 0) {
      return of([]);
    }

    return new Observable(observer => {
      this.supabaseService.getClient()
        .from('promotion_price_rules')
        .insert(rules)
        .select()
        .then(({ data, error }) => {
          if (error) {
            observer.error(error);
            return;
          }

          observer.next((data || []) as PromotionPriceRule[]);
          observer.complete();
        });
    });
  }

  /**
   * Delete all rules for a promotion
   */
  deletePromotionRules(promotionId: string): Observable<boolean> {
    return new Observable(observer => {
      this.supabaseService.getClient()
        .from('promotion_price_rules')
        .delete()
        .eq('promotion_id', promotionId)
        .then(({ error }) => {
          if (error) {
            observer.error(error);
            return;
          }

          observer.next(true);
          observer.complete();
        });
    });
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Get promotion statistics
   */
  getPromotionStats(): Observable<PromotionStats> {
    return new Observable(observer => {
      this.supabaseService.getClient()
        .from('promotions')
        .select('status, promotion_type')
        .then(({ data, error }) => {
          if (error) {
            observer.error(error);
            return;
          }

          const promotions = data || [];
          const stats: PromotionStats = {
            total: promotions.length,
            active: promotions.filter(p => p.status === 'running').length,
            scheduled: promotions.filter(p => p.status === 'scheduled').length,
            ended: promotions.filter(p => p.status === 'ended').length,
            draft: promotions.filter(p => p.status === 'draft').length,
            paused: promotions.filter(p => p.status === 'paused').length,
            productDiscounts: promotions.filter(p => p.promotion_type === 'PRODUCT_DISCOUNT').length,
            deliveryDiscounts: promotions.filter(p => p.promotion_type === 'DELIVERY_DISCOUNT').length
          };

          this.statsSubject.next(stats);
          observer.next(stats);
          observer.complete();
        });
    });
  }

  // ============================================================================
  // HELPER DATA LOADERS
  // ============================================================================

  /**
   * Get all categories for selection
   */
  getCategories(): Observable<CategoryOption[]> {
    return new Observable(observer => {
      this.supabaseService.getClient()
        .from('categorie')
        .select('id, nom, parent_id')
        .order('nom')
        .then(({ data, error }) => {
          if (error) {
            observer.error(error);
            return;
          }

          const categories = (data || []).map(cat => ({
            id: cat.id,
            name: cat.nom,
            parent_id: cat.parent_id,
            isSubcategory: !!cat.parent_id
          }));

          observer.next(categories);
          observer.complete();
        });
    });
  }

  /**
   * Get main categories only (no parent)
   */
  getMainCategories(): Observable<CategoryOption[]> {
    return this.getCategories().pipe(
      map(categories => categories.filter(c => !c.isSubcategory))
    );
  }

  /**
   * Get subcategories for a main category
   */
  getSubcategories(parentId: string): Observable<CategoryOption[]> {
    return this.getCategories().pipe(
      map(categories => categories.filter(c => c.parent_id === parentId))
    );
  }

  /**
   * Get all products for selection
   */
  getProducts(): Observable<ProductOption[]> {
    return new Observable(observer => {
      this.supabaseService.getClient()
        .from('produit')
        .select(`
          id, 
          nom,
          categorie:sous_categorie_id (nom)
        `)
        .order('nom')
        .then(({ data, error }) => {
          if (error) {
            observer.error(error);
            return;
          }

          const products = (data || []).map((p: { id: string; nom: string; categorie: { nom: string }[] | null }) => ({
            id: p.id,
            name: p.nom,
            category_name: p.categorie && p.categorie.length > 0 ? p.categorie[0].nom : undefined
          }));

          observer.next(products);
          observer.complete();
        });
    });
  }

  /**
   * Get delivery zones for selection
   */
  getDeliveryZones(): Observable<DeliveryZoneOption[]> {
    return new Observable(observer => {
      this.supabaseService.getClient()
        .from('livraison_tarifs')
        .select('id, label, country_code')
        .eq('is_active', true)
        .order('country_code')
        .order('label')
        .then(({ data, error }) => {
          if (error) {
            observer.error(error);
            return;
          }

          const zones = (data || []).map(z => ({
            id: z.id,
            label: z.label,
            country_code: z.country_code
          }));

          observer.next(zones);
          observer.complete();
        });
    });
  }

  // ============================================================================
  // OBSERVABLES
  // ============================================================================

  /**
   * Get loading state
   */
  isLoading(): Observable<boolean> {
    return this.loadingSubject.asObservable();
  }

  /**
   * Get promotion stats observable
   */
  getStatsObservable(): Observable<PromotionStats | null> {
    return this.statsSubject.asObservable();
  }

  /**
   * Refresh promotions data
   */
  refreshPromotions(): void {
    this.getPromotions().subscribe();
    this.getPromotionStats().subscribe();
  }
}
