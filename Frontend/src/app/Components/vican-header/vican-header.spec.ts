import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VicanHeader } from './vican-header';

describe('VicanHeader', () => {
  let component: VicanHeader;
  let fixture: ComponentFixture<VicanHeader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VicanHeader],
    }).compileComponents();

    fixture = TestBed.createComponent(VicanHeader);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
