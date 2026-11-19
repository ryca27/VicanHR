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
