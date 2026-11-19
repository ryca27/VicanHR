import { RouterLink } from '@angular/router';
import { Component, OnInit, signal, afterNextRender } from '@angular/core';
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
import { AttendancePost, Upload } from './modals/upload/upload.models'


@Component({
  selector: 'app-payroll',
  imports: [RouterLink, TextboxComponent,
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
  savedCutoffs = signal<{cutoffId: number; period: string; detachment: string}[]>([]);
  readError = signal('');

  constructor() {
    afterNextRender(() => this.loadCutoffs());
  }

  async loadCutoffs() {
    try {
      const response = await fetch('/api/attendance/');
      if (!response.ok) throw new Error('Sign in with an admin or finance account to view saved attendance.');
      this.savedCutoffs.set(await response.json());
    } catch (error) {
      this.readError.set(error instanceof Error ? error.message : 'Could not load attendance.');
    }
  }

  mockData: any = {}
  isUploadModalVisible: boolean = false;
  isAcceptedRowsModalVisible: boolean = false;
  isSubmitDisabled: boolean = true;
  tableRows!: Array<any>;
  tableColumns!: Array<string>;
  tableRowsId: Array<string> = [];
  dataUpload: Upload= {attendance: [], expense: [], allowance: []};
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
      tableColumns: ['Period', 'Payroll Ready Employees', 'Payroll Status', 'Action'],
      tableRows:[
        {
          id: '1',
          cutoffDate:'2026 Jan 1-15',
          payrollReady: '10 out of 100',
          payrollStatus: 'Draft',
          action:'Continue'
        },
        {
          id: '2',
          cutoffDate:'2025 Dec 16-31',
          payrollReady: '100 out of 100',
          payrollStatus: 'Draft',
          action:'Continue'
        },
        {
          id: '3',
          cutoffDate:'2025 Dec 1-15',
          payrollReady: '50 out of 50',
          payrollStatus: 'Draft',
          action:'Continue'
        },
      ],
    };
    this.initializeTableRows();
    this.initializeTableColumns();
  }

  initializeTableRows(): void{
    this.tableRows = structuredClone(this.mockData.tableRows);
    this.tableRows.forEach(row => {
      this.tableRowsId.push(row.id)
      delete row.id
    })
  }

  initializeTableColumns(): void{
    this.tableColumns = this.mockData.tableColumns
  }

  onSubmit(){
    console.log(this.createPayrollFormGroup.value)
    this.isUploadModalVisible = true
  }

  closeUploadModalListener(message: boolean){
    this.isUploadModalVisible = false;
    this.isAcceptedRowsModalVisible = false;
  }

  closeAcceptedRowsListener(message: boolean){
    this.isAcceptedRowsModalVisible = message
  }

  dataUploadOutputListener(message: Upload){
    this.dataUpload = message;
  }

  //Double date picker output listener
  startDateOutputListener(message:string): void{
    this.createPayrollFormGroup.controls.startDate.setValue(message)
  }
  endDateOutputListener(message:string): void{
    this.createPayrollFormGroup.controls.endDate.setValue(message)
  }

}
