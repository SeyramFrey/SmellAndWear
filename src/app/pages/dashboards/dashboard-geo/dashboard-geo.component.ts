import { Component, OnInit, OnDestroy } from '@angular/core';
import { ChartType } from '../dashboard/dashboard.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { 
  DashboardService, 
  DashboardStats, 
  BestSellingProduct, 
  TopSellingVendor, 
  RecentOrder,
  SalesAnalytics,
  SalesCategoryData,
  SalesByCityData
} from 'src/app/core/services/dashboard.service';

@Component({
  selector: 'app-dashboard-geo',
  templateUrl: './dashboard-geo.component.html',
  styleUrls: ['./dashboard-geo.component.scss']
})
export class DashboardGeoComponent implements OnInit, OnDestroy {
  breadCrumbItems!: Array<{}>;
  analyticsChart!: ChartType;
  BestSelling: BestSellingProduct[] = [];
  basicBarChart: any;
  TopSelling: TopSellingVendor[] = [];
  Recentelling: RecentOrder[] = [];
  SalesCategoryChart!: ChartType;
  statData: any[] = [];
  currentDate: any;
  
  // Dashboard data
  dashboardStats: DashboardStats | null = null;
  salesAnalytics: SalesAnalytics | null = null;
  categoryData: SalesCategoryData[] = [];
  salesByCityData: SalesByCityData[] = [];
  
  // Adapted data for legacy components
  adaptedBestSelling: any[] = [];
  adaptedRecentOrders: any[] = [];
  
  // Country filter
  selectedCountry: 'FR' | 'CI' | null = null;
  
  // Loading states
  loading = true;
  analyticsLoading = false;
  
  // Reactive cleanup
  private destroy$ = new Subject<void>();

  constructor(
    private dashboardService: DashboardService
  ) {
    // Load saved country preference from localStorage
    const savedCountry = localStorage.getItem('dashboard-geo-country');
    if (savedCountry === 'FR' || savedCountry === 'CI') {
      this.selectedCountry = savedCountry;
    }
    
    var date = new Date();
    var firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    var lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    this.currentDate = { from: firstDay, to: lastDay };
  }

  ngOnInit(): void {
    this.breadCrumbItems = [
      { label: 'Dashboards' },
      { label: 'Dashboard Geo', active: true }
    ];

    // Initialize charts before data loads (prevents 'Cannot read properties of undefined' errors)
    this._analyticsChart('["--vz-primary", "--vz-success", "--vz-danger"]');
    this._SalesCategoryChart('["--vz-primary", "--vz-success", "--vz-warning", "--vz-danger", "--vz-info"]');
    this._basicBarChart('["--vz-info", "--vz-info", "--vz-info", "--vz-info", "--vz-danger", "--vz-info", "--vz-info", "--vz-info", "--vz-info", "--vz-info"]');

    // Load data with country filter
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handle country filter change
   */
  onCountryChange(country: 'FR' | 'CI' | null): void {
    this.selectedCountry = country;
    localStorage.setItem('dashboard-geo-country', country || '');
    this.dashboardService.setCountryFilter(country);
    this.loadDashboardData();
  }

  /**
   * Load all dashboard data with country filter
   */
  private loadDashboardData(): void {
    this.loading = true;
    const countryCode = this.selectedCountry;

    // Load dashboard statistics
    this.dashboardService.getDashboardStats(countryCode).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (stats) => {
        this.dashboardStats = stats;
        this.updateStatData(stats);
      },
      error: (error) => {
        console.error('Error loading dashboard stats:', error);
      }
    });

    // Load best selling products
    this.dashboardService.getBestSellingProducts(countryCode).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (products) => {
        this.BestSelling = products;
        this.adaptedBestSelling = this.adaptBestSellingData(products);
      },
      error: (error) => {
        console.error('Error loading best selling products:', error);
      }
    });

    // Load top selling vendors
    this.dashboardService.getTopSellingVendors().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (vendors) => {
        this.TopSelling = vendors;
      },
      error: (error) => {
        console.error('Error loading top selling vendors:', error);
      }
    });

    // Load recent orders
    this.dashboardService.getRecentOrders(countryCode).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (orders) => {
        this.Recentelling = orders;
        this.adaptedRecentOrders = this.adaptRecentOrdersData(orders);
      },
      error: (error) => {
        console.error('Error loading recent orders:', error);
      }
    });

    // Load sales analytics
    this.dashboardService.getSalesAnalytics('all', countryCode).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (analytics) => {
        this.salesAnalytics = analytics;
        this.updateAnalyticsChart(analytics);
      },
      error: (error) => {
        console.error('Error loading sales analytics:', error);
      }
    });

    // Load sales by cities
    this.dashboardService.getSalesByCities(countryCode).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        this.salesByCityData = data;
        this.updateBasicBarChart(data);
      },
      error: (error) => {
        console.error('Error loading sales by cities data:', error);
      }
    });

    // Load category data
    this.dashboardService.getSalesCategoryData(countryCode).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        this.categoryData = data;
        this.updateSalesCategoryChart(data);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading category data:', error);
        this.loading = false;
      }
    });
  }

  /**
   * Update statistics data
   */
  private updateStatData(stats: DashboardStats): void {
    if (!stats) return;
    this.statData = [
      {
        title: 'TOTAL EARNINGS',
        value: stats.totalEarnings || 0,
        icon: 'bx-dollar-circle',
        persantage: (stats.earningsGrowth || 0).toFixed(2),
        profit: (stats.earningsGrowth || 0) >= 0 ? 'up' : 'down',
        link: 'View net earnings'
      },
      {
        title: 'ORDERS',
        value: stats.totalOrders || 0,
        icon: 'bx-shopping-bag',
        persantage: (stats.ordersGrowth || 0).toFixed(2),
        profit: (stats.ordersGrowth || 0) >= 0 ? 'up' : 'down',
        link: 'View all orders'
      },
      {
        title: 'CUSTOMERS',
        value: stats.totalCustomers || 0,
        icon: 'bx-user-circle',
        persantage: (stats.customersGrowth || 0).toFixed(2),
        profit: (stats.customersGrowth || 0) >= 0 ? 'up' : 'down',
        link: 'See details'
      },
      {
        title: 'MY BALANCE',
        value: stats.totalBalance || 0,
        icon: 'bx-wallet',
        persantage: (stats.balanceGrowth || 0).toFixed(2),
        profit: (stats.balanceGrowth || 0) >= 0 ? 'up' : 'down',
        link: 'Withdraw money'
      }
    ];
  }

  /**
   * Update analytics chart with real data
   */
  private updateAnalyticsChart(analytics: SalesAnalytics): void {
    if (this.analyticsChart) {
      this.analyticsChart.series = [
        {
          name: 'Orders',
          type: 'area',
          data: analytics.orders
        },
        {
          name: 'Earnings',
          type: 'bar',
          data: analytics.earnings
        },
        {
          name: 'Refunds',
          type: 'line',
          data: analytics.refunds
        }
      ];
    }
  }

  /**
   * Update basic bar chart with sales by cities data
   */
  private updateBasicBarChart(data: SalesByCityData[]): void {
    const cities = data.map(item => item.city);
    const revenues = data.map(item => item.totalRevenue);
    
    this._basicBarChart('["--vz-info", "--vz-info", "--vz-info", "--vz-info", "--vz-danger", "--vz-info", "--vz-info", "--vz-info", "--vz-info", "--vz-info"]');
    
    if (this.basicBarChart) {
      this.basicBarChart.series = [{
        data: revenues,
        name: 'Revenue',
      }];
      this.basicBarChart.xaxis.categories = cities;
    }
  }

  /**
   * Update sales category chart with real data
   */
  private updateSalesCategoryChart(data: SalesCategoryData[]): void {
    if (this.SalesCategoryChart) {
      this.SalesCategoryChart.series = data.map(item => item.value);
      this.SalesCategoryChart.labels = data.map(item => item.category);
    }
  }

  /**
   * Adapt best selling data for legacy component
   */
  private adaptBestSellingData(products: BestSellingProduct[]): any[] {
    return products.map(product => ({
      image: product.image,
      pName: product.name,
      date: product.date,
      price: product.price.toFixed(2),
      orders: product.orders.toString(),
      stock: product.stock > 0 ? product.stock.toString() : 'Out of stock',
      amount: product.amount.toFixed(2)
    }));
  }

  /**
   * Adapt recent orders data for legacy component
   */
  private adaptRecentOrdersData(orders: RecentOrder[]): any[] {
    return orders.map(order => ({
      id: order.orderNumber,
      image: order.customerImage,
      customer: order.customerName,
      product: order.productCategory,
      amount: order.amount.toFixed(2),
      vendor: order.vendor,
      status: order.status,
      rating: order.rating.toFixed(1),
      average: Math.floor(order.rating * 20).toString()
    }));
  }

  num: number = 0;
  option = {
    startVal: this.num,
    useEasing: true,
    duration: 2,
    decimalPlaces: 2,
  };

  private _basicBarChart(colors: any) {
    colors = this.getChartColorsArray(colors);
    this.basicBarChart = {
      series: [{
        data: [],
        name: 'Revenue',
      }],
      chart: {
        type: 'bar',
        height: 400,
        direction: 'rtl',
        toolbar: {
          show: false,
        }
      },
      plotOptions: {
        bar: {
          borderRadius: 4,
          horizontal: true,
          distributed: true,
          dataLabels: {
            position: 'top',
          },
        }
      },
      dataLabels: {
        enabled: true,
        offsetX: 32,
        style: {
          fontSize: '12px',
          fontWeight: 400,
          colors: ['#adb5bd']
        }
      },
      colors: colors,
      legend: {
        show: false,
      },
      grid: {
        show: false,
      },
      xaxis: {
        categories: [],
      },
    };
  }

  private _analyticsChart(colors: any) {
    colors = this.getChartColorsArray(colors);
    this.analyticsChart = {
      chart: {
        height: 370,
        type: "line",
        toolbar: {
          show: false,
        },
        style: {
          direction: 'rtl'
        }
      },
      stroke: {
        curve: "straight",
        dashArray: [0, 0, 8],
        width: [2, 0, 2.2],
      },
      colors: colors,
      series: [],
      fill: {
        opacity: [0.1, 0.9, 1],
      },
      labels: [],
      markers: {
        size: [0, 0, 0],
        strokeWidth: 2,
        hover: {
          size: 4,
        },
      },
      xaxis: {
        categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        axisTicks: {
          show: false,
        },
        axisBorder: {
          show: false,
        },
      },
      grid: {
        show: true,
        xaxis: {
          lines: {
            show: true,
          },
        },
        yaxis: {
          lines: {
            show: false,
          },
        },
        padding: {
          top: 0,
          right: -2,
          bottom: 15,
          left: 10,
        },
      },
      legend: {
        show: true,
        horizontalAlign: "center",
        offsetX: 0,
        offsetY: -5,
        markers: {
          width: 9,
          height: 9,
          radius: 6,
        },
        itemMargin: {
          horizontal: 10,
          vertical: 0,
        },
      },
      plotOptions: {
        bar: {
          columnWidth: "30%",
          barHeight: "70%",
        },
      },
    };
  }

  private _SalesCategoryChart(colors: any) {
    colors = this.getChartColorsArray(colors);
    this.SalesCategoryChart = {
      series: [],
      labels: [],
      chart: {
        height: 333,
        type: "donut",
      },
      legend: {
        position: "bottom",
      },
      stroke: {
        show: false
      },
      dataLabels: {
        dropShadow: {
          enabled: false,
        },
      },
      colors: colors
    };
  }

  private getChartColorsArray(colors: any) {
    colors = JSON.parse(colors);
    return colors.map(function (value: any) {
      var newValue = value.replace(" ", "");
      if (newValue.indexOf(",") === -1) {
        var color = getComputedStyle(document.documentElement).getPropertyValue(newValue);
        if (color) {
          color = color.replace(" ", "");
          return color;
        }
        else return newValue;;
      } else {
        var val = value.split(',');
        if (val.length == 2) {
          var rgbaColor = getComputedStyle(document.documentElement).getPropertyValue(val[0]);
          rgbaColor = "rgba(" + rgbaColor + "," + val[1] + ")";
          return rgbaColor;
        } else {
          return newValue;
        }
      }
    });
  }

  setrevenuevalue(value: any) {
    this.analyticsLoading = true;
    this.dashboardService.getSalesAnalytics(value, this.selectedCountry).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (analytics) => {
        this.salesAnalytics = analytics;
        this.analyticsChart.series = [
          {
            name: 'Orders',
            type: 'area',
            data: analytics.orders
          },
          {
            name: 'Earnings',
            type: 'bar',
            data: analytics.earnings
          },
          {
            name: 'Refunds',
            type: 'line',
            data: analytics.refunds
          }
        ];
        this.analyticsLoading = false;
      },
      error: (error) => {
        console.error('Error loading analytics for period:', value, error);
        this.analyticsLoading = false;
      }
    });
  }

  selectCityValue(period: 'all' | '1M' | '6M'): void {
    this.dashboardService.getSalesByCities(this.selectedCountry).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        this.salesByCityData = data;
        this.updateBasicBarChart(data);
      },
      error: (error) => {
        console.error('Error loading sales by cities data:', error);
      }
    });
  }

  /**
   * Get total refunds from sales analytics
   */
  getTotalRefunds(): number {
    if (!this.salesAnalytics || !this.salesAnalytics.refunds) {
      return 0;
    }
    return this.salesAnalytics.refunds.reduce((a, b) => a + b, 0);
  }

  /**
   * Get average order value
   */
  getAverageOrderValue(): number {
    if (!this.dashboardStats || this.dashboardStats.totalOrders === 0) {
      return 0;
    }
    return this.dashboardStats.totalEarnings / this.dashboardStats.totalOrders;
  }
}
