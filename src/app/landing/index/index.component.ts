import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { LandingMediaService } from '../../core/services/landing-media.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})

/**
 * Index Component
 */
export class IndexComponent implements OnInit, OnDestroy {

  currentSection = 'home';
  showNavigationArrows: any;
  showNavigationIndicators: any;
  isCondensed = false;

  // Media URLs
  wearBackgroundStyle: { [key: string]: string } = {};
  smellBackgroundStyle: { [key: string]: string } = {};

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private landingMediaService: LandingMediaService
  ) { }

  ngOnInit(): void {
    // Initialiser les animations et les effets
    this.initializeAnimations();
    
    // Load media URLs
    this.loadMediaUrls();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeAnimations(): void {
    // Ajouter des écouteurs d'événements pour les sections
    const sections = document.querySelectorAll('[class*="-section"]');
    sections.forEach(section => {
      section.addEventListener('mouseenter', () => {
        section.classList.add('active');
      });
      section.addEventListener('mouseleave', () => {
        section.classList.remove('active');
      });
    });
  }

  private loadMediaUrls(): void {
    // Load wear section background
    this.landingMediaService.getBackgroundImageStyle('Page 1 Wear', '/assets/images/landing/wear-bg.webp')
      .pipe(takeUntil(this.destroy$))
      .subscribe(style => {
        this.wearBackgroundStyle = style;
      });

    // Load smell section background
    this.landingMediaService.getBackgroundImageStyle('Page 1 Smell', '/assets/images/landing/smell-bg.webp')
      .pipe(takeUntil(this.destroy$))
      .subscribe(style => {
        this.smellBackgroundStyle = style;
      });
  }

  /**
   * Window scroll method
   */
  // tslint:disable-next-line: typedef
  windowScroll() {
    const navbar = document.getElementById('navbar');
    if (document.body.scrollTop > 40 || document.documentElement.scrollTop > 40) {
      navbar?.classList.add('is-sticky');
    }
    else {
      navbar?.classList.remove('is-sticky');
    }

    // Top Btn Set
    if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
      (document.getElementById("back-to-top") as HTMLElement).style.display = "block"
    } else {
      (document.getElementById("back-to-top") as HTMLElement).style.display = "none"
    }
  }

  onToggleMobileMenu() {
    const currentSIdebarSize = document.documentElement.getAttribute("data-sidebar-size");
    if (document.documentElement.clientWidth >= 767) {
      if (currentSIdebarSize == null) {
        (document.documentElement.getAttribute('data-sidebar-size') == null || document.documentElement.getAttribute('data-sidebar-size') == "lg") ? document.documentElement.setAttribute('data-sidebar-size', 'sm') : document.documentElement.setAttribute('data-sidebar-size', 'lg')
      } else if (currentSIdebarSize == "md") {
        (document.documentElement.getAttribute('data-sidebar-size') == "md") ? document.documentElement.setAttribute('data-sidebar-size', 'sm') : document.documentElement.setAttribute('data-sidebar-size', 'md')
      } else {
        (document.documentElement.getAttribute('data-sidebar-size') == "sm") ? document.documentElement.setAttribute('data-sidebar-size', 'lg') : document.documentElement.setAttribute('data-sidebar-size', 'sm')
      }
    }

    if (document.documentElement.clientWidth <= 767) {
      document.body.classList.toggle('vertical-sidebar-enable');
    }
    this.isCondensed = !this.isCondensed;
  }

   /**
   * Section changed method
   * @param sectionId specify the current sectionID
   */
    onSectionChange(sectionId: string) {
      this.currentSection = sectionId;
    }

  /**
   * Toggle navbar
   */
  toggleMenu() {
    document.getElementById('navbarSupportedContent')?.classList.toggle('show');
  }

  // When the user clicks on the button, scroll to the top of the document
  topFunction() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

}
