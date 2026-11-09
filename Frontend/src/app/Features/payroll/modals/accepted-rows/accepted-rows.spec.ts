import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AcceptedRows } from './accepted-rows';

describe('AcceptedRows', () => {
  let component: AcceptedRows;
  let fixture: ComponentFixture<AcceptedRows>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AcceptedRows],
    }).compileComponents();

    fixture = TestBed.createComponent(AcceptedRows);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
