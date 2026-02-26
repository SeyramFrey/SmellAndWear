import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ButtonHoverComponent } from './button-hover.component';

describe('ButtonHoverComponent', () => {
  let component: ButtonHoverComponent;
  let fixture: ComponentFixture<ButtonHoverComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonHoverComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ButtonHoverComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
