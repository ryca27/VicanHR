import { Component, OnInit } from '@angular/core';
import {TextboxComponent} from './../../Components/textbox/textbox'
import {DropdownComponent} from './../../Components/dropdown/dropdown'
import {TableComponent} from './../../Components/table/table'
import {DatePickerComponent} from './../../Components/date-picker/date-picker'

@Component({
  selector: 'app-payroll',
  imports: [TextboxComponent,DropdownComponent, TableComponent, DatePickerComponent],
  templateUrl: './payroll.html',
  styleUrl: './payroll.scss',
})
export class Payroll implements OnInit {
  constructor(){}

  mockData: any = {}

  ngOnInit(){
    this.mockData = {
      tableColumns: ['Period', 'Payroll Ready Employees', 'Status', 'Action'],
      tableRows:[
        {
          cutoffDate:'2026 Jan 1-15',
          payrollReady: '10 out of 100',
          status: 'Draft',
          action:'Continue'
        },
        {
          cutoffDate:'2025 Dec 16-31',
          payrollReady: '100 out of 100',
          status: 'Draft',
          action:'Continue'
        },
        {
          cutoffDate:'2025 Dec 1-15',
          payrollReady: '50 out of 50',
          status: 'Draft',
          action:'Continue'
        },
      ]
    }
  }

}
