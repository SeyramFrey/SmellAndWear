import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CartBarComponent } from './cart-bar.component';

describe('CartBarComponent', () => {
  let component: CartBarComponent;
  let fixture: ComponentFixture<CartBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CartBarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CartBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
