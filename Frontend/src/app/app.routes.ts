import { PayrollRecords } from './Features/payroll/payroll-records/payroll-records';
import { SavedAttendance } from './Features/payroll/saved-attendance';
import { Routes } from '@angular/router';
import { Home} from './Home/home';
import {Payroll} from './Features/payroll/payroll'
import {PayrollCutoff} from './Features/payroll/payroll-cutoff/payroll-cutoff'
import {LoginComponent} from './Login/login'
import { RenderMode, ServerRoute } from '@angular/ssr';
import { App } from './app'
import { roleGuard } from './Login/authentication/role.guard';

export const routes: Routes = [
    { path: 'expay', component: PayrollRecords, data: { section: 'expenseOverview' } },
    { path: 'expay/employee', component: PayrollRecords, data: { section: 'expenseEmployee' } },
    { path: 'payroll/loans', component: PayrollRecords, data: { section: 'expenseOverview' } },
    { path: 'payroll/thirteenth-month', component: PayrollRecords, data: { section: 'thirteenth' } },
    { path: 'payroll/drafts', component: PayrollRecords, data: { section: 'drafts' } },
    { path: 'payroll/drafts/:id', component: PayrollRecords, data: { section: 'draft' } },
    { path: 'attendance/:id', component: SavedAttendance },


    {
        path: '',
        component: Home
    },
    {
        path:'payroll',
        component: Payroll,
        // canActivate: [roleGuard],
        data: {
            roles:['admin','hr']
        }
    },
    {
        path:'cutoff/:id',
        component: PayrollCutoff,
    },
    {
        path: 'login',
        component: LoginComponent
      },
];
