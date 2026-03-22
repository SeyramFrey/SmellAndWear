import {Component, EventEmitter, Inject, OnInit, Output, TemplateRef, ViewChild, OnDestroy, ChangeDetectorRef} from '@angular/core';
import {Router, RouterLink} from "@angular/router";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {
  NgbDropdown,
  NgbDropdownMenu,
  NgbDropdownToggle, NgbModal
} from "@ng-bootstrap/ng-bootstrap";
import { TokenStorageService } from '../../../../core/services/token-storage.service';
import {SimplebarAngularModule} from "simplebar-angular";
import {CartModel} from "../../../../layouts/topbar/topbar.model";
import {DOCUMENT, NgClass, NgForOf, NgIf} from "@angular/common";
import { ConvertPricePipe } from '../../../pipes/convert-price.pipe';
import {EventService} from "../../../../core/services/event.service";
import {LanguageService} from "../../../../core/services/language.service";
import {CookieService} from "ngx-cookie-service";
import {TranslateService} from "@ngx-translate/core";
import { allNotification, messages } from './data'
import { cartData } from './data';
import { CartService, CartItem } from '../../../../core/services/cart.service';
import { Subscription, from, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { TranslateModule } from '@ngx-translate/core';
import { CurrencyService, CurrencyCode } from '../../../../core/services/currency.service';
import { CountryCurrencyService, Country } from '../../../../core/services/country-currency.service';
import { CurrencyConverterPipe } from '../../../pipes/currency-converter.pipe';
import { CategorieService } from '../../../../core/services/categorie.service';
import { ProductService } from '../../../../core/services/product.service';
import { Categorie, Produit } from '../../../../core/models/models';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { ImageService, IMAGE_SIZES } from '../../../../core/services/image.service';
import { SearchBarComponent } from '../search-bar/search-bar.component';
import { SupabaseAuthService } from '../../../../core/services/supabase-auth.service';
import { FavoritesService } from '../../../../core/services/favorites.service';
import { CustomerService } from '../../../../core/services/customer.service';
import { ThemeService, ThemeMode } from '../../../../core/services/theme.service';


@Component({
  selector: 'app-topbar-landing',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    NgbDropdown,
    NgbDropdownMenu,
    NgbDropdownToggle,
    NgClass,
    SimplebarAngularModule,
    TranslateModule,
    CurrencyConverterPipe,
    NgForOf,
    NgIf,
    SearchBarComponent
  ],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss'
})
export class TopbarComponent implements OnInit, OnDestroy {

  messages: any
  element: any;
  mode: string | undefined;
  @Output() mobileMenuButtonClicked = new EventEmitter();
  allnotifications: any
  flagvalue: any;
  valueset: any;
  countryName: any;
  cookieValue: any;
  userData: any;
  cartData!: CartModel[];
  total = 0;
  cart_length: any = 0;
  totalNotify: number = 0;
  newNotify: number = 0;
  readNotify: number = 0;
  isDropdownOpen = false;
  @ViewChild('removenotification') removenotification !: TemplateRef<any>;
  @ViewChild('cartDropdown', { static: false }) cartDropdown!: NgbDropdown;
  notifyId: any;
  isMenuOpen: boolean = false;

  // Cart data
  cartItems: CartItem[] = [];
  cartItemCount: number = 0;
  cartTotal: number = 0;
  private cartSubscriptions: Subscription[] = [];
  private previousCartCount: number = 0;

  // Country/Currency data
  selectedCountry: Country | null = null;
  countries: Country[] = [];
  isCountryLoading: boolean = false;

  // Navigation links data
  navigationLinks = [
    { name: 'BEST SELLERS', route: '/best-sellers' },
    { name: 'NEW', route: '/news', hasPromo: true },
    { name: 'SHOP', route: '/shop' },
    //{ name: 'EXCLUSIVE', route: '/exclusive' },
    //{ name: 'VIBES', route: '/vibes' },
    { name: 'STEALS DEALS', route: '/steals-deals' },
    { name: 'LOOKBOOK', route: '/lookbook' }
  ];

  // Category IDs for "Tous les" links
  readonly CATEGORY_IDS = {
    HAUTS: '5a1b65c2-ba4f-4032-8e89-8bd30142ecfd',
    BAS: '1f29215b-1100-4940-9bb3-5e22ffed96e0',
    ACCESSOIRES: '9e78e906-ee6e-41ef-865f-3abe4fb3e9ba'
  };

  // Current promotion percentage for NEW badge
  currentPromoPercentage: string = '15%';

  // Mega menu data and state
  categories: Categorie[] = [];
  subcategories: Categorie[] = [];
  selectedCategoryId: string | null = null;
  isMegaMenuOpen: boolean = false;
  megaMenuHoverTimeout: any;
  megaMenuCloseTimeout: any;

  // New products for right side
  newProducts: Produit[] = [];
  
  // Scroll state for color changes
  isScrolled: boolean = false;

  // Mobile menu state
  isMobileMenuOpen: boolean = false;
  isMobileShopOpen: boolean = false;
  selectedMobileCategoryId: string | null = null;

  // Search bar state
  isSearchBarOpen: boolean = false;

  // Auth state
  isUserAuthenticated: boolean = false;
  userEmail: string | null = null;
  userFirstName: string | null = null;

  // Favorites state
  favoritesCount: number = 0;

  // Theme state
  isDarkMode: boolean = false;

  // White mode state (for transparent topbar with white icons/logo)
  isWhiteMode: boolean = false;
  currentRoute: string = '';
  routeExceptions: string[] = ['/checkout', '/product', '/product-detail'];
  
  // Special page detection (for special icon styling - icons stay black)
  isCheckoutPage: boolean = false;
  isProductDetailPage: boolean = false;

  constructor(
    @Inject(DOCUMENT) private document: any, 
    private eventService: EventService, 
    public languageService: LanguageService, 
    private modalService: NgbModal,
    public _cookiesService: CookieService, 
    public translate: TranslateService,
    private router: Router, 
    private tokenStorageService: TokenStorageService, 
    private cartService: CartService,
    private currencyService: CurrencyService, 
    private countryCurrencyService: CountryCurrencyService,
    private categorieService: CategorieService, 
    private produitService: ProductService, 
    private supabaseService: SupabaseService,
    private imageService: ImageService,
    private cdr: ChangeDetectorRef,
    private authService: SupabaseAuthService,
    private favoritesService: FavoritesService,
    private customerService: CustomerService,
    private themeService: ThemeService
  ) { }

  ngOnInit(): void {
    this.userData = this.tokenStorageService.getUser();
    this.element = document.documentElement;

    // Initialize country/currency system
    this.initializeCountryCurrency();

    // Subscribe to auth state
    this.subscribeToAuthState();

    // Subscribe to favorites
    this.subscribeToFavorites();

    // Subscribe to theme changes
    this.subscribeToTheme();

    // Subscribe to route changes for white mode exceptions
    this.subscribeToRouteChanges();

    // Fetch Data
    this.allnotifications = allNotification;
    this.messages = messages;
    this.cartData = cartData;
    this.cart_length = this.cartData.length;
    this.cartData.forEach((item) => {
      var item_price = item.quantity * item.price
      this.total += item_price
    });

    // Subscribe to cart changes
    this.subscribeToCartChanges();
    
    // Add resize listener to handle mobile/desktop transitions
    this.addResizeListener();

    // Load categories and new products for mega menu
    this.loadCategories();
    this.loadNewProducts();
  }

  /**
   * Subscribe to authentication state changes
   * 
   * IMPORTANT: Admin users should appear as guests on the landing/storefront.
   * Only 'user' role (regular clients) should see authenticated UI.
   */
  private subscribeToAuthState(): void {
    this.cartSubscriptions.push(
      this.authService.session$.subscribe(session => {
        // Check if user is admin - admins should appear as guests on landing
        const role = this.authService.getCurrentRole();
        const isAdmin = role === 'admin';
        
        // Only show authenticated UI for non-admin users
        this.isUserAuthenticated = !!session && !isAdmin;
        this.userEmail = (!isAdmin && session?.user?.email) ? session.user.email : null;
        
        if (isAdmin) {
          console.log('[Topbar] Admin detected - showing guest UI');
        }
      })
    );

    this.cartSubscriptions.push(
      this.customerService.client$.subscribe(client => {
        this.userFirstName = client?.prenom || null;
      })
    );
  }

  /**
   * Subscribe to favorites count
   */
  private subscribeToFavorites(): void {
    this.cartSubscriptions.push(
      this.favoritesService.favoritesCount$.subscribe(count => {
        this.favoritesCount = count;
      })
    );
  }

  /**
   * Subscribe to theme changes
   */
  private subscribeToTheme(): void {
    this.cartSubscriptions.push(
      this.themeService.isDarkMode$.subscribe(isDark => {
        this.isDarkMode = isDark;
        this.updateWhiteMode(); // re-evaluate logo immediately when mode changes
      })
    );

    // Also subscribe to scroll state from theme service
    this.cartSubscriptions.push(
      this.themeService.isScrolled$.subscribe(isScrolled => {
        this.isScrolled = isScrolled;
        this.updateWhiteMode(); // belt-and-suspenders (windowScroll also calls this)
      })
    );
  }

  /**
   * Toggle dark/light mode
   */
  toggleDarkMode(): void {
    this.themeService.toggleTheme();
  }

  /**
   * Subscribe to route changes to determine white mode exceptions
   */
  private subscribeToRouteChanges(): void {
    this.cartSubscriptions.push(
      this.router.events.subscribe(() => {
        this.currentRoute = this.router.url;
        this.updateWhiteMode();
      })
    );
    // Initial route check
    this.currentRoute = this.router.url;
    this.updateWhiteMode();
  }

  /**
   * Update white mode based on scroll state, theme, and current route.
   *
   * White logo/icons are shown when:
   * (a) Desktop transparent state: ≥1200px wide, not scrolled, not on exception route
   * (b) Desktop dark mode scrolled: ≥1200px wide, scrolled, dark mode active
   *     → dark logo on black background would be invisible; show white logo instead
   *
   * Mobile/tablet (< 1200px): always use dark logo (solid white background).
   */
  private updateWhiteMode(): void {
    // Align with CSS breakpoint — desktop starts at 1200px (SCSS uses min-width: 1200px)
    const isMobile = window.innerWidth < 1200;
    const isExceptionRoute = this.routeExceptions.some(exception =>
      this.currentRoute.startsWith(exception)
    );

    // (a) Transparent state: desktop, not scrolled, not exception route
    const isTransparentState = !isMobile && !this.isScrolled && !isExceptionRoute;
    // (b) Dark scrolled: desktop, scrolled, dark mode — white logo needed on black bg
    const isDarkScrolled = !isMobile && this.isScrolled && this.isDarkMode;

    this.isWhiteMode = isTransparentState || isDarkScrolled;

    // Detect special pages for icon styling
    this.isCheckoutPage = this.currentRoute.startsWith('/checkout');
    this.isProductDetailPage = this.currentRoute.startsWith('/product-detail');
  }

  /**
   * Initialize country and currency system
   */
  private initializeCountryCurrency(): void {
    // Get available countries
    this.countries = this.countryCurrencyService.getCountries();
    
    // Subscribe to country changes
    this.cartSubscriptions.push(
      this.countryCurrencyService.selectedCountry$.subscribe(country => {
        this.selectedCountry = country;
        this.updateFlagDisplay(country);
      })
    );

    // Subscribe to loading state
    this.cartSubscriptions.push(
      this.countryCurrencyService.isLoading$.subscribe(loading => {
        this.isCountryLoading = loading;
      })
    );
  }

  /**
   * Update flag display based on selected country
   */
  private updateFlagDisplay(country: Country): void {
    this.countryName = country.name;
    this.flagvalue = country.flag;
    this.cookieValue = country.code.toLowerCase();
    
    // Update legacy currency service for backward compatibility
    const currency = country.currency as CurrencyCode;
    this.currencyService.setCurrency(currency);
    
    console.log(`Country updated to ${country.name}, currency: ${country.currency}`);
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.cartSubscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Subscribe to cart changes to update UI
   */
  private subscribeToCartChanges(): void {
    // Subscribe to cart items
    this.cartSubscriptions.push(
      this.cartService.cartItems$.subscribe(items => {
        this.cartItems = items;
        console.log('CartItems mis à jour:', items);
      })
    );
    
    // Subscribe to cart count
    this.cartSubscriptions.push(
      this.cartService.cartCount$.subscribe(count => {
        // Only open cart when count increases AND previousCartCount was already initialized
        // This prevents auto-opening on first load
        if (count > this.previousCartCount && this.previousCartCount > 0) {
          this.openCartDropdown();
        }
        
        this.previousCartCount = count;
        this.cartItemCount = count;
      })
    );
    
    // Subscribe to cart total
    this.cartSubscriptions.push(
      this.cartService.cartTotal$.subscribe(total => {
        this.cartTotal = total;
      })
    );
  }
  
  /**
   * Open cart dropdown programmatically
   */
  private openCartDropdown(): void {
    // Use setTimeout to ensure the view has been updated
    setTimeout(() => {
      if (this.cartDropdown) {
        this.cartDropdown.open();
        this.cdr.detectChanges();
        console.log('Cart dropdown opened automatically');
      }
    }, 100);
  }

  /**
   * Handle mouse enter on cart (desktop only)
   */
  onCartMouseEnter(): void {
    // Only auto-open on hover for desktop
    if (window.innerWidth >= 768) {
      setTimeout(() => {
        if (this.cartDropdown && !this.cartDropdown.isOpen()) {
          this.cartDropdown.open();
        }
      }, 200);
    }
  }

  /**
   * Handle mouse leave on cart
   */
  onCartMouseLeave(): void {
    // Cart will close automatically due to autoClose behavior
    // No action needed
  }
  
  /**
   * Remove item from cart
   */
  removeCartItem(itemId: string): void {
    this.cartService.removeFromCart(itemId);
  }
  
  /**
   * Update quantity for cart item
   */
  updateCartItemQuantity(itemId: string, newQuantity: number): void {
    this.cartService.updateItemQuantity(itemId, newQuantity);
  }
  
  /**
   * Clear entire cart
   */
  clearCart(): void {
    this.cartService.clearCart();
  }
  
  /**
   * Navigate to checkout page
   */
  goToCheckout(): void {
    // Implement navigation to checkout page
    window.location.href = '/checkout';
  }


  /**
   * Toggle the menu bar when having mobile screen
   */
  toggleMobileMenu(event: any) {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    this.isMenuOpen = this.isMobileMenuOpen; // Keep compatibility with existing code
    
    // Reset mobile menu state when closing
    if (!this.isMobileMenuOpen) {
      this.isMobileShopOpen = false;
      this.selectedMobileCategoryId = null;
    }
    
    if (this.isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  /**
   * Fullscreen method
   */
  fullscreen() {
    document.body.classList.toggle('fullscreen-enable');
    if (
        !document.fullscreenElement && !this.element.mozFullScreenElement &&
        !this.element.webkitFullscreenElement) {
      if (this.element.requestFullscreen) {
        this.element.requestFullscreen();
      } else if (this.element.mozRequestFullScreen) {
        /* Firefox */
        this.element.mozRequestFullScreen();
      } else if (this.element.webkitRequestFullscreen) {
        /* Chrome, Safari and Opera */
        this.element.webkitRequestFullscreen();
      } else if (this.element.msRequestFullscreen) {
        /* IE/Edge */
        this.element.msRequestFullscreen();
      }
    } else {
      if (this.document.exitFullscreen) {
        this.document.exitFullscreen();
      } else if (this.document.mozCancelFullScreen) {
        /* Firefox */
        this.document.mozCancelFullScreen();
      } else if (this.document.webkitExitFullscreen) {
        /* Chrome, Safari and Opera */
        this.document.webkitExitFullscreen();
      } else if (this.document.msExitFullscreen) {
        /* IE/Edge */
        this.document.msExitFullscreen();
      }
    }
  }
  /**
   * Open modal
   * @param content modal content
   */
  openModal(content: any) {
    // this.submitted = false;
    this.modalService.open(content, { centered: true });
  }

  /**
   * Topbar Light-Dark Mode Change
   * Now uses ThemeService for centralized theme management
   */
  changeMode(mode: string) {
    this.mode = mode;
    this.eventService.broadcast('changeMode', mode);
    
    // Use theme service for proper persistence
    if (mode === 'light' || mode === 'dark') {
      this.themeService.setTheme(mode as ThemeMode);
    }
  }

  /***
   * Language Listing
   */
  listLang = [
    { text: "Côte d'ivoire", flag: 'assets/images/flags/ci.svg', lang: 'ci' },
    { text: 'France', flag: 'assets/images/flags/french.svg', lang: 'fr' },


    /*{ text: 'Española', flag: 'assets/images/flags/spain.svg', lang: 'es' },
    { text: 'Deutsche', flag: 'assets/images/flags/germany.svg', lang: 'de' },
    { text: 'Italiana', flag: 'assets/images/flags/italy.svg', lang: 'it' },
    { text: 'русский', flag: 'assets/images/flags/russia.svg', lang: 'ru' },
    { text: '中国人', flag: 'assets/images/flags/china.svg', lang: 'ch' },
    { text: 'français', flag: 'assets/images/flags/french.svg', lang: 'fr' },
    { text: 'Arabic', flag: 'assets/images/flags/ar.svg', lang: 'ar' },*/
  ];

  /***
   * Language Value Set with Currency Switching
   */
  setCountry(text: string, lang: string, flag: string) {
    // Map old lang codes to new country codes
    let countryCode = '';
    if (lang === 'fr') {
      countryCode = 'FR';
    } else if (lang === 'ci') {
      countryCode = 'CI';
    }
    
    if (countryCode) {
      this.countryCurrencyService.setCountry(countryCode);
      this.languageService.setLanguage(lang);
    }
  }

  /**
   * Set country using new service
   */
  selectCountry(countryCode: string): void {
    this.countryCurrencyService.setCountry(countryCode);
  }

  /**
   * Logout the user
   */
  async logout(): Promise<void> {
    try {
      await this.authService.signOut();
      this.router.navigate(['/']);
    } catch (error) {
      console.error('[TopbarLanding] Logout error:', error);
    }
  }

  /**
   * Navigate to account page or login
   */
  navigateToAccount(): void {
    if (this.isUserAuthenticated) {
      this.router.navigate(['/account']);
    } else {
      this.router.navigate(['/customer/login']);
    }
    this.closeMobileMenu();
  }

  /**
   * Navigate to favorites page
   */
  navigateToFavorites(): void {
    this.router.navigate(['/account/favorites']);
    this.closeMobileMenu();
  }

  /**
   * Navigate to login page
   */
  navigateToLogin(): void {
    this.router.navigate(['/customer/login']);
    this.closeMobileMenu();
  }

  /**
   * Navigate to signup page
   */
  navigateToSignup(): void {
    this.router.navigate(['/customer/signup']);
    this.closeMobileMenu();
  }

  // Delete Item
  deleteItem(event: any, id: any) {
    var price = event.target.closest('.dropdown-item').querySelector('.item_price').innerHTML;
    var Total_price = this.total - price;
    this.total = Total_price;
    this.cart_length = this.cart_length - 1;
    this.total > 1 ? (document.getElementById("empty-cart") as HTMLElement).style.display = "none" : (document.getElementById("empty-cart") as HTMLElement).style.display = "block";
    document.getElementById('item_' + id)?.remove();
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    if (this.isDropdownOpen) {
      this.isDropdownOpen = false;
    } else {
      this.isDropdownOpen = true;
    }
  }
  // Search Topbar
  Search() {
    var searchOptions = document.getElementById("search-close-options") as HTMLAreaElement;
    var dropdown = document.getElementById("search-dropdown") as HTMLAreaElement;
    var input: any, filter: any, ul: any, li: any, a: any | undefined, i: any, txtValue: any;
    input = document.getElementById("search-options") as HTMLAreaElement;
    filter = input.value.toUpperCase();
    var inputLength = filter.length;

    if (inputLength > 0) {
      dropdown.classList.add("show");
      searchOptions.classList.remove("d-none");
      var inputVal = input.value.toUpperCase();
      var notifyItem = document.getElementsByClassName("notify-item");

      Array.from(notifyItem).forEach(function (element: any) {
        var notifiTxt = ''
        if (element.querySelector("h6")) {
          var spantext = element.getElementsByTagName("span")[0].innerText.toLowerCase()
          var name = element.querySelector("h6").innerText.toLowerCase()
          if (name.includes(inputVal)) {
            notifiTxt = name
          } else {
            notifiTxt = spantext
          }
        } else if (element.getElementsByTagName("span")) {
          notifiTxt = element.getElementsByTagName("span")[0].innerText.toLowerCase()
        }
        if (notifiTxt)
          element.style.display = notifiTxt.includes(inputVal) ? "block" : "none";

      });
    } else {
      dropdown.classList.remove("show");
      searchOptions.classList.add("d-none");
    }
  }

  /**
   * Search Close Btn
   */
  closeBtn() {
    var searchOptions = document.getElementById("search-close-options") as HTMLAreaElement;
    var dropdown = document.getElementById("search-dropdown") as HTMLAreaElement;
    var searchInputReponsive = document.getElementById("search-options") as HTMLInputElement;
    dropdown.classList.remove("show");
    searchOptions.classList.add("d-none");
    searchInputReponsive.value = "";
  }

  // Remove Notification
  checkedValGet: any[] = [];
  onCheckboxChange(event: any, id: any) {
    this.notifyId = id
    var result;
    if (id == '1') {
      var checkedVal: any[] = [];
      for (var i = 0; i < this.allnotifications.length; i++) {
        if (this.allnotifications[i].state == true) {
          result = this.allnotifications[i].id;
          checkedVal.push(result);
        }
      }
      this.checkedValGet = checkedVal;
    } else {
      var checkedVal: any[] = [];
      for (var i = 0; i < this.messages.length; i++) {
        if (this.messages[i].state == true) {
          result = this.messages[i].id;
          checkedVal.push(result);
        }
      }
      this.checkedValGet = checkedVal;
    }
    checkedVal.length > 0 ? (document.getElementById("notification-actions") as HTMLElement).style.display = 'block' : (document.getElementById("notification-actions") as HTMLElement).style.display = 'none';
  }

  notificationDelete() {
    if (this.notifyId == '1') {
      for (var i = 0; i < this.checkedValGet.length; i++) {
        for (var j = 0; j < this.allnotifications.length; j++) {
          if (this.allnotifications[j].id == this.checkedValGet[i]) {
            this.allnotifications.splice(j, 1)
          }
        }
      }
    } else {
      for (var i = 0; i < this.checkedValGet.length; i++) {
        for (var j = 0; j < this.messages.length; j++) {
          if (this.messages[j].id == this.checkedValGet[i]) {
            this.messages.splice(j, 1)
          }
        }
      }
    }
    this.calculatenotification()
    this.modalService.dismissAll();
  }

  calculatenotification() {
    this.totalNotify = 0;
    this.checkedValGet = []

    this.checkedValGet.length > 0 ? (document.getElementById("notification-actions") as HTMLElement).style.display = 'block' : (document.getElementById("notification-actions") as HTMLElement).style.display = 'none';
    if (this.totalNotify == 0) {
      document.querySelector('.empty-notification-elem')?.classList.remove('d-none')
    }
  }

  windowScroll() {
    const navbar = document.getElementById('navbar');
    const burger = document.getElementById('topnav-hamburger-icon');
    const isMobile = window.innerWidth < 1200;
    const scrollTop = document.body.scrollTop || document.documentElement.scrollTop;
    
    // Update scroll state for color changes
    this.isScrolled = scrollTop > 40;
    
    // Update white mode based on scroll state and route
    // Note: White mode is only for desktop when topbar is transparent
    this.updateWhiteMode();
    
    // Apply sticky behavior for both desktop and mobile/tablet
    // The topbar is now fixed on all screen sizes
    if (scrollTop > 40) {
      navbar?.classList.add('is-sticky');
      burger?.classList.add('hamburger-dark');
    } else {
      navbar?.classList.remove('is-sticky');
      // On mobile/tablet, always use dark burger for contrast with white background
      if (isMobile) {
        burger?.classList.add('hamburger-dark');
      } else {
        burger?.classList.remove('hamburger-dark');
      }
    }
    
    // On mobile/tablet, ensure burger button is always visible
    if (isMobile && burger) {
      burger.style.display = 'flex';
      burger.style.opacity = '1';
      burger.style.visibility = 'visible';
      
      // Ensure SVG icon is properly displayed
      const svgIcon = burger.querySelector('.hamburger-icon-svg');
      if (svgIcon) {
        (svgIcon as HTMLElement).style.display = 'block';
      }
    }

    // Top Btn Set
    if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
      (document.getElementById("back-to-top") as HTMLElement).style!.display = "block"
    } else {
      (document.getElementById("back-to-top") as HTMLElement).style!.display = "none"
    }
  }

  toggleMenu() {
    document.getElementById('navbarSupportedContent')?.classList.toggle('show');
  }

  /**
   * Add resize listener to handle mobile/desktop transitions
   */
  private addResizeListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        // Trigger scroll behavior update on resize
        this.windowScroll();
      });
      
      // Handle orientation change on mobile devices
      window.addEventListener('orientationchange', () => {
        setTimeout(() => {
          this.windowScroll();
        }, 100); // Small delay to ensure proper layout calculation
      });
    }
  }

  // Méthode temporaire pour tester l'affichage du panier

  // Force le rafraîchissement du panier
  refreshCartView() {
    console.log('Rafraîchissement du panier');
    // Récupérer directement du service
    this.cartItems = this.cartService.getCartItems();
    console.log('Contenu du panier après rafraîchissement:', this.cartItems);
  }

  /**
   * Load categories for mega menu
   */
  private loadCategories(): void {
    this.categorieService.getCategories().subscribe({
      next: (categories) => {
        // Filter main categories (those without parent_id)
        this.categories = categories.filter(cat => !cat.parent_id);
        
        // Select first category by default
        if (this.categories.length > 0) {
          this.selectedCategoryId = this.categories[0].id;
          this.loadSubcategories(this.categories[0].id);
        }
      },
      error: (error) => {
        console.error('Error loading categories:', error);
      }
    });
  }

  /**
   * Load subcategories for selected category
   */
  private loadSubcategories(categoryId: string): void {
    this.categorieService.getSubcategoriesByParentId(categoryId).subscribe({
      next: (subcategories) => {
        this.subcategories = subcategories;
      },
      error: (error) => {
        console.error('Error loading subcategories:', error);
      }
    });
  }

  /**
   * Load best seller products for mega menu display
   * Priority: best sellers > recent products
   */
  private loadNewProducts(): void {
    from(
      this.supabaseService.getClient()
        .from('products_public')
        .select('*')
        .eq('is_best_seller', true)
        .limit(6)
    ).pipe(
      switchMap(({ data, error }) => {
        if (data && data.length > 0) {
          console.log('Loaded best sellers for mega menu:', data.length);
          return of({ data, error: null });
        }
        console.log('No best sellers found, loading recent products');
        return from(
          this.supabaseService.getClient()
            .from('products_public')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(6)
        );
      })
    ).subscribe({
      next: ({ data, error }) => {
        if (error) {
          console.error('Error loading products for mega menu:', error);
          this.newProducts = [];
          return;
        }
        this.newProducts = (data || []) as Produit[];
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.newProducts = [];
      }
    });
  }

  /**
   * Handle mega menu hover with delay
   */
  onShopHover(): void {
    clearTimeout(this.megaMenuCloseTimeout);
    
    this.megaMenuHoverTimeout = setTimeout(() => {
      this.isMegaMenuOpen = true;
    }, 100); // 100ms delay to prevent flicker
  }

  /**
   * Handle mega menu leave with delay
   */
  onShopLeave(): void {
    clearTimeout(this.megaMenuHoverTimeout);
    
    this.megaMenuCloseTimeout = setTimeout(() => {
      this.isMegaMenuOpen = false;
    }, 150); // 150ms delay to allow moving between elements
  }

  /**
   * Handle category selection
   */
  onCategorySelect(categoryId: string): void {
    this.selectedCategoryId = categoryId;
    this.loadSubcategories(categoryId);
  }

  /**
   * Get selected category object
   */
  getSelectedCategoryName(): string {
    const category = this.categories.find(c => c.id === this.selectedCategoryId);
    return category?.nom || '';
  }

  /**
   * Check if selected category should show "Tous les" link
   */
  shouldShowTousLesLink(): boolean {
    const categoryName = this.getSelectedCategoryName().toLowerCase();
    return categoryName === 'hauts' || categoryName === 'bas' || categoryName === 'accessoires';
  }

  /**
   * Get "Tous les" link text for selected category
   */
  getTousLesLinkText(): string {
    const categoryName = this.getSelectedCategoryName();
    return `Tous les ${categoryName}`;
  }

  /**
   * Handle "Tous les" link click
   */
  onTousLesClick(): void {
    const categoryName = this.getSelectedCategoryName().toLowerCase();
    let categoryId = '';
    
    if (categoryName === 'hauts') {
      categoryId = this.CATEGORY_IDS.HAUTS;
    } else if (categoryName === 'bas') {
      categoryId = this.CATEGORY_IDS.BAS;
    } else if (categoryName === 'accessoires') {
      categoryId = this.CATEGORY_IDS.ACCESSOIRES;
    }
    
    if (categoryId) {
      this.router.navigate(['/all-categorie', categoryId]);
      this.isMegaMenuOpen = false;
    }
  }

  /**
   * Handle subcategory click
   */
  onSubcategoryClick(category: Categorie, subcategory: Categorie): void {
    // Navigate to subcategory-products route with ID
    this.router.navigate(['/subcategory-products', subcategory.id]);
    this.isMegaMenuOpen = false;
  }

  /**
   * Handle product click
   */
  onProductClick(product: Produit): void {
    this.router.navigate(['/product-detail', product.id]);
    this.isMegaMenuOpen = false;
  }

  /**
   * Convert string to URL-friendly slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Handle keyboard navigation
   */
  onMegaMenuKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.isMegaMenuOpen = false;
    }
  }

  /**
   * Get image URL for categories and products
   */
  getImageUrl(imagePath?: string): string {
    return this.imageService.resolveImageUrl(
      imagePath,
      IMAGE_SIZES.PRODUCT_CARD,
      75,
      'public-images',
      '/assets/images/default.jpg'
    );
  }

  getCartImageUrl(imageUrl?: string): string {
    return this.imageService.resolveImageUrl(
      imageUrl,
      IMAGE_SIZES.CART_THUMBNAIL,
      75,
      'public-images',
      '/assets/images/products/placeholder.jpg'
    );
  }

  /**
   * Get selected category helper method
   */
  getSelectedCategory(): Categorie | undefined {
    return this.categories.find(c => c.id === this.selectedCategoryId);
  }

  /**
   * Mobile menu interactions
   */
  toggleMobileShop(): void {
    this.isMobileShopOpen = !this.isMobileShopOpen;
    if (!this.isMobileShopOpen) {
      this.selectedMobileCategoryId = null;
    }
  }

  onMobileCategorySelect(categoryId: string): void {
    if (this.selectedMobileCategoryId === categoryId) {
      // Close if already selected
      this.selectedMobileCategoryId = null;
    } else {
      // Select new category and load its subcategories
      this.selectedMobileCategoryId = categoryId;
      this.loadSubcategories(categoryId);
    }
  }

  onMobileSubcategoryClick(category: Categorie, subcategory: Categorie): void {
    // Navigate to subcategory-products route with ID
    this.router.navigate(['/subcategory-products', subcategory.id]);
    
    // Close mobile menu
    this.closeMobileMenu();
  }

  onMobileMenuItemClick(route: string): void {
    this.router.navigate([route]);
    this.closeMobileMenu();
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
    this.isMenuOpen = false;
    this.isMobileShopOpen = false;
    this.selectedMobileCategoryId = null;
    document.body.style.overflow = '';
  }

  getMobileCategorySubcategories(categoryId: string): Categorie[] {
    return this.subcategories.filter(sub => {
      // Since we load subcategories based on selected category, 
      // we need to check if this category is currently selected
      return this.selectedMobileCategoryId === categoryId;
    });
  }

  getMobileCategoryById(categoryId: string): Categorie | undefined {
    return this.categories.find(c => c.id === categoryId);
  }

  /**
   * Open search bar
   */
  openSearchBar(): void {
    this.isSearchBarOpen = true;
    document.body.style.overflow = 'hidden'; // Prevent background scroll
  }

  /**
   * Close search bar
   */
  closeSearchBar(): void {
    this.isSearchBarOpen = false;
    document.body.style.overflow = ''; // Restore scroll
  }

  /**
   * Get product discount percentage from active promotions
   * Returns formatted string like "-30%" or null if no promo
   */
  getProductDiscount(product: Produit): string | null {
    // TODO: Integrate with PromoService to check if product has active discount
    // For now, return null (no discount shown)
    // This should be replaced with actual promo service integration
    return null;
  }

  /**
   * Get product original price (before discount)
   * Returns the original price if there's a discount, otherwise the current price
   */
  getProductOriginalPrice(product: Produit): number {
    // If product has a discount, calculate original price
    // For now, return current price as we don't have active promos
    return product.prix;
  }
}
