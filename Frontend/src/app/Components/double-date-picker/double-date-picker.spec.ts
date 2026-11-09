import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DoubleDatePicker } from './double-date-picker';

describe('DoubleDatePicker', () => {
  let component: DoubleDatePicker;
  let fixture: ComponentFixture<DoubleDatePicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DoubleDatePicker],
    }).compileComponents();

    fixture = TestBed.createComponent(DoubleDatePicker);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
