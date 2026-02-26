import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BestsellersComponent } from './bestsellers.component';

describe('BestsellersComponent', () => {
  let component: BestsellersComponent;
  let fixture: ComponentFixture<BestsellersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BestsellersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BestsellersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
