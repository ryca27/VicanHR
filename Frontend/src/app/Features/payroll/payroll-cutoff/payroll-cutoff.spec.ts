import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { PdfService } from '../../../services/pdf-service';
import { PayrollCutoff } from './payroll-cutoff';

describe('PayrollCutoff', () => {
  let fixture: ComponentFixture<PayrollCutoff>;
  let page: HTMLElement;
  let pages: string[];
  const download = vi.fn(async (element: HTMLElement, _filename: string) => {
    pages.push(element.textContent ?? '');
  });

  beforeEach(async () => {
    download.mockClear();
    pages = [];
    await TestBed.configureTestingModule({
      imports: [PayrollCutoff],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'demo' })) } },
        { provide: PdfService, useValue: { download } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PayrollCutoff);
    page = fixture.nativeElement;
    await fixture.whenStable();
  });

  function button(label: string): HTMLButtonElement {
    return Array.from(page.querySelectorAll('button')).find(item => item.textContent?.trim() === label)!;
  }

  function choose(label: string, value: string): void {
    const select = page.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
    select.value = value;
    select.dispatchEvent(new Event('change'));
  }

  it('restores all rows and all three visible placeholders when resetting filters', async () => {
    const labels = Array.from(page.querySelectorAll('.wrapper.right button'), item => item.textContent?.trim());
    expect(labels.slice(0, 2)).toEqual(['Preview', 'Reset Filters']);
    expect(fixture.componentInstance.employeeCount).toBe(8);
    choose('Name', 'Tabernilla, Ryan');
    choose('Detachment', 'Megabold');
    choose('Status', '1');
    button('Preview').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.employeeCount).toBe(1);

    button('Reset Filters').click();
    await fixture.whenStable();
    const filters = Array.from(page.querySelectorAll<HTMLSelectElement>('.cutoff-filter select'));
    expect(filters.map(select => select.selectedOptions[0]?.textContent?.trim())).toEqual([
      'Choose option', 'Choose option', 'Choose option',
    ]);
    expect(fixture.componentInstance.employeeCount).toBe(8);
  });

  it('exports only the checked finalized employees in separate PDFs', async () => {
    expect(button('Download Selected').disabled).toBe(true);
    const checkboxes = page.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]');
    checkboxes[0].click();
    checkboxes[1].click();
    await fixture.whenStable();

    button('Download Selected').click();
    await fixture.whenStable();
    expect(download.mock.calls.map(([, filename]) => filename)).toEqual([
      'Demo_Payslip_DEMO-001_Santos_Alex_2026-09-01_to_2026-09-15.pdf',
      'Demo_Payslip_DEMO-002_Reyes_Jamie_2026-09-01_to_2026-09-15.pdf',
    ]);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toContain('Santos, Alex');
    expect(pages[1]).toContain('Reyes, Jamie');
  });

  it('shows the reason and next action for employees filtered to Needs Attention', async () => {
    choose('Status', '3');
    button('Preview').click();
    await fixture.whenStable();
    const panel = page.querySelector<HTMLDetailsElement>('.attention-panel')!;
    expect(panel.open).toBe(false);
    expect(panel.querySelector('summary')?.textContent).toContain('2 employees');
    panel.querySelector('summary')!.click();
    expect(panel.open).toBe(true);
    const issues = page.querySelectorAll<HTMLDetailsElement>('.attention-details');
    expect(issues).toHaveLength(2);
    expect(issues[0].querySelector('summary')?.textContent).toContain('Duplicate attendance name');
    issues[0].open = true;
    expect(issues[0].textContent).toContain('rows 12 and 18');
    expect(issues[0].textContent).toContain('Compare both source rows');
    expect(issues[1].textContent).toContain('update the Summary');
  });

  it('includes the employee ID, name, and cutoff dates in a single payslip filename', async () => {
    page.querySelector<HTMLInputElement>('tbody input[type="checkbox"]')!.click();
    await fixture.whenStable();
    button('Download Selected').click();
    await fixture.whenStable();
    expect(download.mock.calls[0][1]).toBe('Demo_Payslip_DEMO-001_Santos_Alex_2026-09-01_to_2026-09-15.pdf');
    expect(pages).toHaveLength(1);
    expect(pages[0]).toContain('Santos, Alex');
  });
});
