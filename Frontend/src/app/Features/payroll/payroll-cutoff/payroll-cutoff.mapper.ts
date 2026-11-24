import { actionList } from '../../../Components/table/table-constants';
import { PayrollCutoffEmployee, payrolCutoffDeduction, payrollCutoffIncome } from './payroll-cutoff.models';
import {incomeSourceKeys, deductionSourceKeys, expenseDeductionKeys, detachmentList} from './payroll-cutoff-constants'
import { Payslip, PayslipItem, IncomeItem } from './../payslip/payslip.model'

export function employeeTablePreparation(employees: Array<PayrollCutoffEmployee>): Array<any>{
    let grossPay: number;
    let totalDeductions: number;
    let netPay: number;
    let tableReadyRows: Array<any> = [];


    employees.forEach(e=>{
        let rowToAdd = { 
            id: e.employeeNo, 
            fullName: e.employeeName, 
            detachment: e.detachment, 
            ...Object.fromEntries(incomeSourceKeys.map(key => [key, e.incomeSource[key]])),
            ...Object.fromEntries(deductionSourceKeys.map(key => [
                key, e.deductionSource[key] ?? (expenseDeductionKeys.has(key) ? 0 : null),
            ])),
            grossPay:e.grossPay, 
            totalDeductions:employeTotalDeductionPreparation(e.deductionSource),
            netPay: e.netPay, 
            status: e.status,
            actions: e.actions
        };
        tableReadyRows.push(rowToAdd);
    })
    return tableReadyRows
}

export function employeTotalDeductionPreparation(source: payrolCutoffDeduction): number {
    const total = Object.values(source).reduce((sum, value) => sum + (value ?? 0), 0);
    return Math.round(total * 100) / 100;
}

export function employeeTableActionPreparation(size: number): Array<Array<{value:number, isDisabled: boolean}>>{
    let tableActionReadyRows: Array<Array<{value:number, isDisabled: boolean}>> = [];
    let i:number = 0;
    while (i < size){
        let actionRow = [{value:4, isDisabled: false},];
        tableActionReadyRows.push(actionRow);
        i++
    }
    return tableActionReadyRows;
}

export function payslipToGeneratePreparation(employee: PayrollCutoffEmployee): Payslip{
    let payslip: Payslip = {
        employeeId: employee.employeeNo,
        employeeName: employee.employeeName,
        assignedPost: '',
        detachment: employee.detachment,
        payrollPeriod: employee.payrollPeriod,
        payDate: '',
        earning: {
            regularPay: {
                label: 'Regular Pay',
                rate: 86.875,
                hours: employee.incomeSource.regularHours,
                pay: employee.incomeSource.regularPay},
            otPay: {
                label: 'Overtime Pay',
                rate: 108.59,
                hours: employee.incomeSource.oTHours,
                pay: employee.incomeSource.oTPay},
            allowance: {
                label: 'Allowance',
                pay: employee.incomeSource.allowance},
            lHOTPay: {
                label: 'Legal Holiday Overtime Pay',
                rate: 225.88,
                hours: employee.incomeSource.lHOTHours,
                pay: employee.incomeSource.lHOTPay},
            sHOTPay: {
                label: 'Special Holiday Overtime Pay',
                rate: 146.82,
                hours: employee.incomeSource.sHOTHours,
                pay: employee.incomeSource.sHOTPay},
            ndPay: {
                label: 'Night Differential Pay',
                rate: 8.69,
                hours: employee.incomeSource.nDHours,
                pay: employee.incomeSource.nDPay},
            uniformAllowance: {
                label: 'Uniform Allowance',
                rate: 0.41,
                hours: employee.incomeSource.regularHours,
                pay: employee.incomeSource.uniformAllowance},
            wDOPay: {
                label: 'WDO Pay',
                pay: employee.incomeSource.wDOPay},
            sSSLoanRefund: {
                label: 'SSS Loan Refund',
                pay: employee.incomeSource.sSSLoanRefund},
            cBRRefund: {
                label: 'CBR Refund',
                pay: employee.incomeSource.cBRefund},
            sSSContRefund: {
                label: 'SSS Cont Refund',
                pay: employee.incomeSource.sSSContRefund},
        },
        grossPay: employee.grossPay,
        deduction: {
            sSSEyee: {
                label: 'SSS EYEE',
                amount: employee.deductionSource.sSSEyee
            },
            sSSEyer: {
                label: 'SSS EYER',
                amount: employee.deductionSource.sSSEyer
            },
            philHealthEyee: {
                label: 'PhilHealth EYEE',
                amount: employee.deductionSource.philHealthEyee
            },
            philHealthEyer: {
                label: 'PhilHealth EYER',
                amount: employee.deductionSource.philHealthEyer
            },
            sSSLoanSalary: {
                label: 'SSS Loan Salary',
                amount: employee.deductionSource.sSSLoanSalary
            },
            sSSLoanCalamity: {
                label: 'SSS Loan Calamity',
                amount: employee.deductionSource.sSSLoanCalamity
            },
            cashBond: {
                label: 'Cash Bond',
                amount: employee.deductionSource.cashBond
            },
            benlifeInsurance: {
                label: 'Ben Life Insurance',
                amount: employee.deductionSource.benlifeInsurance
            },
            groupInsurance: {
                label: 'Group Insurance',
                amount: employee.deductionSource.groupInsurance
            },
            uniformParaphernalia: {
                label: 'Uniform Paraphernalia',
                amount: employee.deductionSource.uniformParaphernalia
            },
            paraphernalia: {
                label: 'Paraphernalia',
                amount: employee.deductionSource.paraphernalia
            },
            training: {
                label: 'Training',
                amount: employee.deductionSource.training
            },
            additionalPhicContribution: {
                label: 'Additional PHIC Contribution',
                amount: employee.deductionSource.additionalPhicContribution
            },
            additionalSSSContribution: {
                label: 'Additional SSS Contribution',
                amount: employee.deductionSource.additionalSSSContribution
            },
            pagibigContribution: {
                label: 'Pag Ibig Contribution',
                amount: employee.deductionSource.pagibigContribution
            },
            sSSCondonation: {
                label: 'SSS Condonation',
                amount: employee.deductionSource.sSSCondonation
            },
            familySupport: {
                label: 'Family Support',
                amount: employee.deductionSource.familySupport
            },
            trainingSchool: {
                label: 'Training School',
                amount: employee.deductionSource.trainingSchool
            },
            license: {
                label: 'License',
                amount: employee.deductionSource.license
            },
            sogcc1creditcoop: {
                label: 'SOGCC-1 Credit Coop',
                amount: employee.deductionSource.sogcc1creditcoop
            },
            sogcc2creditcoop: {
                label: 'SOGCC-2 Credit Coop',
                amount: employee.deductionSource.sogcc2creditcoop
            },
        },
        totalDeductions: employee.totalDeductions,
        netPay: employee.netPay
    }
    return payslip;
};
