import { Component, Input, OnInit, inject, OnChanges, DestroyRef, Output, EventEmitter } from '@angular/core';
import { NgClass } from '@angular/common';
import { actionList, CheckBoxOutputInterface } from './table-constants'
import {FormControl, ReactiveFormsModule, Validators, FormArray, FormGroup, FormBuilder,} from '@angular/forms'
import { MatFormFieldModule } from '@angular/material/form-field';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
@Component({
  selector: 'app-table',
  imports: [NgClass, MatFormFieldModule, ReactiveFormsModule],
  templateUrl: './table.html',
  styleUrl: './table.scss',
})


export class TableComponent implements OnInit {
  @Input() columnsInput: String[] = []
  @Input() rowsInput: any[] = [];
  @Input() includeCheckBox: boolean = false;
  @Input() rowsIdInput: Array<string> = [];
  @Input() includeStatus: boolean = false;
  @Input() actionRowsInput: Array<Array<{value: number, isDisabled:boolean}>> = [];
  @Output() checkBoxOutput: EventEmitter<Array<CheckBoxOutputInterface>> = new EventEmitter<Array<CheckBoxOutputInterface>>();
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef); 
  actionColumnIndex: number = -1;
  statusColumnIndex: number = -1;
  actionRows: Array<Array<{imgSrc: string, isDisabled: boolean}>> = [];
  tableRows: Array<Array<string| number| boolean>>= [];
  tableRowsDisplay: Array<Array<string| number| boolean>>= [];
  checkBoxFormGroup!: FormGroup;
  checkAll: boolean = false;
  

  //Pagination Variables
  pageSize: number = 50;
  currentPage: number = 1;
  pageArray: number[] = [];


  ngOnInit(){
    this.getTableRows;
    this.getActionColumn();
    this.getStatusColumn();
    this.getActionRows();
    this.initializeCheckFormGroup();
    this.onChangeCheckBox();
    this.getPageArray(this.pageSize);
    this.getDisplayByPageNumber();
  }

  ngOnChanges(){
    this.getTableRows();
    this.reloadTable();
  }

  getTableRows(){
    this.tableRows = [];
    for (const row of this.rowsInput){
      let rowToAdd: any[] = []
      for (const key of this.getObjectKeys(row)){
        rowToAdd.push(key)
      }
      this.tableRows.push(rowToAdd);
    }
  }

  getObjectKeys<T extends object>(obj: T) {
    return Object.values(obj) as Array<keyof T>;
  }

  getActionColumn(): void {
    this.actionColumnIndex = this.columnsInput.indexOf('Actions');
  }

  getStatusColumn(): void {
    this.statusColumnIndex = this.columnsInput.indexOf('Status');
  }

  initializeCheckFormGroup(): void{
    if(this.includeCheckBox){
      let formArray = []
      for(const i of this.rowsIdInput){
        let group = this.createCheckBoxFormGroup(i);
        formArray.push(group);
      }
      this.checkBoxFormGroup = this.fb.group({
        allCheck: false,
        checkBoxArray : this.fb.array(formArray)
      })
    }
  }

  createCheckBoxFormGroup(id: string): FormGroup{
    let group = this.fb.group({
      isChecked: [false],
      id: [id]
    })
    return group;
  }

  getActionRows(){
    for (const rowArray of this.actionRowsInput){
      let rowToAdd = [];
      for(const row of rowArray){
        let actionToAppend: {imgSrc: string, isDisabled: boolean} = {
          imgSrc : actionList.filter(a => a.value == row.value)[0].imgSrc,
            isDisabled: row.isDisabled
        }
        rowToAdd.push(actionToAppend)
      }
      
      this.actionRows.push(rowToAdd);
    }
  }

  //CheckBox functions
  get checkBoxArray(){
    return this.checkBoxFormGroup.get('checkBoxArray') as FormArray
  }
  get allCheck(){
    return this.checkBoxFormGroup.get('allCheck') as FormControl
  }

  onChangeAllCheckBox(event: Event){
    const checkbox = event.target as HTMLInputElement
    this.checkAll = checkbox.checked
  }

  onClickAllCheck(value: boolean){
    for(const checkBoxControl of this.checkBoxArray.controls){
      checkBoxControl.setValue(value);
    }
  }

  onChangeCheckBox(){
    this.checkBoxArray.valueChanges
    .pipe(
      takeUntilDestroyed(this.destroyRef) 
    )
    .subscribe((formArrayValue) => {
      const totalRows = this.tableRowsDisplay.length;
      
      const checkedCount = (this.checkBoxArray.controls as FormGroup[]).filter(cba => {
        return cba.controls['isChecked']?.value === true && !cba.disabled;
      }).length;
      debugger;
      this.checkBoxOutput.emit(formArrayValue);

      // 4. Update the "Select All" master checkbox state cleanly
      if (checkedCount === totalRows) {
        this.allCheck.setValue(true, { emitEvent: false });
      } else {
        this.allCheck.setValue(false, { emitEvent: false });
      }

    });
  }
  //End of CheckBox functions

  //Pagination Functions
  getPageArray(rowPerPage: number): void {
    this.pageArray = Array.from({length: Math.ceil(this.tableRows.length/rowPerPage)}, (_,index) => index + 1);
  }

  movePageNumber(page: number): void {
    this.currentPage = page;
    this.getDisplayByPageNumber();
  }

  decreasePageNumber(): void{
    this.currentPage > 1 ? this.currentPage -= 1 : '';
    this.getDisplayByPageNumber();
  }

  increasePageNumber(): void{
    this.currentPage < this.pageArray.length ? this.currentPage +=1 :'';
    this.getDisplayByPageNumber();
  }

  getDisplayByPageNumber(): void {
    let startingIndex = (this.currentPage-1)*this.pageSize;
    let endingIndex = this.currentPage*this.pageSize;
    this.tableRowsDisplay = this.tableRows.slice(startingIndex,endingIndex)
  }

  reloadTable(){
    // this.checkBoxArray.disable();
    this.currentPage = 1;
    this.getDisplayByPageNumber();
    this.getPageArray(this.pageSize);
  }
}
