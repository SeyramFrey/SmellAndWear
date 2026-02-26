import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})

/**
 * Footer Component
 */
export class FooterComponent implements OnInit {
  // set the current year
  year: number = new Date().getFullYear();
  
  // Dropdown states
  dropdowns = {
    aide: false,
    entreprise: false
  };

  constructor() { }

  ngOnInit(): void {
  }

  /**
   * Toggle dropdown visibility
   */
  toggleDropdown(section: 'aide' | 'entreprise'): void {
    this.dropdowns[section] = !this.dropdowns[section];
    
    // Close other dropdown when opening one
    if (section === 'aide' && this.dropdowns.aide) {
      this.dropdowns.entreprise = false;
    } else if (section === 'entreprise' && this.dropdowns.entreprise) {
      this.dropdowns.aide = false;
    }
  }

}
