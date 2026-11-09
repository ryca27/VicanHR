import { Routes } from '@angular/router';
import { Home} from './Home/home';
import {Payroll} from './Features/payroll/payroll'
import {PayrollCutoff} from './Features/payroll/payroll-cutoff/payroll-cutoff'
import { App } from './app'

export const routes: Routes = [


    {
        path: '',
        component: Home
    },
    {
        path:'payroll',
        component: Payroll,
        children:[{
            path: 'sdsd',
            component: PayrollCutoff
        }]
    },
    {
        path:'cutoff/:id',
        component: PayrollCutoff
    }
];
