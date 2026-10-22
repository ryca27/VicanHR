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
          fullName:'2026 Jan 1-15',
          detachment: '10 out of 100',
          regularHours: 'Draft',
          regularOvertime:'Continue',
          regularNDHours:'Continue',
          overtimeNDHours:'Continue',
          totalHours:'Continue',
          grossPay:'Continue',
          sss:'Continue',
          pagibig:'Continue',
          philHealth:'Continue',
          expenseA:'Continue',
          expenseB:'Continue',
          totalDeduction:'Continue',
          netPay:'Continue',
          payrollCutoff:'Continue',
          remarks:'Continue',
          status:'Continue',
          actions:'Continue',
        },
      ]
    }
  }

  onPreview(): void {
    //do something
  }
}
