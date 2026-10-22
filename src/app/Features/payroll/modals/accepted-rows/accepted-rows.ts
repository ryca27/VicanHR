import { Component, Input, Output, EventEmitter, inject, OnInit,DestroyRef,   } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

//Components Import
import { TableTabComponent } from './../../../../Components/table-tab/table-tab'
import {TableComponent} from './../../../../Components/table/table'
import { ButtonComponent } from '../../../../Components/button/button';


@Component({
  imports: [TableTabComponent, TableComponent, ButtonComponent],
  selector: 'accepted-rows-modal',
  styleUrl: './accepted-rows.scss',
  templateUrl: './accepted-rows.html',
})
export class AcceptedRowsModal implements OnInit {

  private router = inject(Router);

  constructor(){
  }
  @Input() isOpen = false;
  @Output() closeModalOutput : EventEmitter<boolean> = new EventEmitter<boolean>();
  title: string = 'Validated Rows to Add';
  activeTab: string = 'Attendance' 
  tabNames: {name: string, isActive: boolean}[] = [
    {'name': 'Attendance', 'isActive': true,},
    {'name': 'Training', 'isActive': false,},
    {'name': 'Equipment', 'isActive': false,},
  ]
  attendanceData: any = {}
  trainingData: any = {}
  equipmentData: any = {}

  ngOnInit(){
    this.attendanceData = {
      tableColumns: ['Fullname', 'Detachment', 'Regular Hours', 'Overtime Hours', 'Total Hours'],
      tableRows:[
        {
          fullName:'Lea Kukulet',
          detachment: 'SM Megabold',
          regularHours: 40,
          overtimeHours:12,
          totalHours: 52
        },
        {
          fullName:'Ryan Babaet',
          detachment: 'SM Fairview',
          regularHours: 30,
          overtimeHours:12,
          totalHours: 42
        },
      ]
    };

    this.trainingData = {
      tableColumns: ['Full Name', 'Amount'],
      tableRows:[
        {
          fullName:'Lea uutot',
          payrollReady: 500,
        },
        {
          fullName:'Ryan Babango',
          payrollReady: 1000,
        },
      ]
    };

    this.equipmentData = {
      tableColumns: ['Full Name', 'Amount'],
      tableRows:[
        {
          fullName:'Lea Tatae',
          payrollReady: 1000,
        },
        {
          fullName:'Ryan skippy',
          payrollReady: 3000,
        },
      ]
    }
  }

  closeAcceptedRowsModal(){
    this.isOpen = false;
    this.closeModalOutput.emit(false);
  }

  uploadRows(){
    this.router.navigateByUrl('/cutoff/1')
  }

  //Output event Listener
  activeTabOutputListener(message: string) {
    this.activeTab = message;
  }
}
