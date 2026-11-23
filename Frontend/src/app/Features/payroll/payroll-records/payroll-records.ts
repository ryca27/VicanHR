import { CurrencyPipe, DatePipe } from '@angular/common';
import { afterNextRender, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { demoLedgerEmployee } from '../payroll-cutoff/payroll-cutoff-constants';

interface LoanPayment {
  paymentId: number;
  finalizedPayrollId: number | null;
  paymentDate: string;
  reference: string;
  amount: string;
}

interface Loan {
  loanId: number;
  employeeId: string;
  reference: string;
  label: string;
  principal: string;
  monthlyInstallment: string;
  remainingBalance: string;
  status: 'paid' | 'open';
  payments: LoanPayment[];
}

interface ExpenseEmployee {
  employeeId: string;
  employeeName: string;
  loanTypes: string[];
  loanCount: number;
  remainingBalance: string;
}

interface ExpenseOverview {
  employees: ExpenseEmployee[];
  count: number;
  page: number;
  pages: number;
}

interface ExpenseDetail {
  employeeId: string;
  employeeName: string;
  loans: Loan[];
  expenses: {
    draftId: number;
    date: string;
    detachment: string | null;
    registerRow: number;
    code: string;
    label: string;
    amount: string;
  }[];
}

interface ThirteenthMonthReport {
  operationalCutoff: string;
  note: string;
  employees: {
    employeeId: string;
    employeeName: string;
    basicPayThroughOctober: string;
    octoberEstimate: string;
    calendarYearAccrued: string;
    novemberDecemberAccrual: string;
    latestFinalizedWorkDate: string;
  }[];
}

interface DraftSummary {
  draftId: number;
  period: string;
  createdAt: string;
  isFinalized: boolean;
}

interface DraftDetail {
  draftId: number;
  period: string;
  isFinalized: boolean;
  finalizedAt?: string;
  payrollPeriodDates?: { start: string; end: string };
  employees: {
    registerRow: number;
    employeeName: string;
    employeeId?: string;
    detachment?: string;
    grossPay: string;
    totalDeductions: string;
    netPay: string;
    allocatedExpenses?: Record<string, string>;
    issues: { code: string; reason: string; action: string }[];
  }[];
}

type Section = 'expenseOverview' | 'expenseEmployee' | 'thirteenth' | 'drafts' | 'draft';

@Component({
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, RouterLinkActive],
  templateUrl: './payroll-records.html',
  styleUrl: './payroll-records.scss',
})
export class PayrollRecords {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private request?: AbortController;

  readonly demoLedgerEmployeeId = demoLedgerEmployee.id;
  readonly currentYear = new Date().getFullYear();
  readonly section = signal<Section>(this.route.snapshot.data['section']);
  readonly employeeId = new FormControl('', { nonNullable: true });
  readonly employeeName = new FormControl('', { nonNullable: true });
  readonly year = new FormControl<number | null>(this.currentYear);
  readonly expenseOverview = signal<ExpenseOverview | null>(null);
  readonly expenseDetail = signal<ExpenseDetail | null>(null);
  readonly report = signal<ThirteenthMonthReport | null>(null);
  readonly drafts = signal<DraftSummary[]>([]);
  readonly draft = signal<DraftDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly needsSignIn = signal(false);

  constructor() {
    afterNextRender(() => {
      void this.load();
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(() => void this.load());
    });
    this.destroyRef.onDestroy(() => this.request?.abort());
  }

  applyFilters(): void {
    if (this.section() === 'thirteenth' && !this.validYear(this.year.value)) {
      this.error.set('Enter a valid four-digit calendar year.');
      this.needsSignIn.set(false);
      return;
    }
    void this.router.navigate([], { relativeTo: this.route, queryParams: {
      employeeId: this.employeeId.value.trim() || null,
      employeeName: this.section() === 'expenseOverview' ? this.employeeName.value.trim() || null : null,
      page: null,
      year: this.section() === 'thirteenth' ? this.year.value : null,
    } });
  }

  goToPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route, queryParams: { page }, queryParamsHandling: 'merge',
    });
  }

  clearFilters(): void {
    this.employeeId.setValue('');
    this.employeeName.setValue('');
    this.year.setValue(this.currentYear);
    this.applyFilters();
  }

  loanDeductions(expenses?: Record<string, string>): [string, string][] {
    return Object.entries(expenses ?? {}).flatMap(([key, value]) =>
      key.startsWith('loan:') ? [[key.slice(5), value]] : []
    );
  }

  private validYear(year: number | null): year is number {
    return year !== null && Number.isInteger(year) && year >= 1900 && year <= 9999;
  }

  private async load(): Promise<void> {
    this.request?.abort();
    const request = new AbortController();
    this.request = request;
    const snapshot = this.route.snapshot;
    const section: Section = snapshot.data['section'];
    const employeeId = snapshot.queryParamMap.get('employeeId')?.trim() ?? '';
    const employeeName = snapshot.queryParamMap.get('employeeName')?.trim() ?? '';
    const page = snapshot.queryParamMap.get('page') ?? '1';
    const year = Number(snapshot.queryParamMap.get('year') ?? this.currentYear);
    this.section.set(section);
    this.employeeId.setValue(employeeId);
    this.employeeName.setValue(employeeName);
    this.year.setValue(year);
    this.error.set('');
    this.needsSignIn.set(false);

    if (section === 'thirteenth' && !this.validYear(year)) {
      this.error.set('Enter a valid four-digit calendar year.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    const employeeQuery = new URLSearchParams({ employeeId });
    const paths: Record<Section, string> = {
      expenseOverview: `/api/payroll/expense-employees/?${new URLSearchParams({ employeeId, employeeName, page })}`,
      expenseEmployee: `/api/payroll/expense-employees/detail/?${employeeQuery}`,
      thirteenth: `/api/payroll/thirteenth-month/${year}/?${employeeQuery}`,
      drafts: '/api/payroll/drafts/',
      draft: `/api/payroll/drafts/${encodeURIComponent(snapshot.paramMap.get('id') ?? '')}/`,
    };
    try {
      const response = await fetch(paths[section], { signal: request.signal });
      if (request.signal.aborted) return;
      if (response.status === 401 || response.status === 403) {
        this.needsSignIn.set(true);
        throw new Error('Sign in with a Finance or Admin account to view payroll records.');
      }
      if (!response.ok) throw new Error(response.status === 404 ? 'This payroll record could not be found.' : 'Could not load payroll records.');
      const data = await response.json();
      if (request.signal.aborted) return;
      switch (section) {
        case 'expenseOverview': this.expenseOverview.set(data); break;
        case 'expenseEmployee': this.expenseDetail.set(data); break;
        case 'thirteenth': this.report.set(data); break;
        case 'drafts': this.drafts.set(data); break;
        case 'draft': this.draft.set(data); break;
      }
    } catch (error) {
      if (!request.signal.aborted) this.error.set(error instanceof Error ? error.message : 'Could not load payroll records.');
    } finally {
      if (!request.signal.aborted) this.loading.set(false);
    }
  }
}
