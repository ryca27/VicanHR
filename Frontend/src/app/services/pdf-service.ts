
import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  async download(
    element: HTMLElement,
    filename: string
  ): Promise<void> {

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: Math.max(
        document.documentElement.clientWidth,
        element.scrollWidth
      )
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Scale the entire captured payslip to fit one A4 page
    const ratio = Math.min(
      pageWidth / canvas.width,
      pageHeight / canvas.height
    );

    const imgWidth = canvas.width * ratio;
    const imgHeight = canvas.height * ratio;

    const x = (pageWidth - imgWidth) / 2;
    const y = 0;

    const imgData = canvas.toDataURL('image/png');

    pdf.addImage(
      imgData,
      'PNG',
      x,
      y,
      imgWidth,
      imgHeight
    );

    pdf.save(filename);
  }
}
