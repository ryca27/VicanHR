import { ActivatedRoute } from '@angular/router';
import { ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AttendancePost } from '../modals/upload/upload.models';
import { Component, OnInit, inject, ElementRef, ViewChild } from '@angular/core';
import {demoAttentionIssues, demoEmployees, statusList} from './payroll-cutoff-constants';
import {FormControl, ReactiveFormsModule, Validators, FormArray, FormGroup, FormBuilder,} from '@angular/forms'
import { PdfService } from './../../../services/pdf-service'

//Components Import
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
  imports: [DropdownComponent, ButtonComponent, CardComponent, TableComponent, UploadModal, PayslipComponent, ReactiveFormsModule],
  templateUrl: './payroll-cutoff.html',
  styleUrl: './payroll-cutoff.scss',
})
export class PayrollCutoff implements OnInit {
  private route = inject(ActivatedRoute);
  private changes = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private requestVersion = 0;
  loadError = '';
  private fb = inject(FormBuilder);
  
  nameOptions: { value: string; label: string }[] = [];
  detachmentOptions: { value: string; label: string }[] = [];
  statusOptions = statusList;
  employeeCount : number = 0;
  totalHoursDisplay = '—';
  grossPayTotal = '—';
  deductionsTotal = '—';
  netPayTotal = '—';
  mixedStatuses = false;

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
  selectedPayslip?: Payslip;
  demoMode = false;
  private readonly attentionIssues = new Map<string, { reason: string; details: string; action: string }>();

  get visibleAttentionIssues() {
    return this.tableRowsId.flatMap((id, index) => {
      const issue = this.attentionIssues.get(id);
      return issue ? [{ id, employeeName: this.tableRows[index].fullName as string, ...issue }] : [];
    });
  }
  private demoPayslips = new Map<string, Payslip>();
  private readonly demoCutoffStart = '2026-09-01';
  private readonly demoCutoffEnd = '2026-09-15';
  private readonly demoPayrollPeriod = 'September 1–15, 2026';

  private loadDemo() {
    ++this.requestVersion;
    this.demoMode = true;
    this.loadError = '';
    this.selectedRows = [];
    this.mixedStatuses = false;
    this.isDownloadDisabled = this.isFinalizeDisabled = true;
    this.demoPayslips.clear();
    this.attentionIssues.clear();
    this.mockData.tableRows = demoEmployees.map(({ name: employeeName, detachment, status }, index) => {
      const employeeId = `DEMO-${String(index + 1).padStart(3, '0')}`;
      const issue = demoAttentionIssues[employeeName];
      if (issue) this.attentionIssues.set(employeeId, issue);
      const regularHours = 72 + index * 4;
      const overtimeHours = 4 + index * 2;
      const regularPay = regularHours * 100;
      const overtimePay = overtimeHours * 125;
      const grossPay = regularPay + overtimePay;
      const totalDeductions = 225 + 100 + 100;
      const netPay = grossPay - totalDeductions;
      this.demoPayslips.set(employeeId, {
        employeeId, employeeName, assignedPost: 'Demo post', detachment,
        payrollPeriod: this.demoPayrollPeriod, payDate: '2026-09-18',
        earning: {
          regularPay: { label: 'Regular Pay', hours: regularHours, rate: 100, pay: regularPay },
          otPay: { label: 'Overtime Pay', hours: overtimeHours, rate: 125, pay: overtimePay },
          allowance: { label: 'Allowance' },
          lHOTPay: { label: 'Legal Holiday Overtime' },
          sHOTPay: { label: 'Special Holiday Overtime' },
          ndPay: { label: 'Night Differential', hours: 0 },
          uniformAllowance: { label: 'Uniform Allowance' },
          wDOPay: { label: 'Worked Day Off' },
          sSSLoanRefund: { label: 'SSS Loan Refund' },
          cBRRefund: { label: 'Cash Bond Refund' },
          sSSContRefund: { label: 'SSS Contribution Refund' },
        },
        deduction: {
          sSSEyee: { label: 'SSS Contribution', amount: 225 },
          philHealthEyee: { label: 'PhilHealth Contribution', amount: 100 },
          pagibigContribution: { label: 'Pag-IBIG Contribution', amount: 100 },
        },
        grossPay, totalDeductions, netPay,
      });
      return {
        id: employeeId, fullName: employeeName, detachment, regularHours, regularOvertime: overtimeHours,
        nightDifferentialHours: 0, btrHours: 0, wdoHours: 0, totalHours: regularHours + overtimeHours, grossPay,
        sss: 225, pagibig: 100, philHealth: 100, expenseA: 0, expenseB: 0, totalDeduction: totalDeductions,
        netPay, payrollCutoff: this.demoPayrollPeriod,
        remarks: issue?.reason
          ?? `Demo · ${this.statusOptions.find(option => Number(option.value) === status)?.label}`,
        status, actions: [],
      };
    });
    this.filterFormGroup.reset();
    this.initializeTableRows();
  }

  //services
  private pdfService = inject(PdfService);
  //ref elements
  @ViewChild('payslipContent')
  payslipContent!: ElementRef<HTMLElement>;

  ngOnInit(){
    
    this.mockData = {
      tableColumns: ['Full Name', 'Detachment', 'Regular Hours', 'Regular Overtime', 'Night Diff. Hours', 'Breaktime Hours', 'WDO Hours',
      'Total Hours','Gross Pay', 'SSS','PAGIBIG', 'PhilHealth', 'Expense A', 'Expense B', 'Total Deduction', 'Net Pay', 'Payroll Cutoff', 'Remarks', 'Status', 'Actions'],
      tableRows: [],
      tableActionRows: [],
    };
    this.initializeFormGroup();
    this.initializeTableRows();
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');
      if (id === 'demo') this.loadDemo();
      else if (id) void this.loadCutoff(id);
    });
  }

  async loadCutoff(id: string) {
    const version = ++this.requestVersion;
    this.loadError = '';
    this.demoMode = false;
    this.demoPayslips.clear();
    this.attentionIssues.clear();
    this.mockData.tableRows = [];
    this.filterFormGroup.reset();
    this.employeeCount = 0;
    this.totalHoursDisplay = '—';
    this.selectedRows = [];
    this.mixedStatuses = false;
    this.isFinalizeDisabled = this.isDownloadDisabled = true;
    this.initializeTableRows();
    try {
      const response = await fetch(`/api/attendance/${encodeURIComponent(id)}/`);
      if (!response.ok) throw new Error(response.status === 403
        ? 'Sign in as admin or finance to view this cutoff.' : 'Could not load this attendance cutoff.');
      const saved: AttendancePost = await response.json();
      if (version !== this.requestVersion) return;
      this.mockData.tableRows = saved.employees.map((row, index) => {
        if (row.regularHours == null) {
          this.attentionIssues.set(String(index), {
            reason: 'Missing regular hours',
            details: 'The saved attendance has no regular hours for this employee.',
            action: 'Confirm the regular hours in the source DTR, update the Summary, and re-upload it.',
          });
        }
        return {
          id: String(index), fullName: this.formatEmployeeName(row.employeeName), detachment: row.detachment ?? saved.detachment,
          regularHours: row.regularHours ?? '—', regularOvertime: row.overtimeHours ?? 0,
          nightDifferentialHours: row.nightDifferentialHours ?? 0,
          btrHours: row.btrHours ?? 0, wdoHours: row.wdoHours ?? 0,
          totalHours: this.sumAttendanceHours(row), grossPay: '—',
          sss: '—', pagibig: '—', philHealth: '—', expenseA: '—', expenseB: '—',
          totalDeduction: '—', netPay: '—', payrollCutoff: saved.period,
          remarks: row.regularHours == null ? 'Missing regular hours' : 'Attendance uploaded',
          status: row.regularHours == null ? 3 : null, actions: [],
        };
      });
      this.updateFilterOptions();
      this.onPreview();
    } catch (error) {
      if (version === this.requestVersion) this.loadError = error instanceof Error ? error.message : 'Could not load attendance.';
    } finally {
      this.changes.markForCheck();
    }
  }

  initializeFormGroup(): void{
    this.filterFormGroup = this.fb.nonNullable.group({
      name: '',
      detachment: '',
      status: ''
    })
  }

  initializeTableRows(): void{
    this.tableRowsId = [];
    this.updateFilterOptions();
    this.tableRows = structuredClone(this.mockData.tableRows);
    this.updateKpis();
    this.tableRows.forEach(row => {
      this.tableRowsId.push(row.id)
      delete row.id
      if (typeof row.totalHours === 'number') {
        row.totalHours = row.totalHours.toLocaleString('en-PH', { maximumFractionDigits: 2 });
      }
    })
  }


  resetFilters(): void {
    this.filterFormGroup.reset();
    this.onPreview();
  }

  onPreview(): void {
    const { name, detachment, status } = this.filterFormGroup.value;
    const tableRows = this.mockData.tableRows.filter((row: any) =>
      (!name || row.fullName === name) &&
      (!detachment || row.detachment === detachment) &&
      (!status || String(row.status) === status)
    );
    this.tableRowsId = []
    this.checkBoxOutputListener([]);
    this.tableRows = structuredClone(tableRows)
    this.updateKpis();
    this.tableRows.forEach(row => {
      this.tableRowsId.push(row.id)
      delete row.id
      if (typeof row.totalHours === 'number') {
        row.totalHours = row.totalHours.toLocaleString('en-PH', { maximumFractionDigits: 2 });
      }
    })
  }

  private sumAttendanceHours(row: AttendancePost['employees'][number]): number {
    return (row.regularHours ?? 0) + (row.overtimeHours ?? 0)
      + (row.nightDifferentialHours ?? 0) + (row.wdoHours ?? 0);
  }

  private formatEmployeeName(name: string): string {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (trimmed.includes(',')) return trimmed.replace(/\s*,\s*/g, ', ');
    const parts = trimmed.split(' ');
    if (parts.length < 2) return trimmed;
    const surname = parts.pop();
    return `${surname}, ${parts.join(' ')}`;
  }

  private updateFilterOptions(): void {
    const optionsFor = (field: 'fullName' | 'detachment') => {
      const values = new Set<string>(this.mockData.tableRows.map((row: Record<typeof field, string>) => row[field]));
      values.delete('');
      return [...values].sort((a, b) => a.localeCompare(b)).map(value => ({ value, label: value }));
    };
    this.nameOptions = optionsFor('fullName');
    this.detachmentOptions = optionsFor('detachment');
  }

  private updateKpis(): void {
    this.employeeCount = this.tableRows.length;
    const sum = (field: string, currency = false) => {
      const values = this.tableRows.map(row => row[field]);
      if (!values.length || values.some(value => typeof value !== 'number')) return '—';
      return values.reduce((total, value) => total + value, 0).toLocaleString('en-PH',
        currency ? { style: 'currency', currency: 'PHP' } : { maximumFractionDigits: 2 });
    };
    this.totalHoursDisplay = sum('totalHours');
    this.grossPayTotal = sum('grossPay', true);
    this.deductionsTotal = sum('totalDeduction', true);
    this.netPayTotal = sum('netPay', true);
  }

  onToggleFinalize(): void {
    if (!this.demoMode || this.isGeneratingPdf) return;
    if (!this.isFinalizeDisabled) {
      this.updateDemoStatus(1);
    } else if (!this.isDownloadDisabled) {
      this.updateDemoStatus(2);
    }
  }

  private updateDemoStatus(status: 1 | 2): void {
    for (const row of this.mockData.tableRows) {
      if (this.selectedRows.includes(row.id)) {
        row.status = status;
        row.remarks = status === 1 ? 'Demo · Payroll Ready' : 'Demo · For Approval';
      }
    }
    this.selectedRows = [];
    this.mixedStatuses = false;
    this.finalizeChecker();
    this.downloadChecker();
    this.onPreview();
  }

  async onDownload(): Promise<void> {
    if (!this.demoMode || this.isGeneratingPdf || this.isDownloadDisabled) return;
    const payslips = this.mockData.tableRows
      .filter((row: { id: string; status: number }) =>
        row.status === 1 && this.selectedRows.includes(row.id))
      .map((row: { id: string }) => this.demoPayslips.get(row.id)!) as Payslip[];
    this.isGeneratingPdf = true;
    this.loadError = '';
    try {
      for (const payslip of payslips) {
        this.selectedPayslip = payslip;
        this.changes.detectChanges();
        const name = payslip.employeeName.replace(/[^\p{L}\p{N}]+/gu, '_');
        const cutoff = `${this.demoCutoffStart}_to_${this.demoCutoffEnd}`;
        const filename = `Demo_Payslip_${payslip.employeeId}_${name}_${cutoff}.pdf`;
        const paper = this.payslipContent.nativeElement.querySelector<HTMLElement>('.payslip-paper');
        if (!paper) throw new Error('Could not render the demo payslip.');
        await this.pdfService.download(paper, filename);
      }
    } catch {
      this.loadError = 'Could not generate the demo payslip PDF.';
    } finally {
      this.selectedPayslip = undefined;
      this.isGeneratingPdf = false;
      this.changes.markForCheck();
    }
  }

  refreshCurrentCutoff(id: number) {
    if (String(id) === this.route.snapshot.paramMap.get("id")) void this.loadCutoff(String(id));
  }

  onUpload(): void {
    this.isUploadModalVisible = true;
  }

  //Table Output Listener
  checkBoxOutputListener(message: string[]): void {
    this.selectedRows = message;
    this.mixedStatuses = this.demoMode && new Set(this.mockData.tableRows
      .filter((row: { id: string }) => message.includes(row.id))
      .map((row: { status: number }) => row.status)).size > 1;
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

}
