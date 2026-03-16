import { Component, OnInit, TemplateRef, ViewChild, OnDestroy } from '@angular/core';
import { ToastService } from 'src/app/core/services/toast.service';

import { circle, latLng, tileLayer } from 'leaflet';

import { ChartType } from './dashboard.model';
import { Subject } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';
import { 
  DashboardService, 
  DashboardStats, 
  BestSellingProduct, 
  TopSellingVendor, 
  RecentOrder,
  SalesAnalytics,
  CountrySessionData,
  SalesCategoryData,
  SalesByCityData
} from 'src/app/core/services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})

/**
 * Ecommerce Component
 */
export class DashboardComponent implements OnInit, OnDestroy {

  // bread crumb items
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
  countryData: CountrySessionData[] = [];
  categoryData: SalesCategoryData[] = [];
  salesByCityData: SalesByCityData[] = [];
  
  // Adapted data for legacy components
  adaptedBestSelling: any[] = [];
  adaptedRecentOrders: any[] = [];
  
  // Loading states
  loading = true;
  analyticsLoading = false;
  
  // Reactive cleanup
  private destroy$ = new Subject<void>();

  constructor(
    public toastService: ToastService,
    private dashboardService: DashboardService
  ) {
    var date = new Date();
    var firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    var lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    this.currentDate = { from: firstDay, to: lastDay }
  }

  ngOnInit(): void {
    /**
     * BreadCrumb
     */
    this.breadCrumbItems = [
      { label: 'Dashboards' },
      { label: 'Dashboard', active: true }
    ];

    if (sessionStorage.getItem('toast')) {
      this.toastService.success('Logged in successfully.');
      sessionStorage.removeItem('toast');
    }

    // Initialize charts before data loads (prevents 'Cannot read properties of undefined' errors)
    this._analyticsChart('["--vz-primary", "--vz-success", "--vz-danger"]');
    this._SalesCategoryChart('["--vz-primary", "--vz-success", "--vz-warning", "--vz-danger", "--vz-info"]');
    this._basicBarChart('["--vz-info", "--vz-info", "--vz-info", "--vz-info", "--vz-danger", "--vz-info", "--vz-info", "--vz-info", "--vz-info", "--vz-info"]');

    // Load real data from Supabase
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


  num: number = 0;
  option = {
    startVal: this.num,
    useEasing: true,
    duration: 2,
    decimalPlaces: 2,
  };

  /**
   * Load all dashboard data from Supabase
   */
  private loadDashboardData(): void {
    this.loading = true;

    // Load dashboard statistics
    this.dashboardService.getDashboardStats().pipe(
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
    this.dashboardService.getBestSellingProducts().pipe(
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
    this.dashboardService.getRecentOrders().pipe(
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
    this.dashboardService.getSalesAnalytics().pipe(
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

    // Load sales by cities data (replaces country session data)
    this.dashboardService.getSalesByCities().pipe(
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
    this.dashboardService.getSalesCategoryData().pipe(
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


  selectCityValue(period: 'all' | '1M' | '6M'): void {
    // Reload sales by cities data based on period
    // Note: For now, we show all data. In the future, we can add period filtering
    this.dashboardService.getSalesByCities().pipe(
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

  // Chart Colors Set
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

  /**
 * Sales Analytics Chart - Load real data based on period
 */
  setrevenuevalue(value: any) {
    this.analyticsLoading = true;
    
    // Load analytics data for the selected period
    this.dashboardService.getSalesAnalytics(value).pipe(
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
      series: [{
        name: 'Orders',
        type: 'area',
        data: [34, 65, 46, 68, 49, 61, 42, 44, 78, 52, 63, 67]
      }, {
        name: 'Earnings',
        type: 'bar',
        data: [89.25, 98.58, 68.74, 108.87, 77.54, 84.03, 51.24, 28.57, 92.57, 42.36,
          88.51, 36.57]
      }, {
        name: 'Refunds',
        type: 'line',
        data: [8, 12, 7, 17, 21, 11, 5, 9, 7, 29, 12, 35]
      }],
      fill: {
        opacity: [0.1, 0.9, 1],
      },
      labels: ['01/01/2003', '02/01/2003', '03/01/2003', '04/01/2003', '05/01/2003', '06/01/2003', '07/01/2003', '08/01/2003', '09/01/2003', '10/01/2003', '11/01/2003'],
      markers: {
        size: [0, 0, 0],
        strokeWidth: 2,
        hover: {
          size: 4,
        },
      },
      xaxis: {
        categories: [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ],
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

  /**
 *  Sales Category
 */
  private _SalesCategoryChart(colors: any) {
    colors = this.getChartColorsArray(colors);
    this.SalesCategoryChart = {
      series: [44, 55, 41, 17, 15],
      labels: ["Direct", "Social", "Email", "Other", "Referrals"],
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

  /**
   * Refresh dashboard data
   */
  refreshDashboard() {
    this.dashboardService.refreshDashboard();
    this.loadDashboardData();
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

  /**
 * Sale Location Map
 */
  options = {
    layers: [
      tileLayer("https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoidGhlbWVzYnJhbmQiLCJhIjoiY2xmbmc3bTV4MGw1ejNzbnJqOWpubzhnciJ9.DNkdZVKLnQ6I9NOz7EED-w", {
        id: "mapbox/light-v9",
        tileSize: 512,
        zoomOffset: 0,
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
      })
    ],
    zoom: 1.1,
    center: latLng(28, 1.5)
  };
  layers = [
    circle([41.9, 12.45], { color: "#435fe3", opacity: 0.5, weight: 10, fillColor: "#435fe3", fillOpacity: 1, radius: 400000, }),
    circle([12.05, -61.75], { color: "#435fe3", opacity: 0.5, weight: 10, fillColor: "#435fe3", fillOpacity: 1, radius: 400000, }),
    circle([1.3, 103.8], { color: "#435fe3", opacity: 0.5, weight: 10, fillColor: "#435fe3", fillOpacity: 1, radius: 400000, }),
  ];

  /**
 * Swiper Vertical  
   */
  Vertical = {
    infinite: true,
    autoplay: true,
    autoplaySpeed: 2000,
    slidesToShow: 2,
    slidesToScroll: 1,
    arrows: false,
    vertical: true // Enable vertical sliding
  };

  /**
   * Recent Activity
   */
  toggleActivity() {
    const recentActivity = document.querySelector('.layout-rightside-col');
    if (recentActivity != null) {
      recentActivity.classList.toggle('d-none');
    }

    if (document.documentElement.clientWidth <= 767) {
      const recentActivity = document.querySelector('.layout-rightside-col');
      if (recentActivity != null) {
        recentActivity.classList.add('d-block');
        recentActivity.classList.remove('d-none');
      }
    }
  }

  /**
   * SidebarHide modal
   * @param content modal content
   */
  SidebarHide() {
    const recentActivity = document.querySelector('.layout-rightside-col');
    if (recentActivity != null) {
      recentActivity.classList.remove('d-block');
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
      average: Math.floor(order.rating * 20).toString() // Convert to percentage
    }));
  }

}
