import { Component, OnInit } from '@angular/core';
import {NgbNav, NgbNavItem, NgbNavOutlet} from "@ng-bootstrap/ng-bootstrap";
import {FlatpickrModule} from "angularx-flatpickr";
import {NgSelectModule} from "@ng-select/ng-select";


@Component({
    selector: 'app-settings',
    templateUrl: './settings.component.html',
    standalone: true,
    imports: [
        NgbNavOutlet,
        NgbNavItem,
        FlatpickrModule,
        NgbNav,
        NgSelectModule
    ],
    styleUrls: ['./settings.component.scss']
})

/**
 * Profile Settings Component
 */
export class SettingsComponent implements OnInit {

  userData:any;

  constructor() { }

  ngOnInit(): void {
    this.userData =  0;
  }

  /**
  * Multiple Default Select2
  */
   selectValue = ['Illustrator', 'Photoshop', 'CSS', 'HTML', 'Javascript', 'Python', 'PHP'];

}
