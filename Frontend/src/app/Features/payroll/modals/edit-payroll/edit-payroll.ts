import { Component, Input, Output, EventEmitter, inject, OnInit,DestroyRef  } from '@angular/core';
import { PayrollCutoffEmployee } from './../../payroll-cutoff/payroll-cutoff.models';
import {FormControl, ReactiveFormsModule, Validators, FormArray, FormGroup, FormBuilder,} from '@angular/forms'

//Components Import

import {TextboxComponent} from  './../../../../Components/textbox/textbox';


@Component({
  imports: [TextboxComponent, ReactiveFormsModule],
  selector: 'edit-payroll',
  styleUrl: './edit-payroll.scss',
  templateUrl: './edit-payroll.html',
})
export class EditPayroll implements OnInit {
  @Input() isOpen: boolean = false;
  @Input() employeePayroll!: PayrollCutoffEmployee;
  @Output() isSubmit: EventEmitter<boolean> = new EventEmitter<boolean>();

  editPayrollFormGroup!: FormGroup;

  ngOnInit(): void {
    
  }


  closeUploadModal(){
    this.isOpen = false;
    this.isSubmit.emit(false);
  }
}
