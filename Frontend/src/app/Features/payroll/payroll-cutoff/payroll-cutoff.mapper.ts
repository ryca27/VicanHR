import { PayrollCutoffEmployee, payrolCutoffDeduction, payrollCutoffIncome } from './payroll-cutoff.models';
import {incomeSourceKeys, deductionSourceKeys} from './payroll-cutoff-constants'

export function employeeTablePreparation(employees: Array<PayrollCutoffEmployee>): Array<any>{
    let grossPay: number;
    let totalDeductions: number;
    let netPay: number;
    let tableReadyRows: Array<any> = [];


    employees.forEach(e=>{
        let status = e.isFinalized ? 1 : (incomeSourceKeys.every((key) => e.incomeSource[key] !== undefined && e.incomeSource[key] !== null) &&
         deductionSourceKeys.every((key) => e.deductionSource[key] !== undefined && e.deductionSource[key] !== null)) ? 2 : 3
        let rowToAdd = { id: e.employeeNo, fullName: e.employeeName, detachment: e.detachment, ...e.incomeSource, ...e.deductionSource, netPay: e.netPay, remarks: e.remarks, status: e.status};
        tableReadyRows.push(rowToAdd);
    })
    return tableReadyRows
}

export function employeeTableActionPreparation(size: number): Array<Array<{value:number, isDisabled: boolean}>>{
    let tableActionReadyRows: Array<Array<{value:number, isDisabled: boolean}>> = [];
    let i:number = 0;
    while (i < size){
        let actionRow = [{value:1, isDisabled: true}, {value:2, isDisabled: true}, {value:3, isDisabled: true}];
        tableActionReadyRows.push(actionRow);
        i++
    }
    return tableActionReadyRows;
}
