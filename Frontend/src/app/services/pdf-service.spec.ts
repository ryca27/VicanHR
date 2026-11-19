import { TestBed } from '@angular/core/testing';
import html2canvas from 'html2canvas';
import { vi } from 'vitest';
import { PdfService } from './pdf-service';

const save = vi.hoisted(() => vi.fn());
const addImage = vi.hoisted(() => vi.fn());

vi.mock('html2canvas', () => ({ default: vi.fn() }));
vi.mock('jspdf', async importOriginal => {
  const { default: JsPDF } = await importOriginal<typeof import('jspdf')>();
  return {
    default: function (options: ConstructorParameters<typeof JsPDF>[0]) {
      const pdf = new JsPDF(options);
      pdf.addImage = addImage;
      pdf.save = filename => save(filename, pdf.getNumberOfPages());
      return pdf;
    },
  };
});

describe('PdfService', () => {
  it('saves each captured payslip as its own one-page PDF', async () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,');
    vi.mocked(html2canvas).mockResolvedValue(canvas);
    TestBed.configureTestingModule({});

    const first = document.createElement('div');
    const second = document.createElement('div');
    const service = TestBed.inject(PdfService);
    await service.download(first, 'First.pdf');
    await service.download(second, 'Second.pdf');

    expect(vi.mocked(html2canvas).mock.calls.map(([page]) => page)).toEqual([first, second]);
    expect(addImage).toHaveBeenCalledTimes(2);
    expect(save.mock.calls).toEqual([['First.pdf', 1], ['Second.pdf', 1]]);
  });
});
