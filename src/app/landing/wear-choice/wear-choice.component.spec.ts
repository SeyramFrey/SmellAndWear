import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WearChoiceComponent } from './wear-choice.component';

describe('WearChoiceComponent', () => {
  let component: WearChoiceComponent;
  let fixture: ComponentFixture<WearChoiceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WearChoiceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WearChoiceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
