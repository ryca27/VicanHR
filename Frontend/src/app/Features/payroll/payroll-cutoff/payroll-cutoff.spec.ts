import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PayrollCutoff } from './payroll-cutoff';

describe('PayrollCutoff', () => {
  let component: PayrollCutoff;
  let fixture: ComponentFixture<PayrollCutoff>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PayrollCutoff],
    }).compileComponents();

    fixture = TestBed.createComponent(PayrollCutoff);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
