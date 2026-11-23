import { ActivatedRoute } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AttendanceAdjustmentSource, AttendanceHourField, AttendancePost, AttendanceRecord } from '../modals/upload/upload.models';
import { Component, OnInit, inject, ElementRef, ViewChild } from '@angular/core';
import {demoAttentionIssues, demoExpenseAllocation, demoLedgerEmployee, statusList, payrollColumns, payrollCutoffEmployees, payrollDeductionColumns, deductionSourceKeys, expenseDeductionKeys} from './payroll-cutoff-constants';
import {employeeTableActionPreparation, employeeTablePreparation, payslipToGeneratePreparation} from './payroll-cutoff.mapper'
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
  imports: [CurrencyPipe, DropdownComponent, ButtonComponent, CardComponent, TableComponent, UploadModal, PayslipComponent, ReactiveFormsModule],
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
  hourTotals: { label: string; value: string; base: string | null; adjustment: string | null }[] = [];
  grossPayTotal = '—';
  deductionsTotal = '—';
  netPayTotal = '—';
  mixedStatuses = false;

  mockData:any ={} ;
  tableRows!: Array<any>;
  tableColumns: Array<string> = payrollColumns;
  tableRowsId: Array<string> = [];
  tableActions: Array<any> = [];
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
  demoMode: boolean = false;
  readonly demoExpenseAllocation = demoExpenseAllocation;
  readonly demoEmployeeLinks = {
    [demoLedgerEmployee.id]: { path: '/expay/employee', queryParams: { employeeId: demoLedgerEmployee.id } },
  };
  savedCutoffId: string | null = null;
  savedCutoffPeriod = '';
  adjustmentSources: AttendanceAdjustmentSource[] = [];
  private readonly attentionIssues = new Map<string, { reason: string; details: string; action: string }>();

  get visibleAttentionIssues() {
    return this.tableRowsId.flatMap((id, index) => {
      const row = this.tableRows[index];
      const issue = typeof row.netPay === 'number' && row.netPay < 0
        ? {
            reason: 'Negative net pay',
            details: `Net pay is ${row.netPay.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}. Deductions exceed gross pay.`,
            action: 'Verify gross pay and deductions before finalizing this employee.',
          }
        : this.attentionIssues.get(id);
      return issue ? [{ id, employeeName: row.fullName as string, ...issue }] : [];
    });
  }
  private demoPayslips = new Map<string, Payslip>();
  private readonly demoCutoffStart = '2026-09-01';
  private readonly demoCutoffEnd = '2026-09-15';

  private loadDemo() {
    ++this.requestVersion;
    this.demoMode = true;
    this.savedCutoffId = null;
    this.adjustmentSources = [];
    this.loadError = '';
    this.selectedRows = [];
    this.mixedStatuses = false;
    this.isDownloadDisabled = this.isFinalizeDisabled = true;
    this.demoPayslips.clear();
    this.attentionIssues.clear();
    this.tableColumns = payrollColumns;
    this.mockData.tableRows = employeeTablePreparation(payrollCutoffEmployees);
    payrollCutoffEmployees.forEach((employee, index) => {
      this.mockData.tableRows[index].fullName = this.formatEmployeeName(employee.employeeName);
      const issue = demoAttentionIssues[employee.employeeName];
      if (issue) this.attentionIssues.set(employee.employeeNo, issue);
      if (employee.netPay < 0) this.mockData.tableRows[index].status = 3;
      this.demoPayslips.set(employee.employeeNo, {
        ...payslipToGeneratePreparation(employee), assignedPost: 'Demo post', payDate: '2026-09-18',
      });
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
      'Gross Pay', ...payrollDeductionColumns, 'Total Deductions', 'Net Pay', 'Payroll Cutoff', 'Remarks', 'Status', 'Actions'],
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
    this.savedCutoffId = null;
    this.adjustmentSources = [];
    this.tableColumns = this.mockData.tableColumns;
    this.demoPayslips.clear();
    this.attentionIssues.clear();
    this.mockData.tableRows = [];
    this.filterFormGroup.reset();
    this.employeeCount = 0;
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
      this.savedCutoffId = id;
      this.savedCutoffPeriod = saved.period;
      this.adjustmentSources = saved.adjustments ?? [];
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
          regularHours: row.regularHours ?? '—', regularOvertime: row.overtimeHours ?? '—',
          nightDifferentialHours: row.nightDifferentialHours ?? '—',
          btrHours: row.btrHours ?? '—', wdoHours: row.wdoHours ?? '—',
          adjustmentHours: row.adjustmentHours,
          holidayHours: {
            legal: row.legalHolidayHours, legalOt: row.legalHolidayOtHours,
            special: row.specialHolidayHours, specialOt: row.specialHolidayOtHours,
          },
          grossPay: '—',
          ...Object.fromEntries(deductionSourceKeys.map(key => [key, expenseDeductionKeys.has(key) ? 0 : '—'])),
          totalDeductions: '—', netPay: '—', payrollCutoff: saved.period,
          remarks: [
            row.regularHours == null ? 'Missing regular hours' : '',
            this.adjustmentRemark(row),
          ].filter(Boolean).join(' · ') || 'Attendance uploaded',
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
    this.updateFilterOptions();
    this.onPreview();
  }


  resetFilters(): void {
    this.filterFormGroup.reset();
    this.onPreview();
  }

  onPreview(): void {
    const { name, detachment, status } = this.filterFormGroup.value;
    const rows = this.mockData.tableRows;
    const tableRows = rows.filter((row: any) =>
      (!name || row.fullName === name) &&
      (!detachment || row.detachment === detachment) &&
      (!status || String(row.status) === status)
    );
    this.tableRowsId = []
    this.checkBoxOutputListener([]);
    this.tableRows = tableRows.map(({ id, adjustmentHours, holidayHours, ...row }: any) => {
      this.tableRowsId.push(id);
      return row;
    });
    this.tableActions = employeeTableActionPreparation(tableRows);
    this.updateKpis(tableRows);
  }

  private formatEmployeeName(name: string): string {
    const titleCase = (value: string) => value.toLocaleLowerCase('en-PH')
      .replace(/(^|[\s'-])\p{L}/gu, letter => letter.toLocaleUpperCase('en-PH'));
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (trimmed.includes(',')) return titleCase(trimmed.replace(/\s*,\s*/g, ', '));
    const parts = trimmed.split(' ');
    if (parts.length < 2) return titleCase(trimmed);
    const surname = parts.pop();
    return titleCase(`${surname}, ${parts.join(' ')}`);
  }

  private adjustmentRemark(row: AttendanceRecord): string {
    if (!row.adjustmentPeriods?.length) return '';
    const labels: Record<AttendanceHourField, string> = {
      regularHours: 'regular', overtimeHours: 'OT', nightDifferentialHours: 'night diff.',
      btrHours: 'breaktime', wdoHours: 'worked day off', legalHolidayHours: 'legal holiday',
      legalHolidayOtHours: 'legal holiday OT', specialHolidayHours: 'special holiday',
      specialHolidayOtHours: 'special holiday OT',
    };
    const additions = (Object.keys(labels) as AttendanceHourField[]).flatMap(field => {
      const value = row.adjustmentHours?.[field];
      return value ? [`+${value.toLocaleString('en-PH', { maximumFractionDigits: 2 })} h ${labels[field]}`] : [];
    });
    return additions.length ? `Adjustment · ${additions.join(', ')}` : 'Adjustment recorded';
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

  private updateKpis(rows: typeof this.tableRows): void {
    this.employeeCount = this.tableRows.length;
    const sumValues = (read: (row: any) => unknown): number | null => {
      const values = rows.map(read);
      if (!values.length || !values.every(value => typeof value === 'number')) return null;
      return values.reduce((total, value) => total + value, 0);
    };
    const format = (value: number, currency = false) => value.toLocaleString('en-PH',
      currency ? { style: 'currency', currency: 'PHP' } : { maximumFractionDigits: 2 });
    const sum = (read: (row: any) => unknown, currency = false) => {
      const total = sumValues(read);
      return total === null ? '—' : format(total, currency);
    };
    const hourTotal = (label: string, field: AttendanceHourField, read: (row: any) => unknown) => {
      const total = sumValues(read);
      const adjustment = rows.reduce((hours, row) => hours + (row.adjustmentHours?.[field] ?? 0), 0);
      return {
        label,
        value: total === null ? '—' : format(total),
        base: adjustment && total !== null ? format(total - adjustment) : null,
        adjustment: adjustment ? format(adjustment) : null,
      };
    };
    this.hourTotals = [
      hourTotal('Regular', 'regularHours', row => row.regularHours),
      hourTotal('Regular OT', 'overtimeHours', row => this.demoMode ? row.oTHours : row.regularOvertime),
      hourTotal('Night differential', 'nightDifferentialHours', row => this.demoMode ? row.nDHours : row.nightDifferentialHours),
      hourTotal('Breaktime', 'btrHours', row => row.btrHours),
      hourTotal('Worked day off', 'wdoHours', row => row.wdoHours),
      hourTotal('Legal holiday', 'legalHolidayHours', row => row.holidayHours?.legal),
      hourTotal('Legal holiday OT', 'legalHolidayOtHours', row => this.demoMode ? row.lHOTHours : row.holidayHours?.legalOt),
      hourTotal('Special holiday', 'specialHolidayHours', row => row.holidayHours?.special),
      hourTotal('Special holiday OT', 'specialHolidayOtHours', row => this.demoMode ? row.sHOTHours : row.holidayHours?.specialOt),
    ];
    this.grossPayTotal = sum(row => row.grossPay, true);
    this.deductionsTotal = sum(row => row.totalDeductions, true);
    this.netPayTotal = sum(row => row.netPay, true);
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

  finalizeChecker(): void {
    this.isFinalizeDisabled = !this.canUseSelectedRows(2);
  }

  downloadChecker(): void {
    this.isDownloadDisabled = !this.canUseSelectedRows(1);
  }

  private canUseSelectedRows(status: number): boolean {
    return this.demoMode && this.selectedRows.length > 0 && this.selectedRows.every(id =>
      this.mockData.tableRows.some((row: { id: string; status: number }) => row.id === id && row.status === status)
    );
  }
}
