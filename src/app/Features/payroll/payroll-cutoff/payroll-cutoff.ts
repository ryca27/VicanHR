import { Component, OnInit, inject } from '@angular/core';
import {detachmentList, statusList} from './payroll-cutoff-constants';
import {FormControl, ReactiveFormsModule, Validators, FormArray, FormGroup, FormBuilder,} from '@angular/forms'

//Components Import
import {TextboxComponent} from './../../../Components/textbox/textbox'
import {DropdownComponent} from './../../../Components/dropdown/dropdown'
import {ButtonComponent} from './../../../Components/button/button'
import {CardComponent} from './../../../Components/card/card'
import {TableComponent} from './../../../Components/table/table'


@Component({
  selector: 'app-payroll-cutoff',
  imports: [TextboxComponent, DropdownComponent, ButtonComponent, CardComponent, TableComponent, ReactiveFormsModule],
  templateUrl: './payroll-cutoff.html',
  styleUrl: './payroll-cutoff.scss',
})
export class PayrollCutoff implements OnInit {
  private fb = inject(FormBuilder);
  detachmentOptions = detachmentList;
  statusOptions = statusList;
  employeeCount : number = 0;
  grossPay: number = 0;
  deductions: number = 0;
  netPay: number = 0;
  mockData:any ={} ;
  tableRows!: Array<any>;
  tableColumns!: Array<string>;
  filters!: Array<{key: string, value: string}>;
  filterFormGroup!: FormGroup;

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
          status:1,
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
          fullName:'Ryan Kukulit',
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
          status:3,
          actions:[1,2,3],
        },
        {
          fullName:'Lea Babaet',
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
          status:'3',
          actions:[1,2,3],
        },
      ],
      tableActionRows:[
        [{value: 1, isDisabled: true}, {value: 2, isDisabled: true}, {value: 3, isDisabled: false}],
        [{value: 1, isDisabled: true}, {value: 2, isDisabled: false}, {value: 3, isDisabled: false}],
        [{value: 1, isDisabled: true}, {value: 2, isDisabled: false}, {value: 3, isDisabled: false}],
        [{value: 1, isDisabled: false}, {value: 2, isDisabled: true}, {value: 3, isDisabled: false}],
      ],
      rowsId: ['0001', '0002', '0003', '0004']
    }
    this.initializeFormGroup();
    this.initializeTableRows();

  }

  createObject<T extends object>(obj: T): T{
    return obj;
  }

  initializeFormGroup(): void{
    this.filterFormGroup = this.fb.group({
      name: '',
      detachment: '',
      status: ''
    })
  }

  initializeTableRows(): void{
    this.tableRows = this.mockData.tableRows;
  }


  onPreview(): void {
    // Use optional chaining and fallbacks to prevent crashes
    const name = (this.filterFormGroup.value.name?.toLowerCase()) || '';
    const detachment = (this.filterFormGroup.value.detachment?.toLowerCase()) || '';
    const status = this.filterFormGroup.value.status ?? '';
  
    this.tableRows = this.mockData.tableRows.filter((t: any) => {
      const matchName = (t.fullName || '').toLowerCase().includes(name);
      const matchDetachment = (t.detachment || '').toLowerCase().includes(detachment);
      
      // Fallback if status is an object or primitive
      const statusString = typeof t.status === 'object' ? JSON.stringify(t.status) : String(t.status || '');
      const matchStatus = statusString.includes(status);
  
      return matchName && matchDetachment && matchStatus;
    });
  }

  onDownload(): void{
    debugger;
  }

  //Table Output Listener
  checkBoxOutputListener(message: {isChecked: boolean, id: string}[]): void {
    debugger;
  }
}
