import { Component, Input, Output, EventEmitter, inject, OnInit,DestroyRef  } from '@angular/core';
import { PayrollCutoffEmployee } from './../../payroll-cutoff/payroll-cutoff.models';
import {FormControl, ReactiveFormsModule, Validators, FormArray, FormGroup, FormBuilder, AbstractControl, ValidationErrors} from '@angular/forms'
import {tabNames} from './edit-payroll-constants'

//Components Import


//Components Import

import {TextboxComponent} from  './../../../../Components/textbox/textbox';
import { TableTabComponent } from './../../../../Components/table-tab/table-tab';
import {ButtonComponent} from './../../../../Components/button/button';


@Component({
  imports: [TextboxComponent, ReactiveFormsModule, TableTabComponent,ButtonComponent],
  selector: 'edit-payroll',
  styleUrl: './edit-payroll.scss',
  templateUrl: './edit-payroll.html',
})
export class EditPayroll implements OnInit {
  @Input() isOpen: boolean = false;
  @Input() employeePayroll!: PayrollCutoffEmployee;
  @Output() isSubmit: EventEmitter<boolean> = new EventEmitter<boolean>();

  editPayrollFormGroup!: FormGroup;
  private fb = inject(FormBuilder);
  tabNames = tabNames;
  activeTab: string = 'Income';
  saving : boolean = false;

  ngOnInit(): void {
    this.initializeEditPayrollForm(this.employeePayroll);
  }


  closeUploadModal(){
    this.isOpen = false;
    this.isSubmit.emit(false);
  }
  initializeEditPayrollForm(employee: PayrollCutoffEmployee): void {
    this.editPayrollFormGroup = this.fb.group({

      // EMPLOYEE DETAILS
      employeeNo: [
        { value: employee.employeeNo, disabled: true }
      ],
      employeeName: [
        { value: employee.employeeName, disabled: true }
      ],
      detachment: [
        { value: employee.detachment, disabled: true }
      ],
    
      // INCOME SOURCE
      incomeSource: this.fb.group({
    
        // HOURS
        regularHours: [
          employee.incomeSource.regularHours,
          [this.numberOnlyValidator]
        ],
        oTHours: [
          employee.incomeSource.oTHours ?? null,
          [this.numberOnlyValidator]
        ],
        lHOTHours: [
          employee.incomeSource.lHOTHours ?? null,
          [this.numberOnlyValidator]
        ],
        sHOTHours: [
          employee.incomeSource.sHOTHours ?? null,
          [this.numberOnlyValidator]
        ],
        nDHours: [
          employee.incomeSource.nDHours ?? null,
          [this.numberOnlyValidator]
        ],
        wDOHours:[
          employee.incomeSource.wDOHours ?? null,
          [this.numberOnlyValidator]
        ],
    
        // PAY - DISABLED
        regularPay: [
          {
            value: employee.incomeSource.regularPay,
            disabled: true
          },
          [this.numberOnlyValidator]
        ],
        oTPay: [
          {
            value: employee.incomeSource.oTPay ?? null,
            disabled: true
          },
          [this.numberOnlyValidator]
        ],
        lHOTPay: [
          {
            value: employee.incomeSource.lHOTPay ?? null,
            disabled: true
          },
          [this.numberOnlyValidator]
        ],
        sHOTPay: [
          {
            value: employee.incomeSource.sHOTPay ?? null,
            disabled: true
          },
          [this.numberOnlyValidator]
        ],
        
        nDPay: [
          {
            value: employee.incomeSource.nDPay ?? null,
            disabled: true
          },
          [this.numberOnlyValidator]
        ],
        wDOPay: [
          {
            value: employee.incomeSource.wDOPay ?? null,
            disabled: true
          },
          [this.numberOnlyValidator]
        ],
    
        // OTHER INCOME
        allowance: [
          employee.incomeSource.allowance ?? null,
          [this.numberOnlyValidator]
        ],
        uniformAllowance: [
          employee.incomeSource.uniformAllowance ?? null,
          [this.numberOnlyValidator]
        ],
        sSSLoanRefund: [
          employee.incomeSource.sSSLoanRefund ?? null,
          [this.numberOnlyValidator]
        ],
        cBRefund: [
          employee.incomeSource.cBRefund ?? null,
          [this.numberOnlyValidator]
        ],
        sSSContRefund: [
          employee.incomeSource.sSSContRefund ?? null,
          [this.numberOnlyValidator]
        ]
      }),
    
      // DEDUCTION SOURCE
      deductionSource: this.fb.group({
    
        // GOVERNMENT CONTRIBUTIONS
        sSSEyee: [
          employee.deductionSource.sSSEyee ?? null,
          [this.numberOnlyValidator]
        ],
        sSSEyer: [
          employee.deductionSource.sSSEyer ?? null,
          [this.numberOnlyValidator]
        ],
        philHealthEyee: [
          employee.deductionSource.philHealthEyee ?? null,
          [this.numberOnlyValidator]
        ],
        philHealthEyer: [
          employee.deductionSource.philHealthEyer ?? null,
          [this.numberOnlyValidator]
        ],
        pagibigContribution: [
          employee.deductionSource.pagibigContribution ?? null,
          [this.numberOnlyValidator]
        ],
        additionalPhicContribution: [
          employee.deductionSource.additionalPhicContribution ?? null,
          [this.numberOnlyValidator]
        ],
        additionalSSSContribution: [
          employee.deductionSource.additionalSSSContribution ?? null,
          [this.numberOnlyValidator]
        ],
    
        // LOANS
        sSSLoanSalary: [
          employee.deductionSource.sSSLoanSalary ?? null,
          [this.numberOnlyValidator]
        ],
        sSSLoanCalamity: [
          employee.deductionSource.sSSLoanCalamity ?? null,
          [this.numberOnlyValidator]
        ],
        sSSCondonation: [
          employee.deductionSource.sSSCondonation ?? null,
          [this.numberOnlyValidator]
        ],
    
        // INSURANCE
        benlifeInsurance: [
          employee.deductionSource.benlifeInsurance ?? null,
          [this.numberOnlyValidator]
        ],
        groupInsurance: [
          employee.deductionSource.groupInsurance ?? null,
          [this.numberOnlyValidator]
        ],
    
        // OTHER DEDUCTIONS
        cashBond: [
          employee.deductionSource.cashBond ?? null,
          [this.numberOnlyValidator]
        ],
        uniformParaphernalia: [
          employee.deductionSource.uniformParaphernalia ?? null,
          [this.numberOnlyValidator]
        ],
        paraphernalia: [
          employee.deductionSource.paraphernalia ?? null,
          [this.numberOnlyValidator]
        ],
        training: [
          employee.deductionSource.training ?? null,
          [this.numberOnlyValidator]
        ],
        familySupport: [
          employee.deductionSource.familySupport ?? null,
          [this.numberOnlyValidator]
        ],
        trainingSchool: [
          employee.deductionSource.trainingSchool ?? null,
          [this.numberOnlyValidator]
        ],
        license: [
          employee.deductionSource.license ?? null,
          [this.numberOnlyValidator]
        ],
        sogcc1creditcoop: [
          employee.deductionSource.sogcc1creditcoop ?? null,
          [this.numberOnlyValidator]
        ],
        sogcc2creditcoop: [
          employee.deductionSource.sogcc2creditcoop ?? null,
          [this.numberOnlyValidator]
        ]
      }),
    
      // PAYROLL TOTALS - DISABLED
      grossPay: [
        {
          value: employee.grossPay,
          disabled: true
        },
        [this.numberOnlyValidator]
      ],
      totalDeductions: [
        {
          value: employee.totalDeductions,
          disabled: true
        },
        [this.numberOnlyValidator]
      ],
      netPay: [
        {
          value: employee.netPay,
          disabled: true
        },
        [this.numberOnlyValidator]
      ],
    
      // PAYROLL INFORMATION
      payrollPeriod: [
        { value: employee.payrollPeriod, disabled: true }
      ],
      status: [
        { value: employee.status, disabled: true }
      ],
      actions: [
        { value: [...employee.actions], disabled: true }
      ],
      isFinalized: [
        { value: employee.isFinalized, disabled: true }
      ]
    });
  }

  async submitForm() {
    if (this.saving) return;
  }

  //Listenes
  activeTabOutputListener(message: string): void {
    this.activeTab = message;
  }

  closeEditPayrollModal() {
    this.isOpen = false;
    this.isSubmit.emit(false);
    this.editPayrollFormGroup.reset();
  }
  
  
numberOnlyValidator(
  control: AbstractControl
): ValidationErrors | null {
  const value = control.value;

  // Allow optional empty fields
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // Reject booleans, objects, and other non-string/non-number types
  if (typeof value !== 'string' && typeof value !== 'number') {
    return { numberOnly: true };
  }

  // Reject whitespace-only input
  if (typeof value === 'string' && value.trim() === '') {
    return { numberOnly: true };
  }

  // Accept valid numeric values, including numeric strings
  return Number.isFinite(Number(value))
    ? null
    : { numberOnly: true };
}

}
