export interface PayrollCutoffEmployee{
    employeeNo: string;
    employeeName: string;
    detachment: string;
    incomeSource: payrollCutoffIncome;
    deductionSource: payrolCutoffDeduction;
    netPay:number;
    payrollPeriod: string;
    remarks: string;
    status: number;
    actions: number[];
    isFinalized: boolean;
}

export interface payrollCutoffIncome{
    regularHours: number;
    regularPay: number;
    allowance?: number;
    oTHours?: number;
    oTPay?: number | null;
    lHOTHours?: number | null;
    lHOTPay?: number | null;
    sHOTHours?: number | null;
    sHOTPay?: number | null;
    nDHours?: number | null;
    nDPay?: number | null;
    uniformAllowance?: number | null;
    wDOPay?: number | null;
    sSSLoanRefund?: number | null;
    cBRefund?: number | null;
    sSSContRefund?: number | null;
    grossPay: number
}

export interface payrolCutoffDeduction{
    sSSEyee?: number | null;
    sSSEyer?: number | null;
    philHealthEyee?: number | null;
    philHealthEyer?: number | null;
    sSSLoanSalary?: number | null;
    sSSLoanCalamity?: number | null;
    cashBond?: number | null;
    benlifeInsurance?: number | null;
    groupInsurance?: number | null;
    uniformParaphernalia?: number | null;
    paraphernalia?: number | null;
    training?: number | null;
    additionalPhicContribution?: number | null;
    pagibigContribution?: number | null;
    sSSCondonation?: number | null;
    familySupport?: number | null;
    trainingSchool?: number | null;
    license?: number | null;
    sogcc1creditcoop?: number | null;
    sogcc2creditcoop?: number | null;
    totalDeductions: number;
}