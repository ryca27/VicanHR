import { Component, OnInit } from '@angular/core';
import {detachmentList, statusList} from './payroll-cutoff-constants'

//Components Import
import {TextboxComponent} from './../../../Components/textbox/textbox'
import {DropdownComponent} from './../../../Components/dropdown/dropdown'
import {ButtonComponent} from './../../../Components/button/button'
import {CardComponent} from './../../../Components/card/card'
import {TableComponent} from './../../../Components/table/table'


@Component({
  selector: 'app-payroll-cutoff',
  imports: [TextboxComponent, DropdownComponent, ButtonComponent, CardComponent, TableComponent],
  templateUrl: './payroll-cutoff.html',
  styleUrl: './payroll-cutoff.scss',
})
export class PayrollCutoff implements OnInit {
  detachmentOptions = detachmentList;
  statusOptions = statusList;
  employeeCount : number = 0;
  grossPay: number = 0;
  deductions: number = 0;
  netPay: number = 0;
  mockData:any ={} ;

  ngOnInit(){
    this.mockData = {
      tableColumns: ['Full Name', 'Detachment', 'Regular Hours', 'Regular Overtime', 'Regular ND Hours', 'Overtime ND Hours', 
      'Total Hours','Gross Pay', 'SSS','PAGIBIG', 'PhilHealth', 'Expense A', 'Expense B', 'Total Deduction', 'Net Pay', 'Payroll Cutoff', 'Remarks', 'Status', 'Actions'],
      tableRows:[
        {
          fullName:'Ryan Tabernilla',
          detachment: 'Megabold',
          regularHours: '40',
          regularOvertime:'10',
          regularNDHours:'0',
          overtimeNDHours:'6',
          totalHours:'56',
          grossPay:'10000',
          sss:'100',
          pagibig:'100',
          philHealth:'100',
          expenseA:'200',
          expenseB:'500',
          totalDeduction:'1000',
          netPay:'90000',
          payrollCutoff:'January 1-15 2026',
          remarks:'Payroll Ready',
          status:2,
          actions:[1,2,3],
        },
        {
          fullName:'Lea Ganda',
          detachment: 'Bold of Asia',
          regularHours: '40',
          regularOvertime:'10',
          regularNDHours:'0',
          overtimeNDHours:'6',
          totalHours:'56',
          grossPay:'10000',
          sss:'100',
          pagibig:'100',
          philHealth:'100',
          expenseA:'200',
          expenseB:'500',
          totalDeduction:'1000',
          netPay:'90000',
          payrollCutoff:'January 1-15 2026',
          remarks:'Payroll Ready',
          status:2,
          actions:[1,2,3],
        },
        {
          fullName:'Ryan Tabernilla',
          detachment: 'Megabold',
          regularHours: '40',
          regularOvertime:'10',
          regularNDHours:'0',
          overtimeNDHours:'6',
          totalHours:'56',
          grossPay:'10000',
          sss:'100',
          pagibig:'100',
          philHealth:'100',
          expenseA:'200',
          expenseB:'500',
          totalDeduction:'1000',
          netPay:'90000',
          payrollCutoff:'January 1-15 2026',
          remarks:'Payroll Ready',
          status:2,
          actions:[1,2,3],
        },
        {
          fullName:'Lea Ganda',
          detachment: 'Bold of Asia',
          regularHours: '40',
          regularOvertime:'10',
          regularNDHours:'0',
          overtimeNDHours:'6',
          totalHours:'56',
          grossPay:'10000',
          sss:'100',
          pagibig:'100',
          philHealth:'100',
          expenseA:'200',
          expenseB:'500',
          totalDeduction:'1000',
          netPay:'90000',
          payrollCutoff:'January 1-15 2026',
          remarks:'Payroll Ready',
          status:2,
          actions:[1,2,3],
        },
      ],
      tableActionRows:[
        [{value: 1, isDisabled: true}, {value: 2, isDisabled: true}, {value: 3, isDisabled: false}],
        [{value: 1, isDisabled: true}, {value: 2, isDisabled: false}, {value: 3, isDisabled: false}],
      ]
    }
  }

  onPreview(): void {
    //do something
  }
}
