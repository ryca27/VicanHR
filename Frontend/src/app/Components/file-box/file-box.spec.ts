import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileBox } from './file-box';

describe('FileBox', () => {
  let component: FileBox;
  let fixture: ComponentFixture<FileBox>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileBox],
    }).compileComponents();

    fixture = TestBed.createComponent(FileBox);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
