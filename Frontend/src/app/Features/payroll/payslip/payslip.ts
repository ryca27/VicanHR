import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Payslip, COMPANY } from './payslip.model';

@Component({
  selector: 'app-payslip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payslip.html',
  styleUrl: './payslip.scss'
})
export class PayslipComponent {
  @Input({ required: true }) payslip!: Payslip;

  company = COMPANY;

  formatMoney(value: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(value);
  }
}