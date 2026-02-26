import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PromoBarComponent } from './promo-bar.component';

describe('PromoBarComponent', () => {
  let component: PromoBarComponent;
  let fixture: ComponentFixture<PromoBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PromoBarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PromoBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
