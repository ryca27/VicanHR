import { Routes } from '@angular/router';
import { Home} from './Home/home';
import { CreateProfile} from './UserProfile/create-profile/create-profile';
import { ViewProfile} from './UserProfile/view-profile/view-profile';
import { EmployeeList} from './Attendance/employee-list/employee-list'; 
import { App } from './app'

export const routes: Routes = [
    {
        path: 'CreateProfile',
        component: CreateProfile
    },

    {
        path: 'ViewProfile',
        component: ViewProfile
    },

    {
        path: 'Attendance',
        component: EmployeeList
    },

    {
        path: 'Home',
        component: Home
    },

    {
        path: '',
        component: App
    }
];
