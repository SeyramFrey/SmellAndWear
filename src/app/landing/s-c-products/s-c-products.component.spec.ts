import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SCProductsComponent } from './s-c-products.component';

describe('SCProductsComponent', () => {
  let component: SCProductsComponent;
  let fixture: ComponentFixture<SCProductsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SCProductsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SCProductsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
