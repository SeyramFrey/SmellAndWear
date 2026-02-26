import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IndexComponent } from './index/index.component';

import {
  NgbCarouselModule, NgbTooltipModule, NgbCollapseModule
} from '@ng-bootstrap/ng-bootstrap';

import { ScrollToModule } from '@nicky-lenaers/ngx-scroll-to';

import { LandingRoutingModule } from "./landing-routing.module";
import { SharedModule } from '../shared/shared.module';
import { TopbarComponent } from "../shared/landing/index/topbar/topbar.component";
import { PromoContainerComponent } from '../shared/landing/index/promo-container/promo-container.component';
import { defineElement } from "@lordicon/element";


@NgModule({
  declarations: [
    IndexComponent,
  ],
    imports: [
        CommonModule,
        NgbCarouselModule,
        LandingRoutingModule,
        SharedModule,
        NgbTooltipModule,
        NgbCollapseModule,
        ScrollToModule.forRoot(),
        TopbarComponent,
        PromoContainerComponent, // Promo system
    ]
})
export class LandingModule { }
