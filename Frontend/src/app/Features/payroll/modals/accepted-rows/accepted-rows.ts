import { Component, Input, Output, EventEmitter, inject, OnInit,DestroyRef, OnChanges  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { tabNamesList, attendanceColumnsList} from './accepted-rows-constants'

//Components Import
import { TableTabComponent } from './../../../../Components/table-tab/table-tab'
import {TableComponent} from './../../../../Components/table/table'
import { ButtonComponent } from '../../../../Components/button/button';
import { AttendanceParseResult, Upload } from './../upload/upload.models';


@Component({
  imports: [TableTabComponent, TableComponent, ButtonComponent],
  selector: 'accepted-rows-modal',
  styleUrl: './accepted-rows.scss',
  templateUrl: './accepted-rows.html',
})
export class AcceptedRowsModal implements OnInit, OnChanges {

  private router = inject(Router);

  constructor(){
  }
  @Input() isOpen = false;
  @Input() dataUploadInput: Upload = {attendance: [], expense: [], allowance: []}
  @Output() closeModalOutput : EventEmitter<boolean> = new EventEmitter<boolean>();
  title: string = 'Validated Rows to Add';
  activeTab: string = 'Attendance' 
  attendanceData: any = {}
  trainingData: any = {}
  equipmentData: any = {}
  attendanceRowsId: Array<string> = [];
  expensesRowsId: Array<string> = [];
  allowanceRowsId: Array<string> = [];
  tableRows: Array<any> = []
  tableColumns!: Array<string>;
  tableRowsId: Array<string> = [];
  attendanceColumns = attendanceColumnsList;

  public tabNamesList = tabNamesList

  ngOnInit(){
    this.attendanceData = {
      tableColumns: ['Fullname', 'Detachment', 'Regular Hours', 'Overtime Hours', 'Total Hours'],
      tableRows:[
        {
          id: '0001',
          fullName:'Lea Kukulet',
          detachment: 'SM Megabold',
          regularHours: 40,
          overtimeHours:12,
          totalHours: 52
        },
        {
          id: '0002',
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
          id: '0002',
          fullName:'Lea uutot',
          amouunt: 500,
        },
        {
          id: '0002',
          fullName:'Ryan Babango',
          amount: 1000,
        },
      ]
    };

    this.equipmentData = {
      tableColumns: ['Full Name', 'Amount'],
      tableRows:[
        {
          id: '0009',
          fullName:'Lea Tatae',
          amount: 1000,
        },
        {
          id: '0010',
          fullName:'Ryan skippy',
          amount: 3000,
        },
      ]
    }
    this.initializeTableColumns(this.attendanceColumns);
    // this.initializeTableRows(this.attendanceData.tableRows);
  }

  ngOnChanges(){
    this.initializeTableRows(this.dataUploadInput.attendance);
  }

  //Get functions

  getActiveTabRows(tab: string): Array<any> {
    switch(tab){
      case 'Attendance':
        this.initializeTableColumns(this.attendanceColumns);
        this.initializeTableRows(this.dataUploadInput.attendance);
        break;
      case 'Training':
        this.initializeTableColumns(this.trainingData.tableColumns);
        this.initializeTableRows(this.trainingData.tableRows);
        break;
      case 'Equipment':
        this.initializeTableColumns(this.equipmentData.tableColumns);
        this.initializeTableRows(this.equipmentData.tableRows);
        break;
      case 'Allowance':
        this.initializeTableColumns(this.attendanceData.tableColumns);
        this.initializeTableRows(this.attendanceData.tableRows);
        break;
    }
    return []
  }

  initializeTableColumns(columns:any): void{
    this.tableColumns = columns;
  }

  initializeTableRows(tableRows:any): void {
    this.tableRows = [];
    tableRows.forEach( (ar: AttendanceParseResult) => {
      ar.employees.forEach(e => {
        let employeeNo = e.employeeNo ? e.employeeNo : '0';
        this.tableRowsId.push(employeeNo);
        delete e.employeeNo;
        this.tableRows.push(e);
      })
    });
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
    this.getActiveTabRows(this.activeTab);

  }
}
