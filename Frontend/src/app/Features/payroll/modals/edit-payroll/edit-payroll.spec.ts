import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditPayroll } from './edit-payroll';

describe('EditPayroll', () => {
  let component: EditPayroll;
  let fixture: ComponentFixture<EditPayroll>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditPayroll],
    }).compileComponents();

    fixture = TestBed.createComponent(EditPayroll);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
