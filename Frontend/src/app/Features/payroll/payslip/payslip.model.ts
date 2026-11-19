export interface PayslipItem {
    label: string;
    amount: number;
  }

  export interface DeductionItem{
    label: string;
    amount?: number| null;
  }

export interface IncomeItem{
  label: string | null;
  rate?: number | null;
  hours?: number | null;
  pay? : number| null;
}

export interface Payslip{
  employeeId: string;
  employeeName: string;
  assignedPost: string;
  detachment: string;
  payrollPeriod: string;
  payDate: string;
  earning: {
    regularPay: IncomeItem;
    otPay: IncomeItem;
    allowance: IncomeItem;
    lHOTPay: IncomeItem;
    sHOTPay: IncomeItem;
    ndPay: IncomeItem;
    // ndOTPay: IncomeItem;
    uniformAllowance: IncomeItem;
    wDOPay: IncomeItem;
    sSSLoanRefund: IncomeItem;
    cBRRefund: IncomeItem;
    sSSContRefund: IncomeItem;
  }
  grossPay: number;
  deduction: {
    sSSEyee?: DeductionItem;
    sSSEyer?: DeductionItem;
    philHealthEyee?: DeductionItem;
    philHealthEyer?: DeductionItem;
    sSSLoanSalary?: DeductionItem;
    sSSLoanCalamity?: DeductionItem;
    cashBond?: DeductionItem;
    benlifeInsurance?: DeductionItem;
    groupInsurance?: DeductionItem;
    uniformParaphernalia?: DeductionItem;
    paraphernalia?: DeductionItem;
    training?: DeductionItem;
    additionalPhicContribution?: DeductionItem;
    additionalSSSContribution?: DeductionItem;
    pagibigContribution?: DeductionItem;
    sSSCondonation?: DeductionItem;
    familySupport?: DeductionItem;
    trainingSchool?: DeductionItem;
    license?: DeductionItem;
    sogcc1creditcoop?: DeductionItem;
    sogcc2creditcoop?: DeductionItem;
  }
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