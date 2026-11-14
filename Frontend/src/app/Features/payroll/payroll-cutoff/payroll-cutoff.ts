import { Component, OnInit, inject, ElementRef, ViewChild } from '@angular/core';
import {detachmentList, statusList} from './payroll-cutoff-constants';
import {FormControl, ReactiveFormsModule, Validators, FormArray, FormGroup, FormBuilder,} from '@angular/forms'
import { PdfService } from './../../../services/pdf-service'

//Components Import
import {TextboxComponent} from './../../../Components/textbox/textbox'
import {DropdownComponent} from './../../../Components/dropdown/dropdown'
import {ButtonComponent} from './../../../Components/button/button'
import {CardComponent} from './../../../Components/card/card'
import {TableComponent} from './../../../Components/table/table'
import {CheckBoxOutputInterface} from './../../../Components/table/./table-constants'
import {UploadModal} from './../modals/upload/upload';
import {Payslip } from './../payslip/payslip.model'
import {PayslipComponent} from './../payslip/payslip'


@Component({
  selector: 'app-payroll-cutoff',
  imports: [TextboxComponent, DropdownComponent, ButtonComponent, CardComponent, TableComponent, UploadModal, PayslipComponent, ReactiveFormsModule],
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
  tableRowsId: Array<string> = [];
  filters!: Array<{key: string, value: string}>;
  filterFormGroup!: FormGroup;
  selectedRows!: Array<string>;
  isFinalizeDisabled: boolean = true;
  isDownloadDisabled: boolean = true;
  isUploadModalVisible: boolean = false;
  isGeneratingPdf: boolean = false;
  startDate: string = '';
  endDate: string = '';
  selectedPayslip: Payslip = {
    employeeId: 'EMP-001',
    employeeName: 'JOSELITO ANCHETA',
    assignedPost: 'VSSC DRIVER',
    detachment: 'VICAN',
    cutoffStart: '2024-01-16',
    cutoffEnd: '2024-01-31',
    payDate: '2024-01-31',
  
    regularHours: 0,
    overtimeHours: 0,
    nightDifferentialHours: 0,
  
    earnings: [
      { label: 'Regular Pay', amount: 4880 },
      { label: 'Overtime Pay', amount: 3050 }
    ],
  
    deductions: [
      { label: 'SSS Contribution', amount: 225 },
      { label: 'PhilHealth Contribution', amount: 97.60 },
      { label: 'Pag-IBIG Contribution', amount: 100 },
      { label: 'Cash Bond', amount: 350 }
    ],
  
    grossPay: 7930,
    totalDeductions: 772.60,
    netPay: 7157.40
  };

  //services
  private pdfService = inject(PdfService);
  //ref elements
  @ViewChild('payslipContent')
  payslipContent!: ElementRef<HTMLElement>;

  ngOnInit(){
    
    this.mockData = {
      tableColumns: ['Full Name', 'Detachment', 'Regular Hours', 'Regular Overtime', 'Regular ND Hours', 'Overtime ND Hours', 
      'Total Hours','Gross Pay', 'SSS','PAGIBIG', 'PhilHealth', 'Expense A', 'Expense B', 'Total Deduction', 'Net Pay', 'Payroll Cutoff', 'Remarks', 'Status', 'Actions'],
      tableRows:[
        {
          fullName:'Ryan Tabernilla',
          id:'0001',
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
          fullName:'Lea Taihen',
          id:'0002',
          detachment: 'Bold of Asia',
          regularHours: '0',
          regularOvertime:'2',
          regularNDHours:'10',
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
          remarks:'For Approval',
          status:2,
          actions:[1,2,3],
        },
        {
          fullName:'Ryan Kukulit',
          id:'0003',
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
          remarks:'Needs Attention',
          status:3,
          actions:[1,2,3],
        },
        {
          fullName:'Lea Babaet',
          id:'0004',
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
          remarks:'Needs Attention',
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
    this.tableRows = structuredClone(this.mockData.tableRows);
    this.tableRows.forEach(row => {
      this.tableRowsId.push(row.id)
      delete row.id
    })
  }


  onPreview(): void {
    // Use optional chaining and fallbacks to prevent crashes
    const name = (this.filterFormGroup.value.name?.toLowerCase()) || '';
    const detachment = (this.filterFormGroup.value.detachment?.toLowerCase()) || '';
    const status = this.filterFormGroup.value.status ?? '';
  
    let tableRows = this.mockData.tableRows.filter((t: any) => {
      const matchName = (t.fullName || '').toLowerCase().includes(name);
      const matchDetachment = (t.detachment || '').toLowerCase().includes(detachment);
      
      // Fallback if status is an object or primitive
      const statusString = typeof t.status === 'object' ? JSON.stringify(t.status) : String(t.status || '');
      const matchStatus = statusString.includes(status);
  
      return matchName && matchDetachment && matchStatus;
    });
    this.tableRowsId = []
    this.tableRows = structuredClone(tableRows)
    this.tableRows.forEach(row => {
      this.tableRowsId.push(row.id)
      delete row.id
    })
  }

  onFinalize(): void {
    let finalizeRow = [];
    this.mockData.tableRows.filter((row:any) => this.selectedRows.includes(row.id)).map((row:any)=> {
      row.status = 1;
      row.remarks = 'Payroll Ready'
    });
    this.onPreview();
  }

  onDownload(): void{
    let downloadRow = [];
    downloadRow = this.mockData.tableRows.filter((row:any) => this.selectedRows.includes(row.id))
    this.downloadPayslip();
    
  }

  onUpload(): void {
    this.isUploadModalVisible = true;
  }

  //Table Output Listener
  checkBoxOutputListener(message: string[]): void {
    this.selectedRows = message;
    this.finalizeChecker();
    this.downloadChecker();
  }

  //Upload Component Listenere
  closeUloadModalListener(message: boolean): void {
    this.isUploadModalVisible = false;
  };

  finalizeChecker(): void{
    this.isFinalizeDisabled = this.mockData.tableRows.filter((row:any) => this.selectedRows.includes(row.id) && row.status==2).length != this.selectedRows.length || this.selectedRows.length == 0;
  }

  downloadChecker(): void{
    this.isDownloadDisabled = this.mockData.tableRows.filter((row:any) => this.selectedRows.includes(row.id) && row.status==1).length != this.selectedRows.length || this.selectedRows.length == 0;
  }

  //async service functions

  async downloadPayslip(): Promise<void> {
    if (this.isGeneratingPdf) return;

    this.isGeneratingPdf = true;

    try {
      const filename =
        `payslip_${this.selectedPayslip.employeeId}.pdf`;

      await this.pdfService.download(
        this.payslipContent.nativeElement,
        filename
      );
    } catch (error) {
      console.error('Payslip generation failed', error);
    } finally {
      this.isGeneratingPdf = false;
    }
}
}
