import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TableTab } from './table-tab';

describe('TableTab', () => {
  let component: TableTab;
  let fixture: ComponentFixture<TableTab>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TableTab],
    }).compileComponents();

    fixture = TestBed.createComponent(TableTab);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
