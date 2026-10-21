import { Component, OnInit } from '@angular/core';
import {FormControl, ReactiveFormsModule, Validators, FormGroup, FormBuilder} from '@angular/forms'
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { provideNativeDateAdapter } from '@angular/material/core';
import { FormField } from '@angular/forms/signals';

// Components Import
import {TextboxComponent} from './../../Components/textbox/textbox'
import {DropdownComponent} from './../../Components/dropdown/dropdown'
import {ButtonComponent} from './../../Components/button/button'
import {TableComponent} from './../../Components/table/table'
import {DoubleDatePickerComponent} from './../../Components/double-date-picker/double-date-picker'
import {UploadModal} from './modals/upload/upload';
import {AcceptedRowsModal} from './modals/accepted-rows/accepted-rows';


@Component({
  selector: 'app-payroll',
  imports: [TextboxComponent,
    DropdownComponent,
    TableComponent,
    DoubleDatePickerComponent,
    ButtonComponent,
    UploadModal,
    AcceptedRowsModal,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    ReactiveFormsModule, FormField],
  providers:[provideNativeDateAdapter()],
  templateUrl: './payroll.html',
  styleUrl: './payroll.scss',
})
export class Payroll implements OnInit {
  mockData: any = {}
  isUploadModalVisible: boolean = false;
  isAcceptedRowsModalVisible: boolean = false;
  createPayrollFormGroup = new FormGroup({
    startDate: new FormControl('', {
      validators: [Validators.required, Validators.minLength(2)]
    }),
    endDate : new FormControl('', {
      validators: [Validators.required, Validators.minLength(2)]
    }),
  })

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

  onSubmit(){
    console.log(this.createPayrollFormGroup.value)
    this.isUploadModalVisible = true
  }

  closeUploadModalListener(message: boolean){
    this.isUploadModalVisible = false;
    this.isAcceptedRowsModalVisible = message;
  }

  closeAcceptedRowsListener(message: boolean){
    this.isAcceptedRowsModalVisible = message
  }

  //Double date picker output listener
  startDateOutputListener(message:string): void{
    this.createPayrollFormGroup.controls.startDate.setValue(message)
  }
  endDateOutputListener(message:string): void{
    this.createPayrollFormGroup.controls.endDate.setValue(message)
  }

}
