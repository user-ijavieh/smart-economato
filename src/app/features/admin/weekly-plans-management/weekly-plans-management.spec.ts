import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeeklyPlansManagement } from './weekly-plans-management';

describe('WeeklyPlansManagement', () => {
  let component: WeeklyPlansManagement;
  let fixture: ComponentFixture<WeeklyPlansManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeeklyPlansManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeeklyPlansManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
