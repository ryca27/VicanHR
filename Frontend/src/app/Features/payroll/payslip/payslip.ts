
import {
  Component,
  ElementRef,
  Input,
  ViewChild
} from '@angular/core';

import { DatePipe, DecimalPipe } from '@angular/common';

import type {
  Payslip,
  IncomeItem,
  DeductionItem
} from './payslip.model';

type DeductionKey = keyof Payslip['deduction'];

type DisplayIncome = {
  key: string;
  value: IncomeItem;
};

type DisplayDeduction = {
  key: DeductionKey;
  value: DeductionItem;
};

// INCOME ITEMS
const incomeDefinitions: {
  key: string;
  label: string;
}[] = [
  { key: 'regularPay', label: 'Regular Pay' },
  { key: 'otPay', label: 'Overtime Pay' },
  { key: 'allowance', label: 'Allowance' },
  { key: 'lHOTPay', label: 'Legal Holiday OT' },
  { key: 'sHOTPay', label: 'Special Holiday OT' },
  { key: 'ndPay', label: 'Night Differential' },
  { key: 'ndOTPay', label: 'Night Differential OT' },
  { key: 'uniformAllowance', label: 'Uniform Allowance' },
  { key: 'wDOPay', label: 'WDO Pay' },
  { key: 'sSSLoanRefund', label: 'SSS Loan Refund' },
  { key: 'cBRRefund', label: 'Cash Bond Refund' },
  { key: 'sSSContRefund', label: 'SSS Contribution Refund' }
];

// DEDUCTION ITEMS
const deductionDefinitions: {
  key: DeductionKey;
  label: string;
}[] = [
  { key: 'sSSEyee', label: 'SSS Employee Contribution' },
  { key: 'sSSEyer', label: 'SSS Employer Contribution' },
  { key: 'philHealthEyee', label: 'PhilHealth Employee Contribution' },
  { key: 'philHealthEyer', label: 'PhilHealth Employer Contribution' },
  { key: 'sSSLoanSalary', label: 'SSS Salary Loan' },
  { key: 'sSSLoanCalamity', label: 'SSS Calamity Loan' },
  { key: 'cashBond', label: 'Cash Bond' },
  { key: 'benlifeInsurance', label: 'Benlife Insurance' },
  { key: 'groupInsurance', label: 'Group Insurance' },
  { key: 'uniformParaphernalia', label: 'Uniform / Paraphernalia' },
  { key: 'paraphernalia', label: 'Paraphernalia' },
  { key: 'training', label: 'Training' },
  { key: 'additionalPhicContribution', label: 'Additional PhilHealth Contribution' },
  { key: 'additionalSSSContribution', label: 'Additional SSS Contribution' },
  { key: 'pagibigContribution', label: 'Pag-IBIG Contribution' },
  { key: 'sSSCondonation', label: 'SSS Condonation' },
  { key: 'familySupport', label: 'Family Support' },
  { key: 'trainingSchool', label: 'Training School' },
  { key: 'license', label: 'License' },
  { key: 'sogcc1creditcoop', label: 'SOGCC 1 Credit Cooperative' },
  { key: 'sogcc2creditcoop', label: 'SOGCC 2 Credit Cooperative' }
];

@Component({
  selector: 'app-payslip',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe
  ],
  templateUrl: './payslip.html',
  styleUrl: './payslip.scss'
})
export class PayslipComponent {

  @Input({ required: true })
  payslip!: Payslip;

  @ViewChild('payslipContent')
  payslipContent?: ElementRef<HTMLElement>;

  downloading = false;

  // INCOME ITEMS
  get incomeItems(): DisplayIncome[] {
    const earning = this.payslip.earning as unknown as
      Record<string, IncomeItem | undefined>;

    return incomeDefinitions.map(({ key, label }) => ({
      key,
      value: {
        label,
        hours: earning[key]?.hours,
        rate: earning[key]?.rate,
        pay: earning[key]?.pay ?? 0
      }
    }));
  }

  // DEDUCTION ITEMS
  get deductionItems(): DisplayDeduction[] {
    return deductionDefinitions.map(({ key, label }) => ({
      key,
      value: {
        label,
        amount: this.payslip.deduction[key]?.amount ?? 0
      }
    }));
  }

  // LEFT COLUMN - FIRST 11 DEDUCTIONS
  get leftDeductions(): DisplayDeduction[] {
    return this.deductionItems.slice(0, 11);
  }

  // RIGHT COLUMN - REMAINING 10 DEDUCTIONS
  get rightDeductions(): DisplayDeduction[] {
    return this.deductionItems.slice(11);
  }

  // GROSS PAY
  get grossPay(): number {
    return this.roundMoney(
      this.incomeItems.reduce(
        (sum, item) => sum + (item.value.pay ?? 0),
        0
      )
    );
  }

  // TOTAL EMPLOYEE DEDUCTIONS
  get totalDeductions(): number {
    const employerOnly: DeductionKey[] = [
      'sSSEyer',
      'philHealthEyer'
    ];

    return this.roundMoney(
      this.deductionItems
        .filter(item => !employerOnly.includes(item.key))
        .reduce(
          (sum, item) => sum + (item.value.amount ?? 0),
          0
        )
    );
  }

  // NET PAY
  get netPay(): number {
    return this.roundMoney(
      this.grossPay - this.totalDeductions
    );
  }

  private roundMoney(value: number): number {
    return Math.round(
      (value + Number.EPSILON) * 100
    ) / 100;
  }

  // DOWNLOAD PAYSLIP PDF
  async downloadPayslip(): Promise<void> {

    const element = this.payslipContent?.nativeElement;

    if (!element || this.downloading) {
      return;
    }

    this.downloading = true;

    try {

      await document.fonts.ready;

      await new Promise<void>(resolve =>
        requestAnimationFrame(() => resolve())
      );

      // CHECK A4 CONTENT OVERFLOW
      const overflow =
        element.scrollHeight - element.clientHeight;

      if (overflow > 2) {
        throw new Error(
          `Payslip exceeds A4 by ${overflow}px. Check payslip.scss.`
        );
      }

      // CAPTURE PAYSLIP HTML
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        width: 794,
        height: 1123,
        windowWidth: 1200,

        onclone: doc => {

          const page = doc.querySelector(
            '.payslip-paper'
          ) as HTMLElement | null;

          if (page) {
            page.style.width = '794px';
            page.style.height = '1123px';
            page.style.margin = '0';
            page.style.boxShadow = 'none';
            page.style.backgroundColor = '#ffffff';
          }

        }
      });

      // CREATE A4 PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        0,
        0,
        pdf.internal.pageSize.getWidth(),
        pdf.internal.pageSize.getHeight()
      );

      // SAFE FILE NAME
      const safeId = String(
        this.payslip.employeeId || 'Employee'
      ).replace(/[\\/:*?"<>|]/g, '-');

      const safePeriod = String(
        this.payslip.payrollPeriod || 'Period'
      ).replace(/[\\/:*?"<>|]/g, '-');

      pdf.save(
        `Payslip_${safeId}_${safePeriod}.pdf`
      );

    } catch (error) {

      console.error(
        'Payslip generation failed:',
        error
      );

    } finally {
      this.downloading = false;
    }

  }

}
