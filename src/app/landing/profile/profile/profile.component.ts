import {Component, CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import {
    NgbAccordionItem,
    NgbModal,
    NgbNav,
    NgbNavItem,
    NgbNavOutlet,
    NgbPagination,
    NgbTooltip
} from '@ng-bootstrap/ng-bootstrap';
import { UntypedFormBuilder } from '@angular/forms';

import { PaginationService } from 'src/app/core/services/pagination.service';
import {SlickCarouselModule} from "ngx-slick-carousel";
import {DatePipe} from "@angular/common";

@Component({
    selector: 'app-profile',
    templateUrl: './profile.component.html',
    styleUrls: ['./profile.component.scss'],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    imports: [
        NgbNavItem,
        SlickCarouselModule,
        NgbAccordionItem,
        DatePipe,
        NgbNav,
        NgbNavOutlet,
        NgbTooltip,
        NgbPagination
    ],
    standalone: true
})

/**
 * Profile Component
 */
export class ProfileComponent {

  projectList!: any;
  document!: any;
  userData: any;
  allprojectList: any;


  constructor(private formBuilder: UntypedFormBuilder, private modalService: NgbModal, public service: PaginationService) {

  }

  ngOnInit(): void {
    this.userData = 0;
    /**
     * Fetches the data
     */
    this.fetchData();
  }

  /**
   * Fetches the data
   */
  private fetchData() {
    this.document = document;
    this.projectList = 0;
    this.allprojectList = 0;
  }

  /**
   * Swiper setting
   */
  config = {
    slidesPerView: 3,
    initialSlide: 0,
    spaceBetween: 25,
    breakpoints: {
      768: {
        slidesPerView: 2,
      },
      1200: {
        slidesPerView: 3,
      }
    }
  };

  // Pagination
  changePage() {
    this.projectList = this.service.changePage(this.allprojectList)
  }

  /**
   * Confirmation mail model
   */
  deleteId: any;
  confirm(content: any, id: any) {
    this.deleteId = id;
    this.modalService.open(content, { centered: true });
  }

  // Delete Data
  deleteData(id: any) {
    this.document.slice(id, 1)
    this.modalService.dismissAll()
  }

}
