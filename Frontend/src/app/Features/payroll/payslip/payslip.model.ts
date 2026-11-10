export interface PayslipItem {
    label: string;
    amount: number;
  }
  
  export interface Payslip {
    employeeId: string;
    employeeName: string;
    assignedPost: string;
    detachment: string;
  
    cutoffStart: string;
    cutoffEnd: string;
    payDate: string;
  
    regularHours: number;
    overtimeHours: number;
    nightDifferentialHours: number;
  
    earnings: PayslipItem[];
    deductions: PayslipItem[];
  
    grossPay: number;
    totalDeductions: number;
    netPay: number;
  }
  
  export const COMPANY = {
    name: 'VICAN Security Services Corp.',
    address: [
      'No. 5 Faith Street, Teresa Village',
      'Bahay Toro, Quezon City'
    ],
    telephone: '929-2895 / 925-4877'
  };