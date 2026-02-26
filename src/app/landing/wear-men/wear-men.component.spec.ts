import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WearMenComponent } from './wear-men.component';

describe('WearMenComponent', () => {
  let component: WearMenComponent;
  let fixture: ComponentFixture<WearMenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WearMenComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WearMenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
