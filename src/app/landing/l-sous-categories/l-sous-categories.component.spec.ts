import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LSousCategoriesComponent } from './l-sous-categories.component';

describe('LSousCategoriesComponent', () => {
  let component: LSousCategoriesComponent;
  let fixture: ComponentFixture<LSousCategoriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LSousCategoriesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LSousCategoriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
