import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of, forkJoin, combineLatest } from 'rxjs';
import { map, catchError, tap, shareReplay, startWith } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';

export interface DashboardStats {
  totalEarnings: number;
  totalOrders: number;
  totalCustomers: number;
  totalBalance: number;
  earningsGrowth: number;
  ordersGrowth: number;
  customersGrowth: number;
  balanceGrowth: number;
}

export interface BestSellingProduct {
  id: string;
  name: string;
  image: string;
  date: string;
  price: number;
  orders: number;
  stock: number;
  amount: number;
}

export interface TopSellingVendor {
  id: string;
  name: string;
  image: string;
  contactPerson: string;
  category: string;
  totalSales: number;
  totalAmount: number;
  growthPercentage: number;
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerImage: string;
  productCategory: string;
  amount: number;
  vendor: string;
  status: 'Paid' | 'Pending' | 'Unpaid' | 'Cancelled';
  rating: number;
  createdAt: string;
}

export interface SalesAnalytics {
  orders: number[];
  earnings: number[];
  refunds: number[];
  labels: string[];
}

export interface CountrySessionData {
  country: string;
  sessions: number;
  flagCode: string;
}

export interface SalesCategoryData {
  category: string;
  value: number;
  percentage: number;
}

export interface SalesByCityData {
  city: string;
  countryName: string;
  countryId: string;
  ordersCount: number;
  totalRevenue: number;
  uniqueCustomers: number;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly CACHE_DURATION = 300000; // 5 minutes

  // BehaviorSubjects for reactive state management
  private statsSubject = new BehaviorSubject<DashboardStats | null>(null);
  private bestSellingSubject = new BehaviorSubject<BestSellingProduct[]>([]);
  private topSellersSubject = new BehaviorSubject<TopSellingVendor[]>([]);
  private recentOrdersSubject = new BehaviorSubject<RecentOrder[]>([]);
  private analyticsSubject = new BehaviorSubject<SalesAnalytics | null>(null);
  private countryDataSubject = new BehaviorSubject<CountrySessionData[]>([]);
  private categoryDataSubject = new BehaviorSubject<SalesCategoryData[]>([]);
  private salesByCitySubject = new BehaviorSubject<SalesByCityData[]>([]);

  // Cached observables
  private dashboardStats$!: Observable<DashboardStats>;
  private bestSellingProducts$!: Observable<BestSellingProduct[]>;
  private topSellingVendors$!: Observable<TopSellingVendor[]>;
  private recentOrders$!: Observable<RecentOrder[]>;
  private salesAnalytics$!: Observable<SalesAnalytics>;
  private countrySessionData$!: Observable<CountrySessionData[]>;
  private categoryData$!: Observable<SalesCategoryData[]>;
  private salesByCityData$!: Observable<SalesByCityData[]>;

  // Country filter (FR or CI, null = all)
  private countryFilter$ = new BehaviorSubject<string | null>(null);

  constructor(private supabaseService: SupabaseService) {
    this.initializeDashboardStreams();
  }

  /**
   * Initialize reactive data streams
   */
  private initializeDashboardStreams(): void {
    // Dashboard stats with caching
    this.dashboardStats$ = this.createCachedObservable(() => this.fetchDashboardStats()).pipe(
      shareReplay(1)
    );

    // Best selling products
    this.bestSellingProducts$ = this.createCachedObservable(() => this.fetchBestSellingProducts()).pipe(
      shareReplay(1)
    );

    // Top selling vendors
    this.topSellingVendors$ = this.createCachedObservable(() => this.fetchTopSellingVendors()).pipe(
      shareReplay(1)
    );

    // Recent orders
    this.recentOrders$ = this.createCachedObservable(() => this.fetchRecentOrders()).pipe(
      shareReplay(1)
    );

    // Sales analytics
    this.salesAnalytics$ = this.createCachedObservable(() => this.fetchSalesAnalytics()).pipe(
      shareReplay(1)
    );

    // Country session data
    this.countrySessionData$ = this.createCachedObservable(() => this.fetchCountrySessionData()).pipe(
      shareReplay(1)
    );

    // Category data
    this.categoryData$ = this.createCachedObservable(() => this.fetchCategoryData()).pipe(
      shareReplay(1)
    );

    // Sales by cities data
    this.salesByCityData$ = this.createCachedObservable(() => this.fetchSalesByCities()).pipe(
      shareReplay(1)
    );
  }

  /**
   * Create cached observable with error handling
   */
  private createCachedObservable<T>(fetchFn: () => Observable<T>): Observable<T> {
    return fetchFn().pipe(
      catchError(error => {
        console.error('Dashboard data fetch error:', error);
        return of([] as any); // Return empty array or default value
      })
    );
  }

  /**
   * Get dashboard statistics
   */
  getDashboardStats(countryCode?: string | null): Observable<DashboardStats> {
    if (countryCode !== undefined) {
      return this.fetchDashboardStats(countryCode);
    }
    return this.dashboardStats$;
  }

  /**
   * Get best selling products
   */
  getBestSellingProducts(countryCode?: string | null): Observable<BestSellingProduct[]> {
    if (countryCode !== undefined) {
      return this.fetchBestSellingProducts(countryCode);
    }
    return this.bestSellingProducts$;
  }

  /**
   * Get top selling vendors
   */
  getTopSellingVendors(): Observable<TopSellingVendor[]> {
    return this.topSellingVendors$;
  }

  /**
   * Get recent orders
   */
  getRecentOrders(countryCode?: string | null): Observable<RecentOrder[]> {
    if (countryCode !== undefined) {
      return this.fetchRecentOrders(countryCode);
    }
    return this.recentOrders$;
  }

  /**
   * Get sales analytics data
   */
  getSalesAnalytics(period: 'all' | '1M' | '6M' | '1Y' = 'all', countryCode?: string | null): Observable<SalesAnalytics> {
    return this.fetchSalesAnalyticsByPeriod(period, countryCode);
  }

  /**
   * Get country session data
   */
  getCountrySessionData(): Observable<CountrySessionData[]> {
    return this.countrySessionData$;
  }

  /**
   * Get sales category data
   */
  getSalesCategoryData(countryCode?: string | null): Observable<SalesCategoryData[]> {
    if (countryCode !== undefined) {
      return this.fetchCategoryData(countryCode);
    }
    return this.categoryData$;
  }

  /**
   * Get sales by cities data
   */
  getSalesByCities(countryCode?: string | null): Observable<SalesByCityData[]> {
    if (countryCode !== undefined) {
      return this.fetchSalesByCities(countryCode);
    }
    return this.salesByCityData$;
  }

  /**
   * Set country filter (FR, CI, or null for all)
   */
  setCountryFilter(countryCode: string | null): void {
    this.countryFilter$.next(countryCode);
  }

  /**
   * Get current country filter
   */
  getCountryFilter(): Observable<string | null> {
    return this.countryFilter$.asObservable();
  }

  /**
   * Fetch sales by cities from Supabase
   */
  private fetchSalesByCities(countryCode?: string | null): Observable<SalesByCityData[]> {
    return new Observable(observer => {
      let query = this.supabaseService.getClient()
        .from('v_sales_by_cities')
        .select('*')
        .order('total_revenue', { ascending: false })
        .limit(10);

      // Apply country filter if provided
      if (countryCode) {
        // Normalize country code: 'FR' or 'CI'
        const normalizedCode = countryCode.toUpperCase();
        if (normalizedCode === 'FR') {
          query = query.ilike('country_name', '%France%');
        } else if (normalizedCode === 'CI') {
          query = query.ilike('country_name', '%Côte%Ivoire%');
        }
      }

      query.then(({ data, error }) => {
        if (error) {
          observer.error(error);
          return;
        }

        const cities = (data || []).map((item: any) => ({
          city: item.city || 'Unknown',
          countryName: item.country_name || 'Unknown',
          countryId: item.country_id || '',
          ordersCount: item.orders_count || 0,
          totalRevenue: parseFloat(item.total_revenue) || 0,
          uniqueCustomers: item.unique_customers || 0
        } as SalesByCityData));

        observer.next(cities);
        observer.complete();
      }, (error: any) => {
        observer.error(error);
      });
    });
  }

  /**
   * Helper: Get country ID by code (FR or CI)
   */
  private getCountryIdByCode(countryCode: string): Observable<string | null> {
    return new Observable(observer => {
      const normalizedCode = countryCode.toUpperCase();
      let countryName = '';
      
      if (normalizedCode === 'FR') {
        countryName = 'France';
      } else if (normalizedCode === 'CI') {
        countryName = 'Côte d\'Ivoire';
      } else {
        observer.next(null);
        observer.complete();
        return;
      }

      this.supabaseService.getClient()
        .from('pays')
        .select('id')
        .ilike('nom', `%${countryName}%`)
        .limit(1)
        .then(({ data, error }) => {
          if (error || !data || data.length === 0) {
            observer.next(null);
          } else {
            observer.next(data[0].id);
          }
          observer.complete();
        });
    });
  }

  /**
   * Fetch dashboard statistics from Supabase
   */
  private fetchDashboardStats(countryCode?: string | null): Observable<DashboardStats> {
    return new Observable(observer => {
      // If country filter is provided, get country ID first
      const filterPromise = countryCode 
        ? this.getCountryIdByCode(countryCode).pipe(map(id => id)).toPromise()
        : Promise.resolve(null);

      filterPromise.then((countryId) => {
        // Build orders query - column is 'statut' not 'status'
        let ordersQuery = this.supabaseService.getClient()
          .from('commande')
          .select('total, statut, created_at, pays');

        // Apply country filter by pays ID if available
        if (countryId) {
          ordersQuery = ordersQuery.eq('pays', countryId);
        }

        // Use 'client' table (not 'user' which doesn't exist in public schema)
        const customersQuery = this.supabaseService.getClient()
          .from('client')
          .select('id, created_at');

        Promise.all([ordersQuery, customersQuery]).then(([ordersResult, customersResult]) => {
        if (ordersResult.error || customersResult.error) {
          observer.error(ordersResult.error || customersResult.error);
          return;
        }

        const orders = ordersResult.data || [];
        const customers = customersResult.data || [];

        // Calculate current month and previous month for growth
        const now = new Date();
        const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        // Filter orders for current and previous month
        const currentMonthOrders = orders.filter(order => 
          new Date(order.created_at) >= currentMonth
        );
        const previousMonthOrders = orders.filter(order => 
          new Date(order.created_at) >= previousMonth && new Date(order.created_at) < currentMonth
        );

        // Calculate statistics - column is 'statut' not 'status'
        const totalEarnings = orders
          .filter(order => order.statut === 'livré')
          .reduce((sum, order) => sum + (parseFloat(order.total) || 0), 0);

        const currentMonthEarnings = currentMonthOrders
          .filter(order => order.statut === 'livré')
          .reduce((sum, order) => sum + (parseFloat(order.total) || 0), 0);

        const previousMonthEarnings = previousMonthOrders
          .filter(order => order.statut === 'livré')
          .reduce((sum, order) => sum + (parseFloat(order.total) || 0), 0);

        const totalOrders = orders.length;
        const totalCustomers = customers.length;

        // Calculate growth percentages
        const earningsGrowth = previousMonthEarnings > 0 
          ? ((currentMonthEarnings - previousMonthEarnings) / previousMonthEarnings) * 100 
          : 0;

        const ordersGrowth = previousMonthOrders.length > 0 
          ? ((currentMonthOrders.length - previousMonthOrders.length) / previousMonthOrders.length) * 100 
          : 0;

        const currentMonthCustomers = customers.filter(customer => 
          new Date(customer.created_at) >= currentMonth
        ).length;
        const previousMonthCustomers = customers.filter(customer => 
          new Date(customer.created_at) >= previousMonth && new Date(customer.created_at) < currentMonth
        ).length;

        const customersGrowth = previousMonthCustomers > 0 
          ? ((currentMonthCustomers - previousMonthCustomers) / previousMonthCustomers) * 100 
          : 0;

        const stats: DashboardStats = {
          totalEarnings,
          totalOrders,
          totalCustomers,
          totalBalance: totalEarnings * 0.85, // Assuming 15% goes to fees
          earningsGrowth,
          ordersGrowth,
          customersGrowth,
          balanceGrowth: earningsGrowth // Same as earnings growth
        };

          observer.next(stats);
          observer.complete();
        }, (error: any) => {
          observer.error(error);
        });
      }, (error: any) => {
        observer.error(error);
      });
    });
  }

  /**
   * Fetch best selling products
   */
  private fetchBestSellingProducts(countryCode?: string | null): Observable<BestSellingProduct[]> {
    return new Observable(observer => {
      // FK path: produit -> variant (via variant.produit_id) -> commande_item (via commande_item.produit_variation_id)
      this.supabaseService.getClient()
        .from('produit')
        .select(`
          id, nom, front_photo_path, prix, created_at,
          variant(stock, commande_item(quantite))
        `)
        .limit(20)
        .then(({ data, error }) => {
          if (error) {
            observer.error(error);
            return;
          }

          const products = (data || []).map((product: any) => {
            const variants = product.variant || [];
            
            const totalOrders = variants.reduce((sum: number, v: any) => {
              const variantOrders = v.commande_item?.reduce((orderSum: number, ci: any) => 
                orderSum + (ci.quantite || 0), 0) || 0;
              return sum + variantOrders;
            }, 0);
            
            const totalStock = variants.reduce((sum: number, v: any) => 
              sum + (v.stock || 0), 0);

            const totalAmount = totalOrders * (parseFloat(product.prix) || 0);

            return {
              id: product.id,
              name: product.nom || 'Produit sans nom',
              image: product.front_photo_path || '/assets/images/products/default.png',
              date: new Date(product.created_at).toLocaleDateString('fr-FR'),
              price: parseFloat(product.prix) || 0,
              orders: totalOrders,
              stock: totalStock,
              amount: totalAmount
            } as BestSellingProduct;
          })
          .sort((a: BestSellingProduct, b: BestSellingProduct) => b.orders - a.orders)
          .slice(0, 5);

          observer.next(products);
          observer.complete();
        }, (error: any) => {
          observer.error(error);
        });
    });
  }

  /**
   * Fetch top selling vendors (categories)
   */
  private fetchTopSellingVendors(): Observable<TopSellingVendor[]> {
    return new Observable(observer => {
      // FK path: categorie -> produit (via produit.sous_categorie_id) -> variant -> commande_item
      this.supabaseService.getClient()
        .from('categorie')
        .select(`
          id,
          nom,
          image,
          produit(
            id,
            prix,
            variant(commande_item(quantite))
          )
        `)
        .limit(10)
        .then(({ data, error }) => {
          if (error) {
            observer.error(error);
            return;
          }

          const vendors = (data || []).map((category: any) => {
            const products = category.produit || [];
            const totalSales = products.reduce((sum: number, product: any) => {
              const variants = product.variant || [];
              const orders = variants.reduce((vSum: number, v: any) => {
                return vSum + (v.commande_item?.reduce((ciSum: number, ci: any) => 
                  ciSum + (ci.quantite || 0), 0) || 0);
              }, 0);
              return sum + orders;
            }, 0);

            const totalAmount = products.reduce((sum: number, product: any) => {
              const variants = product.variant || [];
              const orders = variants.reduce((vSum: number, v: any) => {
                return vSum + (v.commande_item?.reduce((ciSum: number, ci: any) => 
                  ciSum + (ci.quantite || 0), 0) || 0);
              }, 0);
              return sum + (orders * (parseFloat(product.prix) || 0));
            }, 0);

            return {
              id: category.id,
              name: category.nom || 'Catégorie',
              image: category.image || '/assets/images/companies/default.png',
              contactPerson: 'Admin',
              category: 'Streetwear',
              totalSales,
              totalAmount,
              growthPercentage: Math.floor(Math.random() * 100)
            } as TopSellingVendor;
          })
          .sort((a: TopSellingVendor, b: TopSellingVendor) => b.totalAmount - a.totalAmount)
          .slice(0, 5);

          observer.next(vendors);
          observer.complete();
        }, (error: any) => {
          observer.error(error);
        });
    });
  }

  /**
   * Fetch recent orders
   */
  private fetchRecentOrders(countryCode?: string | null): Observable<RecentOrder[]> {
    return new Observable(observer => {
      // Get country ID if filter is provided
      const filterPromise = countryCode 
        ? this.getCountryIdByCode(countryCode).pipe(map(id => id)).toPromise()
        : Promise.resolve(null);

      filterPromise.then((countryId) => {
        // Use 'statut' (not 'status'), 'client' (not 'user'), and correct FK path
        let query = this.supabaseService.getClient()
          .from('commande')
          .select(`
            id,
            payment_reference,
            total,
            statut,
            created_at,
            pays,
            client(nom, prenom),
            commande_item(
              variant(
                produit(sous_categorie_id, categorie(nom))
              )
            )
          `)
          .order('created_at', { ascending: false })
          .limit(5);

        // Apply country filter by pays ID if available
        if (countryId) {
          query = query.eq('pays', countryId);
        }

        query.then(({ data, error }) => {
          if (error) {
            observer.error(error);
            return;
          }

          const orders = (data || []).map((order: any) => {
            const client = order.client || {};
            const customerName = `${client.prenom || ''} ${client.nom || ''}`.trim() || 'Client';
            const customerImage = '/assets/images/users/default-avatar.jpg';
            
            // Get primary category from products via commande_item -> variant -> produit -> categorie
            const categories = order.commande_item?.map((ci: any) => 
              ci.variant?.produit?.categorie?.nom
            ).filter(Boolean) || [];
            const productCategory = categories[0] || 'Streetwear';

            // Map statut
            const statusMap: { [key: string]: 'Paid' | 'Pending' | 'Unpaid' | 'Cancelled' } = {
              'livré': 'Paid',
              'confirmé': 'Pending',
              'en_cours': 'Pending',
              'en_attente': 'Pending',
              'annulé': 'Cancelled'
            };

            return {
              id: order.id,
              orderNumber: order.payment_reference || `#${order.id.slice(0, 8)}`,
              customerName,
              customerImage,
              productCategory,
              amount: parseFloat(order.total) || 0,
              vendor: 'Smell & Wear',
              status: statusMap[order.statut] || 'Pending',
              rating: 4.0 + Math.random(),
              createdAt: order.created_at
            } as RecentOrder;
          });

          observer.next(orders);
          observer.complete();
        }, (error: any) => {
          observer.error(error);
        });
      }, (error: any) => {
        observer.error(error);
      });
    });
  }

  /**
   * Fetch sales analytics by period
   */
  private fetchSalesAnalyticsByPeriod(period: string, countryCode?: string | null): Observable<SalesAnalytics> {
    return new Observable(observer => {
      const now = new Date();
      let startDate: Date;
      let labels: string[];

      switch (period) {
        case '1M':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          labels = this.getLast30DaysLabels();
          break;
        case '6M':
          startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          labels = this.getLast6MonthsLabels();
          break;
        case '1Y':
          startDate = new Date(now.getFullYear() - 1, 0, 1);
          labels = this.getMonthLabels();
          break;
        default: // 'all'
          startDate = new Date(now.getFullYear() - 1, 0, 1);
          labels = this.getMonthLabels();
      }

      // Get country ID if filter is provided
      const filterPromise = countryCode 
        ? this.getCountryIdByCode(countryCode).pipe(map(id => id)).toPromise()
        : Promise.resolve(null);

      filterPromise.then((countryId) => {
        let query = this.supabaseService.getClient()
          .from('commande')
          .select('total, statut, created_at, pays')
          .gte('created_at', startDate.toISOString());

        // Apply country filter by pays ID if available
        if (countryId) {
          query = query.eq('pays', countryId);
        }

        query.then(({ data, error }) => {
          if (error) {
            observer.error(error);
            return;
          }

          const orders = data || [];
          const analytics = this.processAnalyticsData(orders, labels, period);

          observer.next(analytics);
          observer.complete();
        }, (error: any) => {
          observer.error(error);
        });
      }, (error: any) => {
        observer.error(error);
      });
    });
  }

  /**
   * Fetch sales analytics (default implementation)
   */
  private fetchSalesAnalytics(): Observable<SalesAnalytics> {
    return this.fetchSalesAnalyticsByPeriod('all');
  }

  /**
   * Process analytics data based on orders
   */
  private processAnalyticsData(orders: any[], labels: string[], period: string): SalesAnalytics {
    const ordersData: number[] = [];
    const earningsData: number[] = [];
    const refundsData: number[] = [];

    labels.forEach((label, index) => {
      let periodOrders: any[];

      if (period === '1M') {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - (29 - index));
        periodOrders = orders.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate.toDateString() === targetDate.toDateString();
        });
      } else {
        // For months
        const targetMonth = period === '6M' 
          ? new Date().getMonth() - (5 - index)
          : index;
        
        periodOrders = orders.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate.getMonth() === targetMonth;
        });
      }

      ordersData.push(periodOrders.length);
      
      const earnings = periodOrders
        .filter(order => order.statut === 'livré')
        .reduce((sum, order) => sum + (parseFloat(order.total) || 0), 0);
      earningsData.push(earnings);

      const refunds = periodOrders
        .filter(order => order.statut === 'annulé')
        .reduce((sum, order) => sum + (parseFloat(order.total) || 0), 0);
      refundsData.push(refunds);
    });

    return {
      orders: ordersData,
      earnings: earningsData,
      refunds: refundsData,
      labels
    };
  }

  /**
   * Fetch country session data
   */
  private fetchCountrySessionData(): Observable<CountrySessionData[]> {
    return new Observable(observer => {
      // Since we don't have session tracking, we'll use order data by country if available
      // For now, return mock data based on common countries
      const mockData: CountrySessionData[] = [
        { country: 'France', sessions: 1640, flagCode: 'fr' },
        { country: 'Côte d\'Ivoire', sessions: 1010, flagCode: 'ci' },
        { country: 'Senegal', sessions: 800, flagCode: 'sn' },
        { country: 'Mali', sessions: 689, flagCode: 'ml' },
        { country: 'Burkina Faso', sessions: 589, flagCode: 'bf' },
        { country: 'Guinée', sessions: 490, flagCode: 'gn' },
        { country: 'Niger', sessions: 420, flagCode: 'ne' },
        { country: 'Togo', sessions: 1255, flagCode: 'tg' },
        { country: 'Benin', sessions: 1085, flagCode: 'bj' },
        { country: 'Ghana', sessions: 1050, flagCode: 'gh' }
      ];

      observer.next(mockData);
      observer.complete();
    });
  }

  /**
   * Fetch category sales data
   */
  private fetchCategoryData(countryCode?: string | null): Observable<SalesCategoryData[]> {
    return new Observable(observer => {
      // FK path: categorie -> produit -> variant -> commande_item
      this.supabaseService.getClient()
        .from('categorie')
        .select(`
          id,
          nom,
          produit(
            variant(commande_item(quantite))
          )
        `)
        .then(({ data, error }) => {
          if (error) {
            observer.error(error);
            return;
          }

          const categories = (data || []).map((category: any) => {
            const totalSales = category.produit?.reduce((sum: number, product: any) => {
              const variants = product.variant || [];
              const orders = variants.reduce((vSum: number, v: any) => {
                return vSum + (v.commande_item?.reduce((ciSum: number, ci: any) => 
                  ciSum + (ci.quantite || 0), 0) || 0);
              }, 0);
              return sum + orders;
            }, 0) || 0;

            return {
              category: category.nom || 'Autres',
              value: totalSales,
              percentage: 0 // Will be calculated below
            };
          });

          // Calculate percentages
          const totalSales = categories.reduce((sum, cat) => sum + cat.value, 0);
          if (totalSales > 0) {
            categories.forEach(cat => {
              cat.percentage = Math.round((cat.value / totalSales) * 100);
            });
          }

          // Sort by value and take top 5
          const topCategories = categories
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

          observer.next(topCategories);
          observer.complete();
        }, (error: any) => {
          observer.error(error);
        });
    });
  }

  /**
   * Helper methods for date labels
   */
  private getMonthLabels(): string[] {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  }

  private getLast6MonthsLabels(): string[] {
    const labels: string[] = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(months[date.getMonth()]);
    }
    
    return labels;
  }

  private getLast30DaysLabels(): string[] {
    const labels: string[] = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(now.getDate() - i);
      labels.push(date.getDate().toString());
    }
    
    return labels;
  }

  /**
   * Refresh all dashboard data
   */
  refreshDashboard(): void {
    this.initializeDashboardStreams();
  }
}
