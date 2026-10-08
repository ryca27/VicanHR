import { Routes } from '@angular/router';
import { Home} from './Home/home';
import {Payroll} from './Features/payroll/payroll'
import { App } from './app'

export const routes: Routes = [


    {
        path: '',
        component: Home
    },
    {
        path:'payroll',
        component: Payroll
    }
];
